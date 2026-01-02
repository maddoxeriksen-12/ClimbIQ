from __future__ import annotations

import copy
import random

import pytest

from app.services.action_id import compute_action_id
from app.services.dose_features import compute_planned_dose_features
from app.services.expert_game_service import maybe_start_event, DEFAULT_EVENT_DEFAULTS
from app.services.workout_schemas import validate_planned_workout


def _minimal_planned_workout() -> dict:
    return {
        "version": "1.0",
        "session_type": "limit_bouldering",
        "time_cap_min": 90,
        "focus_tags": ["power"],
        "constraints_applied": {"injury_mods": [], "equipment_required": [], "intensity_ceiling": 1.0},
        "blocks": [
            {
                "name": "Warmup",
                "block_type": "warmup",
                "prescription": {
                    "items": [
                        {
                            "activity_type": "mobility",
                            "name": "Mobility",
                            "dose": {"minutes": 10},
                            "intensity": {"rpe_target": 2, "intensity_0_1": 0.2},
                        }
                    ]
                },
            },
            {
                "name": "Main",
                "block_type": "main",
                "prescription": {
                    "items": [
                        {
                            "activity_type": "climbing",
                            "name": "Limit attempts",
                            "dose": {"attempts": 12, "rest_seconds": 240},
                            "intensity": {"rpe_target": 9, "intensity_0_1": 0.95},
                        }
                    ]
                },
            },
        ],
        "dose_targets": {
            "expected_rpe_distribution": {"bins": [0, 6, 8, 10], "probabilities": [0.2, 0.3, 0.5]},
            "hi_attempts_target": 10,
            "tut_minutes_target": 25,
            "volume_score_target": 1.0,
            "fatigue_cost_target": 1.0,
        },
        "notes": "ui-only",
    }


def test_planned_workout_schema_accepts_minimal_payload() -> None:
    planned = _minimal_planned_workout()
    validate_planned_workout(planned)


def test_planned_workout_schema_rejects_unknown_fields() -> None:
    planned = _minimal_planned_workout()
    planned["unexpected"] = 123

    with pytest.raises(ValueError):
        validate_planned_workout(planned)


def test_action_id_is_stable_and_ignores_notes() -> None:
    planned1 = _minimal_planned_workout()
    planned2 = copy.deepcopy(planned1)

    planned1["notes"] = "hello"
    planned2["notes"] = "goodbye"

    a1 = compute_action_id(planned1)
    a2 = compute_action_id(planned2)

    assert a1 == a2


def test_dose_features_are_deterministic() -> None:
    planned = _minimal_planned_workout()
    validate_planned_workout(planned)

    df1 = compute_planned_dose_features(planned)
    df2 = compute_planned_dose_features(planned)

    assert df1 == df2
    assert df1["totals"]["hi_attempts"] == 12


def test_event_generator_is_deterministic_given_seed_and_state() -> None:
    state_row = {
        "t_index": 3,
        "active_event": None,
        "event_cooldowns": {"GLOBAL": 0, "SCHEDULE_SHOCK": 0, "ACCESS_SHOCK": 0, "RECOVERY_SHOCK": 0, "MICRO_INJURY_FLAG": 0, "OPPORTUNITY": 0},
        "event_budget_remaining": {"TOTAL": 3, "SCHEDULE_SHOCK": 1, "ACCESS_SHOCK": 1, "RECOVERY_SHOCK": 2, "MICRO_INJURY_FLAG": 1, "OPPORTUNITY": 1},
        "readiness_state": {"fatigue_acute": 0.8, "sleep_quality": 0.3, "stable_streak_good": False},
        "constraints_state": {"schedule_consistency": 0.4, "time_budget_min": 90},
        "latent_state": {"injury_risk": 0.8},
    }

    rng1 = random.Random(12345)
    rng2 = random.Random(12345)

    e1 = maybe_start_event(state_row, rng=rng1, defaults=DEFAULT_EVENT_DEFAULTS)
    e2 = maybe_start_event(state_row, rng=rng2, defaults=DEFAULT_EVENT_DEFAULTS)

    assert e1 == e2
