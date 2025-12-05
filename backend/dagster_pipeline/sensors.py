"""
Dagster Sensors for ClimbIQ Pipeline

Monitors for conditions that should trigger pipeline runs.
"""

from dagster import (
    sensor,
    RunRequest,
    SensorEvaluationContext,
    SkipReason,
    DefaultSensorStatus,
    AssetSelection,
)
from datetime import datetime, timedelta
from typing import Iterator, Union

from .resources import SupabaseResource
from .jobs import nightly_training_job


@sensor(
    minimum_interval_seconds=3600,  # Check hourly
    default_status=DefaultSensorStatus.RUNNING,
    description="Triggers prior extraction when enough new consensus records exist",
)
def new_consensus_sensor(
    context: SensorEvaluationContext,
) -> Iterator[Union[RunRequest, SkipReason]]:
    """
    Trigger prior extraction when new consensus records exist.
    
    Checks the scenario_consensus table for unprocessed records.
    Triggers a run when the count exceeds the batch threshold.
    """
    import os
    from supabase import create_client
    
    # Get Supabase credentials from environment
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        yield SkipReason("Supabase credentials not configured")
        return
    
    try:
        client = create_client(url, key)
        
        # Count unprocessed consensus records
        result = client.table('scenario_consensus') \
            .select('id', count='exact') \
            .eq('processed_into_priors', False) \
            .execute()
        
        unprocessed_count = result.count or 0
        
        context.log.info(f"Found {unprocessed_count} unprocessed consensus records")
        
        # Batch threshold - wait for enough data before processing
        BATCH_THRESHOLD = 5
        
        if unprocessed_count >= BATCH_THRESHOLD:
            run_key = f"prior_extraction_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
            
            yield RunRequest(
                run_key=run_key,
                tags={
                    "triggered_by": "new_consensus_sensor",
                    "unprocessed_count": str(unprocessed_count),
                    "trigger_time": datetime.utcnow().isoformat(),
                },
            )
        else:
            yield SkipReason(
                f"Only {unprocessed_count} unprocessed records. "
                f"Waiting for {BATCH_THRESHOLD} before triggering."
            )
            
    except Exception as e:
        context.log.error(f"Error checking consensus records: {e}")
        yield SkipReason(f"Error: {e}")


@sensor(
    minimum_interval_seconds=86400,  # Check daily
    default_status=DefaultSensorStatus.RUNNING,
    description="Monitors for stale priors that may need refreshing",
)
def stale_priors_sensor(
    context: SensorEvaluationContext,
) -> Iterator[Union[RunRequest, SkipReason]]:
    """
    Trigger prior extraction if priors haven't been updated recently
    and there's new expert data available.
    """
    import os
    from supabase import create_client
    from datetime import timedelta
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        yield SkipReason("Supabase credentials not configured")
        return
    
    try:
        client = create_client(url, key)
        
        # Check when priors were last updated
        priors_result = client.table('population_priors') \
            .select('updated_at') \
            .order('updated_at', desc=True) \
            .limit(1) \
            .execute()
        
        # Check if there are any unprocessed consensus records
        consensus_result = client.table('scenario_consensus') \
            .select('id', count='exact') \
            .eq('processed_into_priors', False) \
            .execute()
        
        unprocessed_count = consensus_result.count or 0
        
        # If there are unprocessed records and priors are stale, trigger
        if unprocessed_count > 0:
            last_update = None
            if priors_result.data:
                last_update_str = priors_result.data[0].get('updated_at')
                if last_update_str:
                    last_update = datetime.fromisoformat(last_update_str.replace('Z', '+00:00'))
            
            # Consider priors stale after 7 days
            STALE_THRESHOLD = timedelta(days=7)
            is_stale = last_update is None or (datetime.utcnow().replace(tzinfo=last_update.tzinfo) - last_update) > STALE_THRESHOLD
            
            if is_stale:
                run_key = f"stale_priors_refresh_{datetime.utcnow().strftime('%Y%m%d')}"
                
                yield RunRequest(
                    run_key=run_key,
                    tags={
                        "triggered_by": "stale_priors_sensor",
                        "unprocessed_count": str(unprocessed_count),
                        "last_update": str(last_update) if last_update else "never",
                    },
                )
            else:
                yield SkipReason(
                    f"Priors updated recently ({last_update}). "
                    f"{unprocessed_count} unprocessed records waiting."
                )
        else:
            yield SkipReason("No unprocessed consensus records")
            
    except Exception as e:
        context.log.error(f"Error checking priors: {e}")
        yield SkipReason(f"Error: {e}")


@sensor(
    minimum_interval_seconds=300,  # Check every 5 minutes
    default_status=DefaultSensorStatus.STOPPED,  # Manually enabled for high-priority scenarios
    description="Rapid sensor for urgent prior updates (e.g., safety rules)",
)
def urgent_consensus_sensor(
    context: SensorEvaluationContext,
) -> Iterator[Union[RunRequest, SkipReason]]:
    """
    Trigger immediate prior extraction for high-priority scenarios
    (e.g., those tagged with safety concerns).
    """
    import os
    from supabase import create_client
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        yield SkipReason("Supabase credentials not configured")
        return
    
    try:
        client = create_client(url, key)
        
        # Check for unprocessed consensus from high-priority scenarios
        # Join with scenarios to check edge_case_tags
        result = client.table('scenario_consensus') \
            .select('id, scenario_id') \
            .eq('processed_into_priors', False) \
            .execute()
        
        if not result.data:
            yield SkipReason("No unprocessed consensus records")
            return
        
        # Check if any are from safety-tagged scenarios
        scenario_ids = [r['scenario_id'] for r in result.data]
        
        scenarios_result = client.table('synthetic_scenarios') \
            .select('id, edge_case_tags') \
            .in_('id', scenario_ids) \
            .execute()
        
        urgent_count = 0
        for scenario in scenarios_result.data or []:
            tags = scenario.get('edge_case_tags', []) or []
            if any(tag in ['safety', 'injury', 'urgent'] for tag in tags):
                urgent_count += 1
        
        if urgent_count > 0:
            run_key = f"urgent_prior_extraction_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
            
            yield RunRequest(
                run_key=run_key,
                tags={
                    "triggered_by": "urgent_consensus_sensor",
                    "urgent_count": str(urgent_count),
                    "priority": "high",
                },
            )
        else:
            yield SkipReason(f"No urgent scenarios found among {len(result.data)} unprocessed")
            
    except Exception as e:
        context.log.error(f"Error checking urgent scenarios: {e}")
        yield SkipReason(f"Error: {e}")


@sensor(
    job=nightly_training_job,
    minimum_interval_seconds=3600,  # Check hourly
    default_status=DefaultSensorStatus.RUNNING,
    description="Triggers nightly model training at 2 AM UTC",
)
def nightly_training_sensor(
    context: SensorEvaluationContext,
) -> Iterator[Union[RunRequest, SkipReason]]:
    """
    Trigger model training job at 2 AM UTC daily.
    
    This trains the hierarchical Bayesian model for all users
    with sufficient session data.
    """
    now = datetime.utcnow()
    
    # Check if it's between 2:00 and 2:59 AM UTC
    if now.hour == 2:
        # Use date as run key to ensure only one run per day
        run_key = f"nightly_training_{now.strftime('%Y%m%d')}"
        
        yield RunRequest(
            run_key=run_key,
            tags={
                "triggered_by": "nightly_training_sensor",
                "trigger_time": now.isoformat(),
                "schedule": "nightly",
            },
        )
    else:
        yield SkipReason(f"Not training time (current hour: {now.hour} UTC, training at 2 AM)")


@sensor(
    minimum_interval_seconds=1800,  # Check every 30 minutes
    default_status=DefaultSensorStatus.RUNNING,
    description="Triggers model update when users complete sessions",
)
def session_completion_sensor(
    context: SensorEvaluationContext,
) -> Iterator[Union[RunRequest, SkipReason]]:
    """
    Check for recently completed sessions and trigger model updates.
    
    This provides faster feedback by updating user models
    soon after they complete sessions, rather than waiting
    for the nightly batch.
    """
    import os
    from supabase import create_client
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        yield SkipReason("Supabase credentials not configured")
        return
    
    try:
        client = create_client(url, key)
        
        # Check for sessions completed in the last hour that have quality ratings
        one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()
        
        result = client.table('climbing_sessions') \
            .select('user_id', count='exact') \
            .eq('status', 'completed') \
            .not_.is_('session_quality', 'null') \
            .gte('updated_at', one_hour_ago) \
            .execute()
        
        recent_completions = result.count or 0
        
        if recent_completions > 0:
            # Get unique users who completed sessions
            unique_users = len(set(r.get('user_id') for r in (result.data or [])))
            
            run_key = f"session_model_update_{datetime.utcnow().strftime('%Y%m%d_%H%M')}"
            
            yield RunRequest(
                run_key=run_key,
                tags={
                    "triggered_by": "session_completion_sensor",
                    "recent_completions": str(recent_completions),
                    "unique_users": str(unique_users),
                },
            )
        else:
            yield SkipReason("No recently completed sessions")
            
    except Exception as e:
        context.log.error(f"Error checking session completions: {e}")
        yield SkipReason(f"Error: {e}")

