"""
Statistical Context Service for ClimbIQ

Computes comparison metrics for recommendations:
- Population comparisons (z-scores, percentiles)
- Personal history comparisons
- Coefficient comparisons

This provides the "why" behind recommendations.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from scipy import stats
import numpy as np


@dataclass
class StatisticalContext:
    """Container for all statistical context data"""
    population_comparisons: Dict[str, Dict[str, Any]]
    coefficient_comparisons: Dict[str, Dict[str, Any]]
    personal_history: Dict[str, Any]
    summary: Dict[str, Any]
    
    def dict(self) -> Dict[str, Any]:
        return asdict(self)


def get_descriptor(z_score: float) -> str:
    """Convert z-score to human-readable descriptor."""
    if z_score >= 2.0:
        return "very high"
    elif z_score >= 1.0:
        return "above average"
    elif z_score >= -1.0:
        return "typical"
    elif z_score >= -2.0:
        return "below average"
    else:
        return "very low"


def get_effect_descriptor(z_score: float) -> str:
    """Describe how a user's coefficient compares to population."""
    if z_score >= 1.5:
        return "much more strongly than average"
    elif z_score >= 0.5:
        return "more strongly than average"
    elif z_score >= -0.5:
        return "about average"
    elif z_score >= -1.5:
        return "less strongly than average"
    else:
        return "much less strongly than average"


def compute_statistical_context(
    current_conditions: Dict[str, Any],
    user_history: List[Dict[str, Any]],
    population_stats: Dict[str, Dict[str, Any]],
    user_coefficients: Dict[str, float]
) -> StatisticalContext:
    """
    Compute comprehensive statistical context for recommendations.
    
    Args:
        current_conditions: User's current pre-session data
        user_history: List of user's past sessions with pre/post data
        population_stats: Population-level statistics for variables and coefficients
        user_coefficients: User's personalized coefficients
    
    Returns:
        StatisticalContext with all comparison metrics
    """
    population_comparisons = {}
    coefficient_comparisons = {}
    personal_history = {}
    
    # --- POPULATION COMPARISONS FOR CURRENT CONDITIONS ---
    condition_variables = [
        "sleep_hours", "sleep_quality", "stress_level", "energy_level",
        "motivation_level", "soreness_level", "days_since_hard_session"
    ]
    
    for variable in condition_variables:
        if variable in current_conditions and variable in population_stats:
            pop = population_stats[variable]
            user_value = current_conditions[variable]
            
            if pop.get("std", 0) > 0:
                z_score = (user_value - pop.get("mean", 0)) / pop["std"]
                percentile = stats.norm.cdf(z_score) * 100
                
                population_comparisons[variable] = {
                    "user_value": user_value,
                    "pop_mean": pop.get("mean"),
                    "pop_std": pop.get("std"),
                    "z_score": float(round(z_score, 2)),
                    "percentile": float(round(percentile, 1)),
                    "descriptor": get_descriptor(z_score)
                }
    
    # --- COEFFICIENT COMPARISONS ---
    # Compare user's learned coefficients to population averages
    coefficient_variables = [
        "sleep_hours", "sleep_quality", "stress_level", "caffeine_mg",
        "energy_level", "days_since_hard_session", "warmup_duration_min"
    ]
    
    for coef_name in coefficient_variables:
        if coef_name in user_coefficients:
            user_coef = user_coefficients[coef_name]
            pop_coef_key = f"{coef_name}_coefficient"
            
            if pop_coef_key in population_stats:
                pop_coef = population_stats[pop_coef_key]
                if pop_coef.get("std", 0) > 0:
                    z_score = (user_coef - pop_coef.get("mean", 0)) / pop_coef["std"]
                    percentile = stats.norm.cdf(z_score) * 100
                    
                    coefficient_comparisons[coef_name] = {
                        "user_coefficient": float(round(user_coef, 4)),
                        "pop_mean": pop_coef.get("mean"),
                        "pop_std": pop_coef.get("std"),
                        "z_score": float(round(z_score, 2)),
                        "percentile": float(round(percentile, 1)),
                        "descriptor": get_effect_descriptor(z_score),
                        "explanation": _generate_coefficient_explanation(coef_name, z_score)
                    }
    
    # --- PERSONAL HISTORY COMPARISONS ---
    if user_history:
        personal_history = _compute_personal_history_context(
            current_conditions, user_history
        )
    
    # --- SUMMARY ---
    summary = _generate_summary(
        current_conditions,
        population_comparisons,
        coefficient_comparisons,
        personal_history
    )
    
    return StatisticalContext(
        population_comparisons=population_comparisons,
        coefficient_comparisons=coefficient_comparisons,
        personal_history=personal_history,
        summary=summary
    )


def _compute_personal_history_context(
    current_conditions: Dict[str, Any],
    user_history: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Compute comparisons to user's own history."""
    context = {}
    
    # Extract session qualities from history
    qualities = []
    for session in user_history:
        post = session.get("post_session_data", {})
        if isinstance(post, dict):
            quality = post.get("session_quality")
            if quality is not None:
                qualities.append(quality)
    
    if qualities:
        context["overall_stats"] = {
            "n_sessions": len(qualities),
            "avg_quality": float(round(np.mean(qualities), 2)),
            "std_quality": float(round(np.std(qualities), 2)) if len(qualities) > 1 else 0,
            "best_quality": max(qualities),
            "worst_quality": min(qualities)
        }
    
    # High stress session analysis
    current_stress = current_conditions.get("stress_level", 3)
    high_stress_sessions = [
        s for s in user_history
        if _get_pre_value(s, "stress_level", 0) >= 4
    ]
    
    if high_stress_sessions:
        # Compare outcomes by session type under high stress
        project_sessions = [
            s for s in high_stress_sessions
            if _get_pre_value(s, "planned_session_type", "") == "project"
        ]
        volume_sessions = [
            s for s in high_stress_sessions
            if _get_pre_value(s, "planned_session_type", "") == "volume"
        ]
        
        project_qualities = [_get_post_value(s, "session_quality") for s in project_sessions if _get_post_value(s, "session_quality")]
        volume_qualities = [_get_post_value(s, "session_quality") for s in volume_sessions if _get_post_value(s, "session_quality")]
        
        context["high_stress_analysis"] = {
            "n_sessions": len(high_stress_sessions),
            "avg_quality_project": float(round(np.mean(project_qualities), 2)) if project_qualities else None,
            "avg_quality_volume": float(round(np.mean(volume_qualities), 2)) if volume_qualities else None,
            "n_project": len(project_sessions),
            "n_volume": len(volume_sessions),
            "recommendation": _stress_recommendation(project_qualities, volume_qualities)
        }
        
        # Is current stress high?
        if current_stress >= 4:
            context["current_stress_note"] = (
                f"Your stress is elevated ({current_stress}/5). "
                f"Based on {len(high_stress_sessions)} past high-stress sessions, "
                f"we have personalized insights for you."
            )
    
    # Sleep analysis
    current_sleep = current_conditions.get("sleep_hours")
    if current_sleep is not None:
        low_sleep_sessions = [
            s for s in user_history
            if _get_pre_value(s, "sleep_hours", 8) < 6
        ]
        good_sleep_sessions = [
            s for s in user_history
            if _get_pre_value(s, "sleep_hours", 8) >= 7
        ]
        
        low_sleep_qualities = [_get_post_value(s, "session_quality") for s in low_sleep_sessions if _get_post_value(s, "session_quality")]
        good_sleep_qualities = [_get_post_value(s, "session_quality") for s in good_sleep_sessions if _get_post_value(s, "session_quality")]
        
        if low_sleep_qualities and good_sleep_qualities:
            context["sleep_analysis"] = {
                "low_sleep_avg": float(round(np.mean(low_sleep_qualities), 2)),
                "good_sleep_avg": float(round(np.mean(good_sleep_qualities), 2)),
                "difference": float(round(np.mean(good_sleep_qualities) - np.mean(low_sleep_qualities), 2)),
                "n_low_sleep": len(low_sleep_sessions),
                "n_good_sleep": len(good_sleep_sessions)
            }
            
            if current_sleep < 6:
                context["current_sleep_note"] = (
                    f"Your sleep ({current_sleep}h) is below optimal. "
                    f"Your average quality with <6h sleep is {context['sleep_analysis']['low_sleep_avg']}/10 "
                    f"vs {context['sleep_analysis']['good_sleep_avg']}/10 with 7+h."
                )
    
    # Caffeine analysis
    current_caffeine = current_conditions.get("planned_caffeine_mg", 0)
    high_caffeine_sessions = [
        s for s in user_history
        if _get_actual_caffeine(s) >= 200
    ]
    low_caffeine_sessions = [
        s for s in user_history
        if _get_actual_caffeine(s) < 50
    ]
    
    high_caffeine_qualities = [_get_post_value(s, "session_quality") for s in high_caffeine_sessions if _get_post_value(s, "session_quality")]
    low_caffeine_qualities = [_get_post_value(s, "session_quality") for s in low_caffeine_sessions if _get_post_value(s, "session_quality")]
    
    if high_caffeine_qualities and low_caffeine_qualities:
        context["caffeine_analysis"] = {
            "high_caffeine_avg": float(round(np.mean(high_caffeine_qualities), 2)),
            "low_caffeine_avg": float(round(np.mean(low_caffeine_qualities), 2)),
            "n_high": len(high_caffeine_sessions),
            "n_low": len(low_caffeine_sessions),
            "personal_response": "positive" if np.mean(high_caffeine_qualities) > np.mean(low_caffeine_qualities) else "neutral_or_negative"
        }
    
    # Days since session analysis
    current_days = current_conditions.get("days_since_hard_session")
    if current_days is not None:
        # Group by recovery time
        short_recovery = [s for s in user_history if _get_pre_value(s, "days_since_hard_session", 3) <= 1]
        optimal_recovery = [s for s in user_history if 2 <= _get_pre_value(s, "days_since_hard_session", 3) <= 4]
        long_recovery = [s for s in user_history if _get_pre_value(s, "days_since_hard_session", 3) >= 5]
        
        short_qualities = [_get_post_value(s, "session_quality") for s in short_recovery if _get_post_value(s, "session_quality")]
        optimal_qualities = [_get_post_value(s, "session_quality") for s in optimal_recovery if _get_post_value(s, "session_quality")]
        long_qualities = [_get_post_value(s, "session_quality") for s in long_recovery if _get_post_value(s, "session_quality")]
        
        context["recovery_analysis"] = {
            "short_recovery_avg": float(round(np.mean(short_qualities), 2)) if short_qualities else None,
            "optimal_recovery_avg": float(round(np.mean(optimal_qualities), 2)) if optimal_qualities else None,
            "long_recovery_avg": float(round(np.mean(long_qualities), 2)) if long_qualities else None,
            "n_short": len(short_recovery),
            "n_optimal": len(optimal_recovery),
            "n_long": len(long_recovery)
        }
    
    return context


def _get_pre_value(session: Dict, key: str, default: Any = None) -> Any:
    """Safely get pre-session value from session dict."""
    pre = session.get("pre_session_data", {})
    if isinstance(pre, dict):
        return pre.get(key, default)
    return default


def _get_post_value(session: Dict, key: str, default: Any = None) -> Any:
    """Safely get post-session value from session dict."""
    post = session.get("post_session_data", {})
    if isinstance(post, dict):
        return post.get(key, default)
    return default


def _get_actual_caffeine(session: Dict) -> int:
    """Get actual caffeine consumed (accounting for deviations)."""
    post = session.get("post_session_data", {})
    if isinstance(post, dict) and post.get("deviated_from_plan"):
        actual = post.get("actual_caffeine_mg")
        if actual is not None:
            return actual
    
    pre = session.get("pre_session_data", {})
    if isinstance(pre, dict):
        return pre.get("planned_caffeine_mg", 0)
    return 0


def _stress_recommendation(project_qualities: List, volume_qualities: List) -> str:
    """Generate recommendation based on stress analysis."""
    if not project_qualities and not volume_qualities:
        return "insufficient_data"
    
    project_avg = np.mean(project_qualities) if project_qualities else 0
    volume_avg = np.mean(volume_qualities) if volume_qualities else 0
    
    if volume_avg > project_avg + 0.5:
        return "Consider volume sessions when stressed - you tend to perform better"
    elif project_avg > volume_avg + 0.5:
        return "You handle projecting well even when stressed"
    else:
        return "Your stress doesn't seem to significantly affect session type outcomes"


def _generate_coefficient_explanation(coef_name: str, z_score: float) -> str:
    """Generate natural language explanation for coefficient comparison."""
    explanations = {
        "sleep_hours": {
            "high": "You benefit more than average from additional sleep",
            "low": "Sleep hours affect you less than most climbers",
            "avg": "Sleep affects your performance about average"
        },
        "sleep_quality": {
            "high": "Sleep quality is especially important for your performance",
            "low": "You're less affected by poor sleep quality than average",
            "avg": "Sleep quality matters about average for you"
        },
        "stress_level": {
            "high": "Stress impacts your climbing more than most - prioritize stress management",
            "low": "You handle stress well compared to most climbers",
            "avg": "Stress affects your performance about average"
        },
        "caffeine_mg": {
            "high": "You respond strongly to caffeine - use strategically",
            "low": "Caffeine has minimal effect on your performance",
            "avg": "You have a typical caffeine response"
        },
        "energy_level": {
            "high": "Your energy level is a strong predictor of session quality",
            "low": "You can perform well even when feeling low energy",
            "avg": "Energy affects your performance about average"
        },
        "days_since_hard_session": {
            "high": "Recovery time is especially important for you",
            "low": "You recover faster than most climbers",
            "avg": "You need typical recovery time between hard sessions"
        },
        "warmup_duration_min": {
            "high": "Thorough warmups are especially important for your performance",
            "low": "You can perform well with shorter warmups",
            "avg": "Warmup duration affects you about average"
        }
    }
    
    if z_score >= 0.5:
        level = "high"
    elif z_score <= -0.5:
        level = "low"
    else:
        level = "avg"
    
    return explanations.get(coef_name, {}).get(level, "Personal effect compared to population")


def _generate_summary(
    current_conditions: Dict,
    population_comparisons: Dict,
    coefficient_comparisons: Dict,
    personal_history: Dict
) -> Dict[str, Any]:
    """Generate high-level summary insights."""
    summary = {
        "key_insights": [],
        "strengths": [],
        "areas_to_watch": []
    }
    
    # Identify standout current conditions
    for var, comp in population_comparisons.items():
        z = comp.get("z_score", 0)
        if z <= -1.5:
            summary["areas_to_watch"].append(
                f"{var.replace('_', ' ').title()} is low ({comp['descriptor']})"
            )
        elif z >= 1.5:
            summary["strengths"].append(
                f"{var.replace('_', ' ').title()} is excellent ({comp['descriptor']})"
            )
    
    # Identify personal coefficient strengths
    for coef, comp in coefficient_comparisons.items():
        z = comp.get("z_score", 0)
        if z >= 1.0 and coef in ["energy_level", "sleep_hours", "warmup_duration_min"]:
            summary["key_insights"].append(comp.get("explanation", ""))
        elif z <= -1.0 and coef in ["stress_level"]:
            summary["key_insights"].append(comp.get("explanation", ""))
    
    # Add personal history insights
    if personal_history.get("current_stress_note"):
        summary["key_insights"].append(personal_history["current_stress_note"])
    if personal_history.get("current_sleep_note"):
        summary["key_insights"].append(personal_history["current_sleep_note"])
    
    return summary


# Convenience function for quick z-score calculation
def calculate_z_score(value: float, mean: float, std: float) -> float:
    """Calculate z-score for a value."""
    if std <= 0:
        return 0.0
    return (value - mean) / std


def calculate_percentile(z_score: float) -> float:
    """Calculate percentile from z-score."""
    return stats.norm.cdf(z_score) * 100

