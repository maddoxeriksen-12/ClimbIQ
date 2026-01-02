from __future__ import annotations

from typing import Any, Dict, Iterable, Tuple


def _safe_number(x: Any) -> float:
    try:
        if x is None:
            return 0.0
        return float(x)
    except Exception:
        return 0.0


def _iter_planned_items(planned_workout: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    for block in planned_workout.get("blocks", []) or []:
        prescription = (block or {}).get("prescription") or {}
        for item in prescription.get("items", []) or []:
            if isinstance(item, dict):
                yield item


def compute_planned_dose_features(
    planned_workout: Dict[str, Any],
    *,
    hi_attempt_threshold: float = 0.85,
) -> Dict[str, Any]:
    """Materialize simple, stable dose features from a planned_workout."""

    total_sets = 0
    total_reps = 0
    total_attempts = 0
    tut_minutes = 0.0

    hi_attempts = 0

    intensity_sum = 0.0
    intensity_count = 0

    rest_seconds_sum = 0.0
    rest_seconds_count = 0

    item_count = 0

    for item in _iter_planned_items(planned_workout):
        item_count += 1

        dose = item.get("dose") or {}
        intensity = item.get("intensity") or {}

        sets = int(_safe_number(dose.get("sets")))
        reps = int(_safe_number(dose.get("reps")))
        attempts = int(_safe_number(dose.get("attempts")))
        minutes = _safe_number(dose.get("minutes"))
        rest_seconds = _safe_number(dose.get("rest_seconds"))

        total_sets += max(0, sets)
        total_reps += max(0, reps)
        total_attempts += max(0, attempts)
        tut_minutes += max(0.0, minutes)

        if rest_seconds > 0:
            rest_seconds_sum += rest_seconds
            rest_seconds_count += 1

        intensity_0_1 = intensity.get("intensity_0_1")
        i01 = _safe_number(intensity_0_1)
        if intensity_0_1 is not None:
            intensity_sum += i01
            intensity_count += 1

        if attempts > 0 and i01 >= hi_attempt_threshold:
            hi_attempts += attempts

    avg_intensity = (intensity_sum / intensity_count) if intensity_count else None
    avg_rest_seconds = (rest_seconds_sum / rest_seconds_count) if rest_seconds_count else None

    # Simple scalar proxies (kept stable and explicit)
    volume_score = float(total_sets) + (tut_minutes / 10.0) + (total_attempts / 20.0)
    fatigue_cost = (hi_attempts * 0.03) + (tut_minutes * 0.015)

    return {
        "version": "1.0",
        "totals": {
            "sets": total_sets,
            "reps": total_reps,
            "attempts": total_attempts,
            "tut_minutes": round(tut_minutes, 3),
            "hi_attempts": hi_attempts,
        },
        "summary": {
            "avg_intensity_0_1": (round(avg_intensity, 3) if isinstance(avg_intensity, float) else None),
            "avg_rest_seconds": (round(avg_rest_seconds, 1) if isinstance(avg_rest_seconds, float) else None),
            "item_count": item_count,
            "volume_score": round(volume_score, 4),
            "fatigue_cost": round(fatigue_cost, 4),
        },
        "params": {
            "hi_attempt_threshold": hi_attempt_threshold,
        },
    }


def compute_executed_dose_features(
    executed_workout: Dict[str, Any],
    *,
    hi_attempt_threshold: float = 0.85,
) -> Dict[str, Any]:
    """Materialize dose features from an executed_workout."""

    total_sets = 0
    total_reps = 0
    total_attempts = 0
    tut_minutes = 0.0
    hi_attempts = 0

    intensity_sum = 0.0
    intensity_count = 0

    rest_seconds_sum = 0.0
    rest_seconds_count = 0

    item_count = 0

    for block in executed_workout.get("blocks", []) or []:
        for item in (block or {}).get("items", []) or []:
            if not isinstance(item, dict):
                continue
            item_count += 1

            dose = item.get("dose_actual") or {}
            intensity = item.get("intensity_actual") or {}

            sets = int(_safe_number(dose.get("sets")))
            reps = int(_safe_number(dose.get("reps")))
            attempts = int(_safe_number(dose.get("attempts")))
            minutes = _safe_number(dose.get("minutes"))
            rest_seconds_avg = _safe_number(dose.get("rest_seconds_avg"))

            total_sets += max(0, sets)
            total_reps += max(0, reps)
            total_attempts += max(0, attempts)
            tut_minutes += max(0.0, minutes)

            if rest_seconds_avg > 0:
                rest_seconds_sum += rest_seconds_avg
                rest_seconds_count += 1

            intensity_0_1 = intensity.get("intensity_0_1")
            i01 = _safe_number(intensity_0_1)
            if intensity_0_1 is not None:
                intensity_sum += i01
                intensity_count += 1

            if attempts > 0 and i01 >= hi_attempt_threshold:
                hi_attempts += attempts

    avg_intensity = (intensity_sum / intensity_count) if intensity_count else None
    avg_rest_seconds = (rest_seconds_sum / rest_seconds_count) if rest_seconds_count else None

    volume_score = float(total_sets) + (tut_minutes / 10.0) + (total_attempts / 20.0)
    fatigue_cost = (hi_attempts * 0.03) + (tut_minutes * 0.015)

    return {
        "version": "1.0",
        "totals": {
            "sets": total_sets,
            "reps": total_reps,
            "attempts": total_attempts,
            "tut_minutes": round(tut_minutes, 3),
            "hi_attempts": hi_attempts,
        },
        "summary": {
            "avg_intensity_0_1": (round(avg_intensity, 3) if isinstance(avg_intensity, float) else None),
            "avg_rest_seconds": (round(avg_rest_seconds, 1) if isinstance(avg_rest_seconds, float) else None),
            "item_count": item_count,
            "volume_score": round(volume_score, 4),
            "fatigue_cost": round(fatigue_cost, 4),
        },
        "params": {
            "hi_attempt_threshold": hi_attempt_threshold,
        },
    }
