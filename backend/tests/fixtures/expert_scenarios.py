"""
Expert Scenario Seeder for Learning Loop Tests

Seeds baseline expert scenarios and responses that establish
initial population priors for the recommendation engine.
"""

from typing import List, Dict, Any
from datetime import datetime
import uuid


# Predefined expert scenarios covering common climbing situations
EXPERT_SCENARIOS = [
    # Scenario 1: Well-rested, high motivation - optimal for projecting
    {
        "name": "optimal_project_day",
        "description": "Well-rested climber with high motivation and energy",
        "pre_session_snapshot": {
            "sleep_quality": 8,
            "energy_level": 8,
            "motivation": 9,
            "stress_level": 3,
            "muscle_soreness": 2,
            "finger_tendon_health": 9,
        },
        "expert_response": {
            "recommended_session_type": "project",
            "predicted_quality_optimal": 8.5,
            "recommended_duration_minutes": 120,
            "warmup_intensity": "moderate",
            "main_session_intensity": "high",
            "key_drivers": ["sleep_quality", "motivation", "finger_tendon_health"],
            "reasoning": "Optimal conditions for high-intensity projecting. "
                        "Full warmup, prioritize limit bouldering.",
        },
    },
    # Scenario 2: Poor sleep, moderate energy - technique focus
    {
        "name": "poor_sleep_technique_day",
        "description": "Poor sleep but moderate energy - shift to technique",
        "pre_session_snapshot": {
            "sleep_quality": 4,
            "energy_level": 5,
            "motivation": 6,
            "stress_level": 6,
            "muscle_soreness": 4,
            "finger_tendon_health": 7,
        },
        "expert_response": {
            "recommended_session_type": "technique",
            "predicted_quality_optimal": 5.5,
            "recommended_duration_minutes": 90,
            "warmup_intensity": "extended",
            "main_session_intensity": "moderate",
            "key_drivers": ["sleep_quality", "stress_level"],
            "reasoning": "Poor sleep reduces power output and injury risk increases. "
                        "Focus on movement quality at lower grades.",
        },
    },
    # Scenario 3: High stress, finger concern - active recovery
    {
        "name": "high_stress_finger_concern",
        "description": "Elevated stress and finger tendon fatigue",
        "pre_session_snapshot": {
            "sleep_quality": 6,
            "energy_level": 6,
            "motivation": 5,
            "stress_level": 8,
            "muscle_soreness": 5,
            "finger_tendon_health": 4,
        },
        "expert_response": {
            "recommended_session_type": "active_recovery",
            "predicted_quality_optimal": 4.0,
            "recommended_duration_minutes": 60,
            "warmup_intensity": "gentle",
            "main_session_intensity": "low",
            "key_drivers": ["finger_tendon_health", "stress_level"],
            "reasoning": "Low finger health demands caution. Light climbing with "
                        "emphasis on antagonist exercises and mobility work.",
        },
    },
    # Scenario 4: Recovery day needed - rest recommended
    {
        "name": "rest_day_needed",
        "description": "Low energy, high soreness - rest recommended",
        "pre_session_snapshot": {
            "sleep_quality": 5,
            "energy_level": 3,
            "motivation": 4,
            "stress_level": 7,
            "muscle_soreness": 8,
            "finger_tendon_health": 5,
        },
        "expert_response": {
            "recommended_session_type": "rest_day",
            "predicted_quality_optimal": 3.0,
            "recommended_duration_minutes": 0,
            "warmup_intensity": None,
            "main_session_intensity": None,
            "key_drivers": ["energy_level", "muscle_soreness"],
            "reasoning": "High soreness and low energy indicate accumulated fatigue. "
                        "Complete rest or very light stretching only.",
        },
    },
    # Scenario 5: Good conditions for volume
    {
        "name": "volume_day_conditions",
        "description": "Balanced readiness suitable for volume training",
        "pre_session_snapshot": {
            "sleep_quality": 7,
            "energy_level": 7,
            "motivation": 7,
            "stress_level": 4,
            "muscle_soreness": 3,
            "finger_tendon_health": 8,
        },
        "expert_response": {
            "recommended_session_type": "volume",
            "predicted_quality_optimal": 7.0,
            "recommended_duration_minutes": 100,
            "warmup_intensity": "moderate",
            "main_session_intensity": "moderate",
            "key_drivers": ["energy_level", "motivation"],
            "reasoning": "Good overall readiness with healthy fingers. "
                        "High volume at moderate intensity builds base fitness.",
        },
    },
    # Scenario 6: High motivation but soreness - modified session
    {
        "name": "motivated_but_sore",
        "description": "High motivation despite muscle soreness",
        "pre_session_snapshot": {
            "sleep_quality": 7,
            "energy_level": 6,
            "motivation": 9,
            "stress_level": 4,
            "muscle_soreness": 7,
            "finger_tendon_health": 7,
        },
        "expert_response": {
            "recommended_session_type": "technique",
            "predicted_quality_optimal": 6.0,
            "recommended_duration_minutes": 75,
            "warmup_intensity": "extended",
            "main_session_intensity": "moderate",
            "key_drivers": ["muscle_soreness", "motivation"],
            "reasoning": "High motivation can mask fatigue signals. Honor soreness "
                        "with extended warmup and technique focus to stay productive.",
        },
    },
    # Scenario 7: Post-rest day freshness
    {
        "name": "fresh_after_rest",
        "description": "Coming back fresh after rest day(s)",
        "pre_session_snapshot": {
            "sleep_quality": 8,
            "energy_level": 9,
            "motivation": 8,
            "stress_level": 3,
            "muscle_soreness": 1,
            "finger_tendon_health": 9,
        },
        "expert_response": {
            "recommended_session_type": "project",
            "predicted_quality_optimal": 9.0,
            "recommended_duration_minutes": 120,
            "warmup_intensity": "thorough",
            "main_session_intensity": "high",
            "key_drivers": ["energy_level", "muscle_soreness", "finger_tendon_health"],
            "reasoning": "Peak readiness after recovery. Extended warmup important "
                        "since body hasn't moved recently, then push limits.",
        },
    },
    # Scenario 8: Evening session after work stress
    {
        "name": "post_work_evening",
        "description": "Evening session after stressful work day",
        "pre_session_snapshot": {
            "sleep_quality": 7,
            "energy_level": 5,
            "motivation": 6,
            "stress_level": 7,
            "muscle_soreness": 3,
            "finger_tendon_health": 8,
        },
        "expert_response": {
            "recommended_session_type": "technique",
            "predicted_quality_optimal": 5.5,
            "recommended_duration_minutes": 80,
            "warmup_intensity": "moderate",
            "main_session_intensity": "moderate",
            "key_drivers": ["stress_level", "energy_level"],
            "reasoning": "Mental fatigue from work stress affects performance ceiling. "
                        "Climbing can relieve stress but avoid high-pressure attempts.",
        },
    },
]

# Session outcome patterns for simulation
SESSION_PATTERNS = {
    "consistently_good": {
        "description": "Reliable performer hitting predictions",
        "session_quality": [7, 8, 7, 8, 8, 7, 8],
        "fatigue_post": [5, 5, 6, 5, 5, 6, 5],
    },
    "declining_performance": {
        "description": "Signs of accumulated fatigue",
        "session_quality": [8, 7, 6, 5, 5, 4, 4],
        "fatigue_post": [4, 5, 6, 7, 7, 8, 8],
    },
    "improving_beginner": {
        "description": "Beginner showing adaptation gains",
        "session_quality": [5, 5, 6, 6, 7, 7, 8],
        "fatigue_post": [7, 6, 6, 5, 5, 5, 4],
    },
    "overtraining_signal": {
        "description": "Classic overtraining pattern",
        "session_quality": [8, 8, 7, 6, 5, 4, 3],
        "fatigue_post": [5, 6, 7, 8, 8, 9, 9],
    },
    "variable_performer": {
        "description": "Inconsistent session quality",
        "session_quality": [7, 5, 8, 4, 7, 6, 8],
        "fatigue_post": [5, 6, 4, 7, 5, 6, 4],
    },
}

# Test user profiles
TEST_USER_PROFILES = {
    "average_climber": {
        "max_grade": "V5",
        "years_climbing": 2,
        "sessions_per_week": 3,
        "focus_areas": ["technique", "power"],
    },
    "recovering_from_injury": {
        "max_grade": "V6",
        "years_climbing": 4,
        "finger_injury_history": True,
        "weeks_since_injury": 4,
        "focus_areas": ["technique", "mobility"],
    },
    "high_volume_trainer": {
        "max_grade": "V7",
        "years_climbing": 5,
        "sessions_per_week": 5,
        "prefers_volume": True,
        "focus_areas": ["endurance", "volume"],
    },
    "power_focused": {
        "max_grade": "V8",
        "years_climbing": 6,
        "sessions_per_week": 4,
        "focus_areas": ["power", "limit_bouldering"],
    },
}


async def seed_expert_scenarios(supabase_client) -> List[str]:
    """
    Seed baseline expert scenarios and responses into the database.

    Returns:
        List of created scenario IDs.
    """
    scenario_ids = []

    for scenario in EXPERT_SCENARIOS:
        # Create the synthetic scenario
        scenario_data = {
            "id": str(uuid.uuid4()),
            "name": scenario["name"],
            "description": scenario.get("description", ""),
            "pre_session_snapshot": scenario["pre_session_snapshot"],
            "created_at": datetime.utcnow().isoformat(),
            "is_active": True,
        }

        scenario_result = (
            supabase_client.table("synthetic_scenarios")
            .insert(scenario_data)
            .execute()
        )

        if not scenario_result.data:
            continue

        scenario_id = scenario_result.data[0]["id"]
        scenario_ids.append(scenario_id)

        # Create the expert response for this scenario
        response_data = {
            "id": str(uuid.uuid4()),
            "scenario_id": scenario_id,
            "expert_id": "test_expert_001",  # Test expert identifier
            "response": scenario["expert_response"],
            "created_at": datetime.utcnow().isoformat(),
        }

        supabase_client.table("expert_scenario_responses").insert(response_data).execute()

    return scenario_ids


async def cleanup_scenarios(supabase_client, scenario_ids: List[str]) -> None:
    """
    Remove test scenarios and their responses.

    Args:
        supabase_client: Supabase client instance
        scenario_ids: List of scenario IDs to delete
    """
    if not scenario_ids:
        return

    # Delete expert responses first (foreign key constraint)
    for scenario_id in scenario_ids:
        supabase_client.table("expert_scenario_responses").delete().eq(
            "scenario_id", scenario_id
        ).execute()

    # Delete scenarios
    for scenario_id in scenario_ids:
        supabase_client.table("synthetic_scenarios").delete().eq(
            "id", scenario_id
        ).execute()


def get_scenario_by_name(name: str) -> Dict[str, Any]:
    """Get a specific scenario by name."""
    for scenario in EXPERT_SCENARIOS:
        if scenario["name"] == name:
            return scenario
    raise ValueError(f"Scenario '{name}' not found")


def get_session_pattern(pattern_name: str) -> Dict[str, Any]:
    """Get session outcome pattern by name."""
    if pattern_name not in SESSION_PATTERNS:
        raise ValueError(f"Pattern '{pattern_name}' not found")
    return SESSION_PATTERNS[pattern_name]


def get_user_profile(profile_name: str) -> Dict[str, Any]:
    """Get test user profile by name."""
    if profile_name not in TEST_USER_PROFILES:
        raise ValueError(f"Profile '{profile_name}' not found")
    return TEST_USER_PROFILES[profile_name]
