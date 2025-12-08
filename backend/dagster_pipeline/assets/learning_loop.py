"""
Learning Loop Assets for Dagster Pipeline - Layer 5

Implements the feedback loop that closes the learning cycle:
1. prediction_accuracy_tracking: Compare predicted vs actual outcomes
2. updated_user_deviations: Update Recovery_Index and user-specific deviations
3. acwr_refresh: Refresh ACWR materialized view

Key concepts:
- Predicted vs Actual comparison enables model improvement
- Recovery_Index tracks per-user fatigue recovery capacity
- ACWR (Acute:Chronic Workload Ratio) for injury risk
"""

from dagster import asset, AssetExecutionContext, MetadataValue, Output
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import numpy as np

from ..resources import SupabaseResource


@asset(
    group_name="learning_loop",
    description="Track prediction accuracy by comparing predicted vs actual session quality",
    compute_kind="python",
)
def prediction_accuracy_tracking(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[Dict[str, Any]]:
    """
    Compare predicted quality with actual quality for completed sessions.

    This is the first step in closing the learning loop:
    1. Find sessions with predictions but no accuracy record
    2. Calculate error = actual - predicted
    3. Store for analysis and model improvement
    """
    client = supabase.client

    # Find sessions with predictions that have been completed with quality ratings
    # but don't have accuracy records yet
    result = client.table('climbing_sessions') \
        .select('id, user_id, session_quality, prediction_snapshot, pre_session_data') \
        .eq('status', 'completed') \
        .not_.is_('session_quality', 'null') \
        .not_.is_('prediction_snapshot', 'null') \
        .order('started_at', desc=True) \
        .limit(500) \
        .execute()

    sessions = result.data or []
    context.log.info(f"Found {len(sessions)} sessions with predictions to analyze")

    if not sessions:
        return Output(
            {"status": "no_sessions", "records_created": 0},
            metadata={"status": "no_sessions"}
        )

    # Check which sessions already have accuracy records
    session_ids = [s['id'] for s in sessions]
    existing_result = client.table('prediction_accuracy') \
        .select('session_id') \
        .in_('session_id', session_ids) \
        .execute()

    existing_ids = set(r['session_id'] for r in (existing_result.data or []))
    new_sessions = [s for s in sessions if s['id'] not in existing_ids]

    context.log.info(f"Processing {len(new_sessions)} sessions without accuracy records")

    records_created = 0
    errors = []

    for session in new_sessions:
        prediction = session.get('prediction_snapshot') or {}
        if isinstance(prediction, str):
            import json
            try:
                prediction = json.loads(prediction)
            except:
                continue

        predicted_quality = prediction.get('predicted_quality')
        actual_quality = session.get('session_quality')

        if predicted_quality is None or actual_quality is None:
            continue

        # Get pre-session state for context
        pre_data = session.get('pre_session_data') or {}
        if isinstance(pre_data, str):
            import json
            try:
                pre_data = json.loads(pre_data)
            except:
                pre_data = {}

        accuracy_record = {
            'user_id': session['user_id'],
            'session_id': session['id'],
            'predicted_quality': float(predicted_quality),
            'predicted_fatigue': prediction.get('predicted_fatigue'),
            'actual_quality': float(actual_quality),
            'actual_fatigue': pre_data.get('fatigue_level'),
            'key_factors': prediction.get('key_factors'),
            'user_state_snapshot': pre_data,
        }

        try:
            client.table('prediction_accuracy').insert(accuracy_record).execute()
            records_created += 1

            # Track error for summary
            error = actual_quality - predicted_quality
            errors.append(error)
        except Exception as e:
            context.log.warning(f"Failed to insert accuracy record for session {session['id']}: {e}")

    # Calculate summary statistics
    summary = {
        "status": "success",
        "records_created": records_created,
        "sessions_analyzed": len(new_sessions),
    }

    if errors:
        summary["mean_error"] = float(np.mean(errors))
        summary["std_error"] = float(np.std(errors))
        summary["mean_absolute_error"] = float(np.mean(np.abs(errors)))
        summary["rmse"] = float(np.sqrt(np.mean(np.array(errors) ** 2)))

    context.log.info(f"Created {records_created} accuracy records. MAE: {summary.get('mean_absolute_error', 'N/A')}")

    return Output(
        summary,
        metadata={
            "records_created": records_created,
            "mean_error": summary.get("mean_error", 0),
            "mean_absolute_error": summary.get("mean_absolute_error", 0),
            "rmse": summary.get("rmse", 0),
        }
    )


@asset(
    group_name="learning_loop",
    description="Update user deviation metrics based on prediction accuracy",
    compute_kind="python",
    deps=["prediction_accuracy_tracking"],
)
def updated_user_deviations(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[Dict[str, Any]]:
    """
    Compare predicted vs actual outcomes and update user deviation metrics.

    Key updates:
    1. Recovery_Index: If user consistently feels better than predicted after
       high-fatigue sessions, increase their recovery index
    2. Variable-specific deviations: If user's quality is higher than predicted
       when sleep is low, update their sleep_quality_deviation

    This implements the Bayesian updater concept:
    - Positive error (actual > predicted) = user is more resilient than model expects
    - Negative error (actual < predicted) = user is less resilient than model expects
    """
    client = supabase.client

    # Get prediction accuracy data from last 30 days
    cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()

    result = client.table('prediction_accuracy') \
        .select('*') \
        .gte('created_at', cutoff) \
        .order('created_at', desc=False) \
        .execute()

    records = result.data or []
    context.log.info(f"Analyzing {len(records)} accuracy records from last 30 days")

    if not records:
        return Output(
            {"status": "no_data", "users_updated": 0},
            metadata={"status": "no_data"}
        )

    # Group by user
    user_records = defaultdict(list)
    for record in records:
        user_id = record.get('user_id')
        if user_id and record.get('quality_error') is not None:
            user_records[user_id].append(record)

    context.log.info(f"Found records for {len(user_records)} users")

    users_updated = 0
    updates_made = []

    for user_id, comparisons in user_records.items():
        if len(comparisons) < 5:  # Need minimum data for reliable updates
            continue

        # Calculate mean prediction error
        errors = [c['quality_error'] for c in comparisons if c.get('quality_error') is not None]
        if not errors:
            continue

        mean_error = np.mean(errors)
        std_error = np.std(errors)

        # Get current model output for this user
        model_result = client.table('model_outputs') \
            .select('recovery_index, coefficients') \
            .eq('user_id', user_id) \
            .single() \
            .execute()

        current = model_result.data if model_result.data else {}
        current_recovery = current.get('recovery_index', 1.0) or 1.0

        update_payload = {}
        update_reasons = []

        # Update Recovery_Index based on consistent prediction errors
        # Positive error means user performs better than expected
        if mean_error > 0.5 and std_error < 1.0:  # Consistently underestimating
            # User recovers better than average - increase recovery index
            new_recovery = min(2.0, current_recovery + 0.1)
            update_payload['recovery_index'] = new_recovery
            update_reasons.append(f"Recovery_Index {current_recovery:.2f} -> {new_recovery:.2f} (mean_error: +{mean_error:.2f})")

        elif mean_error < -0.5 and std_error < 1.0:  # Consistently overestimating
            # User recovers worse than average - decrease recovery index
            new_recovery = max(0.5, current_recovery - 0.1)
            update_payload['recovery_index'] = new_recovery
            update_reasons.append(f"Recovery_Index {current_recovery:.2f} -> {new_recovery:.2f} (mean_error: {mean_error:.2f})")

        # Analyze variable-specific patterns
        variable_deviations = _analyze_variable_patterns(comparisons)
        if variable_deviations:
            current_coefficients = current.get('coefficients', {})
            # Merge new deviations with existing
            merged_coefficients = {**current_coefficients}
            for var, deviation in variable_deviations.items():
                merged_coefficients[f'{var}_deviation'] = deviation

            update_payload['coefficients'] = merged_coefficients
            update_reasons.append(f"Variable deviations updated: {list(variable_deviations.keys())}")

        # Apply updates if any
        if update_payload:
            update_payload['last_trained_at'] = datetime.utcnow().isoformat()

            try:
                client.table('model_outputs') \
                    .upsert({
                        'user_id': user_id,
                        **update_payload
                    }, on_conflict='user_id') \
                    .execute()

                users_updated += 1
                updates_made.append({
                    'user_id': user_id,
                    'reasons': update_reasons,
                    'n_sessions': len(comparisons)
                })
            except Exception as e:
                context.log.warning(f"Failed to update user {user_id}: {e}")

    context.log.info(f"Updated deviation metrics for {users_updated} users")

    return Output(
        {
            "status": "success",
            "users_updated": users_updated,
            "total_users_analyzed": len(user_records),
            "updates": updates_made[:10],  # First 10 for logging
        },
        metadata={
            "users_updated": users_updated,
            "users_analyzed": len(user_records),
            "total_records": len(records),
        }
    )


def _analyze_variable_patterns(comparisons: List[Dict]) -> Dict[str, float]:
    """
    Analyze prediction errors in context of input variables.

    If prediction errors correlate with specific variables being extreme,
    we can infer user-specific deviation from population model.

    Example: If user consistently beats predictions when sleep_quality is low,
    they may be less sensitive to poor sleep than average.
    """
    deviations = {}

    # Variables to analyze
    variables = ['sleep_quality', 'stress_level', 'energy_level', 'muscle_soreness', 'motivation']

    for var in variables:
        low_var_errors = []
        high_var_errors = []

        for comp in comparisons:
            state = comp.get('user_state_snapshot', {})
            if not state:
                continue

            var_value = state.get(var)
            error = comp.get('quality_error')

            if var_value is None or error is None:
                continue

            # Split by variable value (low vs high)
            if var_value <= 4:  # Low value
                low_var_errors.append(error)
            elif var_value >= 7:  # High value
                high_var_errors.append(error)

        # Check for significant pattern
        if len(low_var_errors) >= 3 and len(high_var_errors) >= 3:
            low_mean = np.mean(low_var_errors)
            high_mean = np.mean(high_var_errors)

            # If errors differ significantly based on variable value,
            # user responds differently to this variable than population
            diff = low_mean - high_mean

            if abs(diff) > 0.5:  # Significant difference
                # Positive diff means user does better than expected when var is LOW
                # This suggests less sensitivity to low values of this variable
                deviations[var] = float(diff * 0.2)  # Conservative adjustment

    return deviations


@asset(
    group_name="learning_loop",
    description="Refresh ACWR materialized view for all users",
    compute_kind="python",
)
def acwr_refresh(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[Dict[str, Any]]:
    """
    Refresh the ACWR (Acute:Chronic Workload Ratio) materialized view.

    ACWR is critical for injury risk prediction:
    - < 0.8: Undertrained (deconditioned)
    - 0.8-1.3: Optimal (sweet spot)
    - 1.3-1.5: Moderate risk (caution)
    - > 1.5: High risk (injury likely)

    Should be refreshed daily.
    """
    client = supabase.client

    try:
        # Call the refresh function
        result = client.rpc('refresh_acwr_materialized_view').execute()

        # Get summary stats after refresh
        stats_result = client.table('user_acwr') \
            .select('user_id, acwr, risk_zone') \
            .execute()

        stats = stats_result.data or []

        # Count by risk zone
        risk_zones = defaultdict(int)
        acwr_values = []

        for s in stats:
            risk_zones[s.get('risk_zone', 'unknown')] += 1
            if s.get('acwr') is not None:
                acwr_values.append(s['acwr'])

        summary = {
            "status": "success",
            "users_refreshed": len(stats),
            "risk_zone_distribution": dict(risk_zones),
        }

        if acwr_values:
            summary["mean_acwr"] = float(np.mean(acwr_values))
            summary["high_risk_users"] = risk_zones.get('high_risk', 0)

        context.log.info(f"Refreshed ACWR for {len(stats)} users. Distribution: {dict(risk_zones)}")

        return Output(
            summary,
            metadata={
                "users_refreshed": len(stats),
                "mean_acwr": summary.get("mean_acwr", 0),
                "high_risk_users": summary.get("high_risk_users", 0),
                "moderate_risk_users": risk_zones.get('moderate_risk', 0),
                "optimal_users": risk_zones.get('optimal', 0),
            }
        )

    except Exception as e:
        context.log.error(f"Failed to refresh ACWR: {e}")

        return Output(
            {"status": "error", "error": str(e)},
            metadata={"status": "error", "error": str(e)[:100]}
        )


@asset(
    group_name="learning_loop",
    description="Update user fatigue tracking based on recent session patterns",
    compute_kind="python",
)
def user_fatigue_tracking(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[Dict[str, Any]]:
    """
    Track cumulative fatigue patterns per user.

    Updates:
    - cumulative_fatigue_7d: 7-day weighted fatigue accumulation
    - cumulative_fatigue_28d: 28-day weighted fatigue accumulation
    - avg_recovery_rate: How quickly user recovers between sessions

    This feeds into the Recovery_Index calculation.
    """
    client = supabase.client

    # Get recent sessions with fatigue data
    cutoff_28d = (datetime.utcnow() - timedelta(days=28)).isoformat()

    result = client.table('climbing_sessions') \
        .select('id, user_id, started_at, actual_intensity, actual_duration, post_session_data') \
        .gte('started_at', cutoff_28d) \
        .eq('status', 'completed') \
        .order('started_at', desc=False) \
        .execute()

    sessions = result.data or []
    context.log.info(f"Analyzing fatigue patterns from {len(sessions)} sessions")

    if not sessions:
        return Output(
            {"status": "no_sessions", "users_updated": 0},
            metadata={"status": "no_sessions"}
        )

    # Group sessions by user
    user_sessions = defaultdict(list)
    for session in sessions:
        user_sessions[session['user_id']].append(session)

    users_updated = 0
    cutoff_7d = datetime.utcnow() - timedelta(days=7)

    for user_id, user_data in user_sessions.items():
        # Sort by date
        user_data.sort(key=lambda x: x['started_at'])

        # Calculate session loads
        loads_7d = []
        loads_28d = []
        fatigue_deltas = []

        for i, session in enumerate(user_data):
            # Calculate session load: intensity * duration
            intensity = session.get('actual_intensity') or 7
            duration = session.get('actual_duration') or 60
            load = intensity * duration

            session_date = datetime.fromisoformat(session['started_at'].replace('Z', '+00:00'))

            loads_28d.append(load)
            if session_date.replace(tzinfo=None) >= cutoff_7d:
                loads_7d.append(load)

            # Track fatigue recovery between sessions
            if i > 0:
                post = session.get('post_session_data') or {}
                if isinstance(post, str):
                    import json
                    try:
                        post = json.loads(post)
                    except:
                        post = {}

                fatigue_post = post.get('fatigue_level')
                if fatigue_post:
                    # Higher fatigue after session = slower recovery
                    fatigue_deltas.append(fatigue_post)

        # Calculate metrics
        cumulative_7d = sum(loads_7d) if loads_7d else 0
        cumulative_28d = sum(loads_28d) if loads_28d else 0

        # Recovery rate: lower post-session fatigue = faster recovery
        avg_recovery = None
        if fatigue_deltas:
            # Invert: lower fatigue = higher recovery rate
            avg_recovery = 10 - np.mean(fatigue_deltas)  # Scale to positive

        fatigue_record = {
            'user_id': user_id,
            'cumulative_fatigue_7d': float(cumulative_7d),
            'cumulative_fatigue_28d': float(cumulative_28d),
            'avg_recovery_rate': float(avg_recovery) if avg_recovery else None,
            'last_session_id': user_data[-1]['id'],
            'updated_at': datetime.utcnow().isoformat(),
        }

        try:
            client.table('user_fatigue_tracking') \
                .upsert(fatigue_record, on_conflict='user_id') \
                .execute()
            users_updated += 1
        except Exception as e:
            context.log.warning(f"Failed to update fatigue tracking for user {user_id}: {e}")

    context.log.info(f"Updated fatigue tracking for {users_updated} users")

    return Output(
        {
            "status": "success",
            "users_updated": users_updated,
            "total_users": len(user_sessions),
        },
        metadata={
            "users_updated": users_updated,
            "sessions_analyzed": len(sessions),
        }
    )


@asset(
    group_name="learning_loop",
    description="Get prediction statistics for monitoring model performance",
    compute_kind="python",
)
def prediction_stats(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[Dict[str, Any]]:
    """
    Calculate aggregate prediction statistics for monitoring.

    Tracks:
    - Overall model accuracy
    - Per-phase accuracy (cold_start vs personalized)
    - Trends over time
    """
    client = supabase.client

    # Get user-level stats
    result = client.rpc('get_user_prediction_stats', {'p_user_id': None}).execute()

    # If no user specified, get overall stats from prediction_accuracy table
    accuracy_result = client.table('prediction_accuracy') \
        .select('quality_error, created_at') \
        .order('created_at', desc=True) \
        .limit(1000) \
        .execute()

    records = accuracy_result.data or []

    if not records:
        return Output(
            {"status": "no_data"},
            metadata={"status": "no_data"}
        )

    errors = [r['quality_error'] for r in records if r.get('quality_error') is not None]

    stats = {
        "total_predictions": len(records),
        "mean_error": float(np.mean(errors)) if errors else 0,
        "std_error": float(np.std(errors)) if errors else 0,
        "mae": float(np.mean(np.abs(errors))) if errors else 0,
        "rmse": float(np.sqrt(np.mean(np.array(errors) ** 2))) if errors else 0,
        "within_1_point": sum(1 for e in errors if abs(e) <= 1) / len(errors) if errors else 0,
        "within_0_5_point": sum(1 for e in errors if abs(e) <= 0.5) / len(errors) if errors else 0,
    }

    # Trend analysis (last 7 days vs previous 7 days)
    recent_cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
    older_cutoff = (datetime.utcnow() - timedelta(days=14)).isoformat()

    recent_errors = [r['quality_error'] for r in records
                     if r.get('created_at', '') >= recent_cutoff and r.get('quality_error') is not None]
    older_errors = [r['quality_error'] for r in records
                    if older_cutoff <= r.get('created_at', '') < recent_cutoff and r.get('quality_error') is not None]

    if recent_errors and older_errors:
        recent_mae = np.mean(np.abs(recent_errors))
        older_mae = np.mean(np.abs(older_errors))
        stats["mae_trend"] = "improving" if recent_mae < older_mae else "degrading"
        stats["mae_change"] = float(recent_mae - older_mae)

    context.log.info(f"Prediction stats: MAE={stats['mae']:.3f}, RMSE={stats['rmse']:.3f}, within_1pt={stats['within_1_point']*100:.1f}%")

    return Output(
        stats,
        metadata={
            "mae": stats["mae"],
            "rmse": stats["rmse"],
            "within_1_point_pct": stats["within_1_point"] * 100,
            "total_predictions": stats["total_predictions"],
        }
    )
