from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


_SESSION_TYPE_MAP = {
    # Engine outputs
    "project": "limit_bouldering",
    "limit_bouldering": "limit_bouldering",
    "volume": "volume_bouldering",
    "technique": "technique",
    "active_recovery": "mixed",
    "light_session": "mixed",
    "rest_day": "rest",
}


def _parse_minutes(duration: Any) -> Optional[float]:
    if duration is None:
        return None
    if isinstance(duration, (int, float)):
        return float(duration)
    if isinstance(duration, str):
        # very small parser for strings like "10 min" or "3-5 min"
        m = re.search(r"(\d+(?:\.\d+)?)", duration)
        if m:
            try:
                return float(m.group(1))
            except Exception:
                return None
    return None


def planned_workout_from_recommendation(
    recommendation: Dict[str, Any],
    user_state: Dict[str, Any],
) -> Dict[str, Any]:
    """Convert current engine output into the canonical PlannedWorkout v1.0.

    This is intentionally conservative: it produces a stable structure (so action_id
    is stable) and avoids copying any free-text explanation fields that could drift.
    """

    session_type_raw = str(recommendation.get("session_type") or "mixed")
    session_type = _SESSION_TYPE_MAP.get(session_type_raw, "mixed")

    time_cap_min = int(user_state.get("planned_duration") or user_state.get("planned_duration_minutes") or 90)

    structured_plan = recommendation.get("structured_plan") or {}

    blocks_out: List[Dict[str, Any]] = []

    def add_phase(phase_key: str, block_type: str) -> None:
        phase_blocks = structured_plan.get(phase_key, []) or []
        for b in phase_blocks:
            if not isinstance(b, dict):
                continue

            title = str(b.get("title") or phase_key)
            intensity_score = b.get("intensity_score")
            intensity_0_1 = None
            if isinstance(intensity_score, (int, float)):
                intensity_0_1 = max(0.0, min(1.0, float(intensity_score) / 10.0))

            items: List[Dict[str, Any]] = []
            exercises = b.get("exercises") or []
            for ex in exercises:
                if not isinstance(ex, dict):
                    continue

                name = str(ex.get("name") or "")
                minutes = _parse_minutes(ex.get("duration"))

                # We keep dose fields minimal and stable.
                dose: Dict[str, Any] = {}
                if isinstance(ex.get("sets"), (int, float)):
                    dose["sets"] = int(ex["sets"])
                if isinstance(ex.get("reps"), (int, float)):
                    dose["reps"] = int(ex["reps"])
                if minutes is not None:
                    dose["minutes"] = minutes

                intensity: Dict[str, Any] = {}
                if intensity_0_1 is not None:
                    intensity["intensity_0_1"] = intensity_0_1

                activity_type = "climbing"
                if block_type in ("warmup", "cooldown"):
                    activity_type = "mobility"

                item: Dict[str, Any] = {
                    "activity_type": activity_type,
                    "name": name,
                    "dose": dose,
                }
                if intensity:
                    item["intensity"] = intensity

                items.append(item)

            if not items:
                continue

            blocks_out.append(
                {
                    "name": title,
                    "block_type": block_type,
                    "prescription": {"items": items},
                }
            )

    add_phase("warmup", "warmup")
    add_phase("main", "main")
    add_phase("cooldown", "cooldown")

    # Minimal dose targets: stable defaults.
    dose_targets: Dict[str, Any] = {
        "expected_rpe_distribution": {"bins": [0, 6, 8, 10], "probabilities": [0.2, 0.3, 0.5]},
        "hi_attempts_target": 10 if session_type == "limit_bouldering" else 0,
        "tut_minutes_target": min(200.0, float(time_cap_min) * 0.30),
        "volume_score_target": 1.0,
        "fatigue_cost_target": 1.0,
    }

    constraints_applied: Dict[str, Any] = {
        "injury_mods": [],
        "equipment_required": [],
        "intensity_ceiling": None,
    }
    if "injury_severity" in user_state:
        constraints_applied["injury_mods"].append("injury_severity")

    return {
        "version": "1.0",
        "session_type": session_type,
        "time_cap_min": time_cap_min,
        "focus_tags": [],
        "constraints_applied": constraints_applied,
        "blocks": blocks_out,
        "dose_targets": dose_targets,
    }
