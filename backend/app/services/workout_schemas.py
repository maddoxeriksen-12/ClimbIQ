from __future__ import annotations

from typing import Any, Dict, List

from jsonschema import Draft202012Validator


# NOTE:
# - These are runtime schemas (Draft 2020-12) used by both BetaLab and (later)
#   real serving/audit. They are intentionally strict: if we accept invalid
#   plans, we will create silent action/label drift.


PLANNED_WORKOUT_SCHEMA: Dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://climbiq.local/schemas/planned_workout.json",
    "title": "PlannedWorkout",
    "type": "object",
    "required": ["version", "session_type", "time_cap_min", "blocks", "dose_targets"],
    "properties": {
        "version": {"type": "string", "enum": ["1.0"]},
        "session_type": {
            "type": "string",
            "enum": [
                "limit_bouldering",
                "volume_bouldering",
                "aerobic_arc",
                "anaerobic_intervals",
                "hangboard",
                "strength",
                "power",
                "technique",
                "rest",
                "mixed",
            ],
        },
        "time_cap_min": {"type": "integer", "minimum": 10, "maximum": 240},
        "focus_tags": {"type": "array", "items": {"type": "string"}, "maxItems": 8},
        "constraints_applied": {
            "type": "object",
            "properties": {
                "injury_mods": {"type": "array", "items": {"type": "string"}},
                "equipment_required": {"type": "array", "items": {"type": "string"}},
                "intensity_ceiling": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "additionalProperties": True,
        },
        "blocks": {
            "type": "array",
            "minItems": 1,
            "items": {"$ref": "#/$defs/block"},
        },
        "dose_targets": {
            "type": "object",
            "required": ["expected_rpe_distribution", "hi_attempts_target", "tut_minutes_target"],
            "properties": {
                "expected_rpe_distribution": {"$ref": "#/$defs/prob_distribution"},
                "hi_attempts_target": {"type": "integer", "minimum": 0, "maximum": 200},
                "tut_minutes_target": {"type": "number", "minimum": 0, "maximum": 200},
                "volume_score_target": {"type": "number", "minimum": 0},
                "fatigue_cost_target": {"type": "number", "minimum": 0},
            },
            "additionalProperties": False,
        },
        "notes": {"type": "string", "maxLength": 4000},
    },
    "$defs": {
        "block": {
            "type": "object",
            "required": ["name", "block_type", "prescription"],
            "properties": {
                "name": {"type": "string"},
                "block_type": {
                    "type": "string",
                    "enum": ["warmup", "main", "supplemental", "cooldown", "rehab"],
                },
                "goal": {"type": "string"},
                "prescription": {
                    "type": "object",
                    "required": ["items"],
                    "properties": {
                        "items": {
                            "type": "array",
                            "minItems": 1,
                            "items": {"$ref": "#/$defs/item"},
                        }
                    },
                    "additionalProperties": False,
                },
            },
            "additionalProperties": False,
        },
        "item": {
            "type": "object",
            "required": ["activity_type", "name", "dose"],
            "properties": {
                "activity_type": {
                    "type": "string",
                    "enum": [
                        "climbing",
                        "hangboard",
                        "strength",
                        "power",
                        "mobility",
                        "aerobic",
                        "drill",
                    ],
                },
                "name": {"type": "string"},
                "dose": {
                    "type": "object",
                    "properties": {
                        "sets": {"type": "integer", "minimum": 0, "maximum": 50},
                        "reps": {"type": "integer", "minimum": 0, "maximum": 500},
                        "minutes": {"type": "number", "minimum": 0, "maximum": 240},
                        "attempts": {"type": "integer", "minimum": 0, "maximum": 500},
                        "rest_seconds": {"type": "integer", "minimum": 0, "maximum": 3600},
                    },
                    "additionalProperties": False,
                },
                "intensity": {
                    "type": "object",
                    "properties": {
                        "rpe_target": {"type": "number", "minimum": 0, "maximum": 10},
                        "intensity_0_1": {"type": "number", "minimum": 0, "maximum": 1},
                        "grade_band": {"type": "string"},
                        "percent_max": {"type": "number", "minimum": 0, "maximum": 1.5},
                    },
                    "additionalProperties": False,
                },
                "technique_tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 10,
                },
            },
            "additionalProperties": False,
        },
        "prob_distribution": {
            "type": "object",
            "required": ["bins", "probabilities"],
            "properties": {
                "bins": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "probabilities": {
                    "type": "array",
                    "items": {"type": "number", "minimum": 0, "maximum": 1},
                    "minItems": 2,
                },
            },
            "additionalProperties": False,
        },
    },
    "additionalProperties": False,
}


EXECUTED_WORKOUT_SCHEMA: Dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://climbiq.local/schemas/executed_workout.json",
    "title": "ExecutedWorkout",
    "type": "object",
    "required": ["version", "source", "completion", "blocks", "dose_observed"],
    "properties": {
        "version": {"type": "string", "enum": ["1.0"]},
        "source": {
            "type": "object",
            "required": ["source_type", "trust_weight"],
            "properties": {
                "source_type": {"type": "string", "enum": ["real_user", "sim_engine"]},
                "trust_weight": {"type": "number", "minimum": 0, "maximum": 1},
                "generator_version": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "completion": {
            "type": "object",
            "required": ["completed_fraction", "time_spent_min"],
            "properties": {
                "completed_fraction": {"type": "number", "minimum": 0, "maximum": 1},
                "time_spent_min": {"type": "number", "minimum": 0, "maximum": 300},
                "deviations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["type", "reason"],
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": [
                                    "reduced_volume",
                                    "reduced_intensity",
                                    "skipped_block",
                                    "added_block",
                                    "changed_focus",
                                ],
                            },
                            "reason": {"type": "string"},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            "additionalProperties": False,
        },
        "blocks": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "required": ["name", "block_type", "items"],
                "properties": {
                    "name": {"type": "string"},
                    "block_type": {
                        "type": "string",
                        "enum": ["warmup", "main", "supplemental", "cooldown", "rehab"],
                    },
                    "items": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "required": ["activity_type", "name", "dose_actual"],
                            "properties": {
                                "activity_type": {"type": "string"},
                                "name": {"type": "string"},
                                "dose_actual": {
                                    "type": "object",
                                    "properties": {
                                        "sets": {"type": "integer", "minimum": 0},
                                        "reps": {"type": "integer", "minimum": 0},
                                        "minutes": {"type": "number", "minimum": 0},
                                        "attempts": {"type": "integer", "minimum": 0},
                                        "rest_seconds_avg": {"type": "number", "minimum": 0},
                                    },
                                    "additionalProperties": False,
                                },
                                "intensity_actual": {
                                    "type": "object",
                                    "properties": {
                                        "rpe_reported": {"type": "number", "minimum": 0, "maximum": 10},
                                        "intensity_0_1": {"type": "number", "minimum": 0, "maximum": 1},
                                        "grade_band": {"type": "string"},
                                        "percent_max": {"type": "number", "minimum": 0, "maximum": 1.5},
                                    },
                                    "additionalProperties": False,
                                },
                            },
                            "additionalProperties": False,
                        },
                    },
                },
                "additionalProperties": False,
            },
        },
        "dose_observed": {
            "type": "object",
            "required": ["rpe_distribution", "hi_attempts", "tut_minutes"],
            "properties": {
                "rpe_distribution": {"$ref": "#/$defs/prob_distribution"},
                "hi_attempts": {"type": "integer", "minimum": 0},
                "tut_minutes": {"type": "number", "minimum": 0},
                "volume_score": {"type": "number", "minimum": 0},
                "fatigue_cost": {"type": "number", "minimum": 0},
            },
            "additionalProperties": False,
        },
        "notes": {"type": "string", "maxLength": 4000},
    },
    "$defs": {
        "prob_distribution": {
            "type": "object",
            "required": ["bins", "probabilities"],
            "properties": {
                "bins": {"type": "array", "items": {"type": "number"}, "minItems": 2},
                "probabilities": {
                    "type": "array",
                    "items": {"type": "number", "minimum": 0, "maximum": 1},
                    "minItems": 2,
                },
            },
            "additionalProperties": False,
        }
    },
    "additionalProperties": False,
}


_planned_validator = Draft202012Validator(PLANNED_WORKOUT_SCHEMA)
_executed_validator = Draft202012Validator(EXECUTED_WORKOUT_SCHEMA)


def _format_errors(errors: List[Any]) -> str:
    parts: List[str] = []
    for e in errors:
        path = "/" + "/".join(str(p) for p in list(e.path)) if e.path else "<root>"
        parts.append(f"{path}: {e.message}")
    return "\n".join(parts)


def validate_planned_workout(obj: Any) -> Dict[str, Any]:
    errors = sorted(_planned_validator.iter_errors(obj), key=lambda e: list(e.path))
    if errors:
        raise ValueError("planned_workout schema validation failed:\n" + _format_errors(errors))
    return obj  # type: ignore[return-value]


def validate_executed_workout(obj: Any) -> Dict[str, Any]:
    errors = sorted(_executed_validator.iter_errors(obj), key=lambda e: list(e.path))
    if errors:
        raise ValueError("executed_workout schema validation failed:\n" + _format_errors(errors))
    return obj  # type: ignore[return-value]
