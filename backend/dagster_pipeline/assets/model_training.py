"""
Model Training Assets for Dagster Pipeline

Implements the nightly training pipeline for personalized user models:
1. training_data: Load and prepare session data with actual values
2. trained_model: Hierarchical Bayesian model using PyMC

Key concepts:
- Prior (from expert scenarios) × Likelihood (from real sessions) = Posterior
- Partial pooling allows borrowing strength across users
- Uses actual values when deviations are reported (not planned values)
"""

from dagster import asset, AssetExecutionContext, MetadataValue, Output
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import json

from ..resources import SupabaseResource, LiteraturePriorsResource


# Treatment columns for the model
TREATMENT_COLS = [
    "sleep_hours", 
    "sleep_quality", 
    "stress_level",
    "energy_level", 
    "caffeine_mg", 
    "days_since_hard_session",
    "warmup_duration_min",
    "motivation_level",
    "soreness_level",
    # Structural variables
    "warmup_intensity",
    "main_session_rest_level",
    "hangboard_load"
]


@asset(
    group_name="model_training",
    description="Load all completed sessions with pre/post data for training",
    compute_kind="python",
)
def training_data(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[pd.DataFrame]:
    """
    Load all sessions with pre/post data for training.
    Uses ACTUAL values when deviations are reported.
    
    Key points:
    - Only includes completed sessions with session_quality
    - Uses actual_caffeine_mg etc. when deviated_from_plan is True
    - Properly extracts data from JSONB pre_session_data and post_session_data
    """
    client = supabase.client
    
    # Query completed sessions with pre/post data
    result = client.table('climbing_sessions') \
        .select('*') \
        .eq('status', 'completed') \
        .not_.is_('session_quality', 'null') \
        .order('started_at', desc=False) \
        .execute()
    
    sessions = result.data or []
    context.log.info(f"Found {len(sessions)} completed sessions with quality ratings")
    
    if not sessions:
        return Output(
            pd.DataFrame(columns=['session_id', 'user_id', 'session_quality'] + TREATMENT_COLS),
            metadata={"num_sessions": 0, "num_users": 0}
        )
    
    rows = []
    for session in sessions:
        # Get pre-session data from JSONB or direct columns
        pre = session.get('pre_session_data') or {}
        if isinstance(pre, str):
            try:
                pre = json.loads(pre)
            except:
                pre = {}
        
        # Get post-session data
        post = session.get('post_session_data') or {}
        if isinstance(post, str):
            try:
                post = json.loads(post)
            except:
                post = {}
        
        session_quality = session.get('session_quality')
        if session_quality is None:
            continue
        
        # Check for deviations - use actual values when available
        deviated = session.get('deviated_from_plan', False) or post.get('deviated_from_plan', False)
        
        # Caffeine: use actual if deviated
        caffeine = None
        if deviated and session.get('actual_caffeine_mg') is not None:
            caffeine = session.get('actual_caffeine_mg')
        elif deviated and post.get('actual_caffeine_mg') is not None:
            caffeine = post.get('actual_caffeine_mg')
        else:
            caffeine = session.get('planned_caffeine_mg') or pre.get('planned_caffeine_mg', 0) or 0
        
        # Session type: use actual if deviated
        session_type = None
        if deviated and session.get('actual_session_type'):
            session_type = session.get('actual_session_type')
        elif deviated and post.get('actual_session_type'):
            session_type = post.get('actual_session_type')
        else:
            session_type = session.get('planned_session_type') or pre.get('planned_session_type')
        
        # Warmup: use actual if deviated
        warmup = None
        if deviated and session.get('actual_warmup_min') is not None:
            warmup = session.get('actual_warmup_min')
        elif deviated and post.get('actual_warmup_min') is not None:
            warmup = post.get('actual_warmup_min')
        else:
            warmup = session.get('planned_warmup_min') or pre.get('planned_warmup_min')
        
        # Extract structural variables
        warmup_intensity = _parse_intensity(
            session.get('warmup_intensity') or 
            post.get('warmup_intensity') or 
            pre.get('warmup_intensity')
        )
        
        rest_level = _parse_rest_level(
            session.get('rest_between_attempts') or 
            post.get('rest_between_attempts')
        )
        
        hangboard_load = 1 if (session.get('session_type') == 'hangboard' or 'hangboard' in str(session_type)) else 0

        row = {
            'session_id': session['id'],
            'user_id': session['user_id'],
            'session_quality': session_quality,
            
            # Pre-session factors (from columns or JSONB)
            'sleep_hours': session.get('sleep_hours') or pre.get('sleep_hours'),
            'sleep_quality': session.get('sleep_quality') or pre.get('sleep_quality'),
            'stress_level': session.get('stress_level') or pre.get('stress_level'),
            'energy_level': session.get('energy_level') or pre.get('energy_level'),
            'motivation_level': session.get('motivation') or pre.get('motivation_level'),
            'soreness_level': _parse_soreness(session.get('muscle_soreness') or pre.get('soreness_level')),
            'days_since_hard_session': session.get('days_since_hard_session') or pre.get('days_since_hard_session'),
            
            # Treatment variables (using actual when deviated)
            'caffeine_mg': caffeine,
            'warmup_duration_min': warmup,
            'session_type': session_type,
            'warmup_intensity': warmup_intensity,
            'main_session_rest_level': rest_level,
            'hangboard_load': hangboard_load,
            
            # Metadata
            'deviated': deviated,
            'session_date': session.get('started_at'),
        }
        
        rows.append(row)
    
    df = pd.DataFrame(rows)
    
    # Summary statistics
    n_users = df['user_id'].nunique()
    n_sessions = len(df)
    n_deviated = df['deviated'].sum() if 'deviated' in df.columns else 0
    
    context.log.info(f"Prepared training data: {n_sessions} sessions from {n_users} users ({n_deviated} with deviations)")
    
    return Output(
        df,
        metadata={
            "num_sessions": n_sessions,
            "num_users": n_users,
            "num_deviated": int(n_deviated),
            "avg_quality": float(df['session_quality'].mean()) if len(df) > 0 else 0,
            "date_range": f"{df['session_date'].min()} to {df['session_date'].max()}" if len(df) > 0 else "N/A",
            "preview": MetadataValue.md(df.head(10).to_markdown()) if len(df) > 0 else "No data",
        }
    )


def _parse_soreness(value) -> Optional[int]:
    """Parse soreness value which may be numeric or text."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    # Handle text values like 'none', 'mild', 'moderate', 'severe'
    text_map = {'none': 1, 'mild': 2, 'moderate': 3, 'severe': 4, 'very_severe': 5}
    return text_map.get(str(value).lower(), None)


def _parse_intensity(value) -> int:
    """Parse intensity string to 1-5 scale"""
    if value is None: return 3  # Default to moderate
    if isinstance(value, (int, float)): return int(value)
    text_map = {
        'very_light': 1, 'light': 2, 'moderate': 3, 
        'hard': 4, 'high': 4, 'max': 5, 'extreme': 5
    }
    return text_map.get(str(value).lower(), 3)


def _parse_rest_level(value) -> int:
    """Parse rest level string to 1-3 scale"""
    if value is None: return 2  # Default to medium
    if isinstance(value, (int, float)): return int(value)
    text_map = {'short': 1, 'medium': 2, 'long': 3}
    return text_map.get(str(value).lower(), 2)


@asset(
    group_name="model_training",
    description="Train hierarchical Bayesian model using PyMC",
    compute_kind="python",
)
def trained_model(
    context: AssetExecutionContext,
    training_data: pd.DataFrame,
    supabase: SupabaseResource,
    literature_priors: LiteraturePriorsResource,
) -> Output[Dict[str, Any]]:
    """
    Train hierarchical Bayesian model using PyMC.
    
    Model structure:
    - Population-level priors from expert scenarios + literature
    - User-level random effects (partial pooling)
    - User coefficient = population + personal offset
    
    Prior × Likelihood = Posterior
    """
    client = supabase.client
    
    if training_data.empty:
        context.log.info("No training data available, skipping model training")
        return Output(
            {"status": "skipped", "reason": "no_training_data"},
            metadata={"status": "skipped"}
        )
    
    # Load current blended priors
    priors_result = client.table('population_priors') \
        .select('*') \
        .eq('is_current', True) \
        .execute()
    
    db_priors = {p['variable_name']: p for p in (priors_result.data or [])}
    lit_priors = literature_priors.get_all_priors()
    
    # Merge priors (DB takes precedence)
    priors = {}
    for var in TREATMENT_COLS:
        if var in db_priors:
            priors[var] = {
                'mean': float(db_priors[var]['population_mean']),
                'std': float(db_priors[var]['population_std']),
                'individual_variance': float(db_priors[var].get('individual_variance', 0.2))
            }
        elif var in lit_priors:
            priors[var] = {
                'mean': float(lit_priors[var].get('mean', 0)),
                'std': float(lit_priors[var].get('std', 0.3)),
                'individual_variance': 0.2
            }
        else:
            priors[var] = {'mean': 0.0, 'std': 0.3, 'individual_variance': 0.2}
    
    context.log.info(f"Loaded priors for {len(priors)} variables")
    
    # Prepare data
    df = training_data.copy()
    
    # Get users with at least 3 sessions for training
    user_session_counts = df.groupby('user_id').size()
    valid_users = user_session_counts[user_session_counts >= 3].index.tolist()
    
    if not valid_users:
        context.log.info("No users with sufficient sessions for training")
        return Output(
            {"status": "skipped", "reason": "insufficient_user_data"},
            metadata={"status": "skipped", "users_evaluated": 0}
        )
    
    df_train = df[df['user_id'].isin(valid_users)].copy()
    context.log.info(f"Training on {len(df_train)} sessions from {len(valid_users)} users")
    
    # Encode users
    user_ids = df_train['user_id'].unique()
    user_to_idx = {uid: i for i, uid in enumerate(user_ids)}
    df_train['user_idx'] = df_train['user_id'].map(user_to_idx)
    
    n_users = len(user_ids)
    
    # Prepare treatment matrix
    X = df_train[TREATMENT_COLS].fillna(0).values.astype(float)
    y = df_train['session_quality'].values.astype(float)
    user_idx = df_train['user_idx'].values.astype(int)
    
    # Try PyMC training, fall back to simple estimation if not available
    try:
        coefficients_by_user = _train_with_pymc(
            X, y, user_idx, n_users, TREATMENT_COLS, priors, context
        )
    except ImportError:
        context.log.warning("PyMC not available, using simple estimation")
        coefficients_by_user = _train_simple(
            X, y, user_idx, n_users, user_ids, TREATMENT_COLS, priors
        )
    except Exception as e:
        context.log.error(f"Training failed: {e}")
        context.log.info("Falling back to simple estimation")
        coefficients_by_user = _train_simple(
            X, y, user_idx, n_users, user_ids, TREATMENT_COLS, priors
        )
    
    # Save model outputs to database
    users_updated = 0
    for i, user_id in enumerate(user_ids):
        coefficients = coefficients_by_user.get(i, {})
        n_sessions = len(df_train[df_train['user_id'] == user_id])
        
        # Determine phase
        if n_sessions < 10:
            phase = 'cold_start'
        elif n_sessions < 30:
            phase = 'learning'
        else:
            phase = 'personalized'
        
        # Calculate shrinkage factor (simplified)
        # More sessions = less shrinkage toward population
        shrinkage = min(0.9, n_sessions / 50)
        
        model_output = {
            'user_id': str(user_id),
            'coefficients': coefficients.get('coefficients', {}),
            'confidence_intervals': coefficients.get('confidence_intervals', {}),
            'sessions_included': n_sessions,
            'phase': phase,
            'shrinkage_factor': float(shrinkage),
            'last_trained_at': datetime.utcnow().isoformat(),
            'model_version': 'hierarchical_v1'
        }
        
        try:
            client.table('model_outputs').upsert(
                model_output,
                on_conflict='user_id'
            ).execute()
            users_updated += 1
        except Exception as e:
            context.log.warning(f"Failed to save model for user {user_id}: {e}")
    
    context.log.info(f"Updated model outputs for {users_updated} users")
    
    return Output(
        {
            "status": "success",
            "n_users": users_updated,
            "n_sessions": len(df_train),
            "treatment_variables": TREATMENT_COLS,
            "timestamp": datetime.utcnow().isoformat()
        },
        metadata={
            "status": "success",
            "users_trained": users_updated,
            "total_sessions": len(df_train),
            "avg_sessions_per_user": float(len(df_train) / len(valid_users)) if valid_users else 0,
        }
    )


def _train_with_pymc(
    X: np.ndarray,
    y: np.ndarray,
    user_idx: np.ndarray,
    n_users: int,
    treatment_cols: List[str],
    priors: Dict,
    context
) -> Dict[int, Dict]:
    """
    Train hierarchical Bayesian model using PyMC.
    
    Model:
    y_i ~ Normal(mu_i, sigma_obs)
    mu_i = intercept + X_i @ beta[user_i]
    beta[user_i] ~ Normal(beta_pop, sigma_user)
    beta_pop ~ Normal(prior_mean, prior_std)
    """
    import pymc as pm
    import arviz as az
    
    context.log.info("Training with PyMC hierarchical model")
    
    with pm.Model() as model:
        # Population-level priors (FROM EXPERT SCENARIOS + LITERATURE)
        beta_pop = []
        sigma_user = []
        
        for i, col in enumerate(treatment_cols):
            prior = priors.get(col, {"mean": 0, "std": 0.3, "individual_variance": 0.2})
            
            beta_pop.append(pm.Normal(
                f"beta_pop_{col}",
                mu=prior["mean"],
                sigma=prior["std"]
            ))
            
            sigma_user.append(pm.HalfNormal(
                f"sigma_user_{col}",
                sigma=np.sqrt(prior.get("individual_variance", 0.2))
            ))
        
        beta_pop_tensor = pm.math.stack(beta_pop)
        sigma_user_tensor = pm.math.stack(sigma_user)
        
        # User-level random effects (partial pooling)
        user_offset = pm.Normal(
            "user_offset",
            mu=0,
            sigma=sigma_user_tensor,
            shape=(n_users, len(treatment_cols))
        )
        
        # Each user's coefficient = population + personal offset
        user_beta = beta_pop_tensor + user_offset
        
        # Intercept
        intercept = pm.Normal("intercept", mu=5.0, sigma=1.0)
        
        # Linear predictor
        mu = intercept + (user_beta[user_idx] * X).sum(axis=1)
        
        # Observation noise
        sigma_obs = pm.HalfNormal("sigma_obs", sigma=1.5)
        
        # Likelihood (FROM REAL SESSIONS)
        y_obs = pm.Normal("y_obs", mu=mu, sigma=sigma_obs, observed=y)
        
        # Sample
        trace = pm.sample(
            500,  # Reduced for speed
            tune=300,
            cores=1,  # Single core for deployment compatibility
            return_inferencedata=True,
            progressbar=False
        )
    
    context.log.info("PyMC sampling complete, extracting posteriors")
    
    # Extract posteriors for each user
    coefficients_by_user = {}
    
    beta_pop_samples = trace.posterior["beta_pop_" + treatment_cols[0]].values  # Get shape
    
    for i in range(n_users):
        user_coefs = {}
        user_ci = {}
        
        # Get user-specific coefficients
        for j, col in enumerate(treatment_cols):
            pop_samples = trace.posterior[f"beta_pop_{col}"].values.flatten()
            offset_samples = trace.posterior["user_offset"].values[:, :, i, j].flatten()
            
            user_samples = pop_samples + offset_samples
            
            user_coefs[col] = float(np.mean(user_samples))
            user_ci[col] = [
                float(np.percentile(user_samples, 2.5)),
                float(np.percentile(user_samples, 97.5))
            ]
        
        # Add intercept
        intercept_samples = trace.posterior["intercept"].values.flatten()
        user_coefs["intercept"] = float(np.mean(intercept_samples))
        user_ci["intercept"] = [
            float(np.percentile(intercept_samples, 2.5)),
            float(np.percentile(intercept_samples, 97.5))
        ]
        
        coefficients_by_user[i] = {
            "coefficients": user_coefs,
            "confidence_intervals": user_ci
        }
    
    return coefficients_by_user


def _train_simple(
    X: np.ndarray,
    y: np.ndarray,
    user_idx: np.ndarray,
    n_users: int,
    user_ids: np.ndarray,
    treatment_cols: List[str],
    priors: Dict
) -> Dict[int, Dict]:
    """
    Simple estimation fallback when PyMC is not available.
    Uses shrinkage toward population priors based on sample size.
    """
    from sklearn.linear_model import Ridge
    
    coefficients_by_user = {}
    
    for i in range(n_users):
        # Get user data
        mask = user_idx == i
        X_user = X[mask]
        y_user = y[mask]
        n_samples = len(y_user)
        
        if n_samples < 3:
            # Use population priors
            user_coefs = {col: priors.get(col, {}).get('mean', 0) for col in treatment_cols}
            user_coefs['intercept'] = 5.0
            user_ci = {col: [user_coefs[col] - 0.5, user_coefs[col] + 0.5] for col in treatment_cols}
        else:
            # Fit Ridge regression with regularization toward priors
            model = Ridge(alpha=1.0)
            model.fit(X_user, y_user)
            
            # Shrink toward priors based on sample size
            shrinkage = min(0.9, n_samples / 30)
            
            user_coefs = {}
            user_ci = {}
            
            for j, col in enumerate(treatment_cols):
                prior_mean = priors.get(col, {}).get('mean', 0)
                fitted = model.coef_[j]
                
                # Shrinkage: coef = shrinkage * fitted + (1-shrinkage) * prior
                user_coefs[col] = float(shrinkage * fitted + (1 - shrinkage) * prior_mean)
                
                # Simple CI estimate
                se = priors.get(col, {}).get('std', 0.3) / np.sqrt(n_samples)
                user_ci[col] = [user_coefs[col] - 1.96 * se, user_coefs[col] + 1.96 * se]
            
            user_coefs['intercept'] = float(model.intercept_)
            user_ci['intercept'] = [model.intercept_ - 0.5, model.intercept_ + 0.5]
        
        coefficients_by_user[i] = {
            "coefficients": user_coefs,
            "confidence_intervals": user_ci
        }
    
    return coefficients_by_user


@asset(
    group_name="model_training",
    description="Population statistics computed from all user sessions",
    compute_kind="python",
)
def population_statistics(
    context: AssetExecutionContext,
    training_data: pd.DataFrame,
    supabase: SupabaseResource,
) -> Output[Dict[str, Dict[str, float]]]:
    """
    Compute population-level statistics from all sessions.
    Used for z-score comparisons in recommendations.
    """
    if training_data.empty:
        return Output({}, metadata={"status": "no_data"})
    
    stats = {}
    
    # Compute mean and std for each variable
    for col in TREATMENT_COLS + ['session_quality']:
        if col in training_data.columns:
            values = training_data[col].dropna()
            if len(values) > 0:
                # All values must be floats to satisfy Dagster type Dict[str, Dict[str, float]]
                stats[col] = {
                    'mean': float(values.mean()),
                    'std': float(values.std()) if len(values) > 1 else 0.1,
                    'min': float(values.min()),
                    'max': float(values.max()),
                    # Cast count to float to pass type check (semantic int but represented as float)
                    'n': float(len(values)),
                }
    
    # Save to database (could be a separate table, using population_priors metadata for now)
    client = supabase.client
    
    for var, var_stats in stats.items():
        try:
            client.table('population_priors').update({
                'metadata': {
                    'population_observed_mean': var_stats['mean'],
                    'population_observed_std': var_stats['std'],
                    'n_observations': var_stats['n'],
                    'last_computed': datetime.utcnow().isoformat()
                }
            }).eq('variable_name', var).execute()
        except Exception:
            pass  # Variable may not exist in priors table
    
    context.log.info(f"Computed population statistics for {len(stats)} variables")
    
    return Output(
        stats,
        metadata={
            "num_variables": len(stats),
            "total_sessions": len(training_data),
            "avg_quality": float(stats.get('session_quality', {}).get('mean', 0)),
        }
    )

