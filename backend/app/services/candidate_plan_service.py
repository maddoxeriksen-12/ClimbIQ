from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

from app.services.action_id import compute_action_id
from app.services.dose_features import compute_planned_dose_features
from app.services.planned_workout_adapter import planned_workout_from_recommendation
from app.services.workout_schemas import validate_planned_workout


SESSION_TYPE_ORDER: List[str] = [
    "project",
    "limit_bouldering",
    "volume",
    "technique",
    "light_session",
    "active_recovery",
    "rest_day",
]


@dataclass(frozen=True)
class CandidatePlan:
    rank_seed: int
    session_type: str
    predicted_quality: float
    confidence: str

    planned_workout: Dict[str, Any]
    action_id: str
    planned_dose_features: Dict[str, Any]

    rationale: Dict[str, Any]
    predicted_outcomes: Dict[str, Any]

    structured_plan: Dict[str, Any]


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _unique_keep_order(items: Sequence[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for x in items:
        if x not in seen:
            out.append(x)
            seen.add(x)
    return out


def _session_type_adjustment(user_state: Dict[str, Any], session_type: str) -> float:
    """Heuristic, deterministic action-conditional adjustment.\n\n    The current RecommendationEngine predicts a state-quality scalar (mostly action-agnostic).\n    This adjustment is the v1 bridge toward P(reward|state, action).\n    """

    energy = float(user_state.get("energy_level", 6) or 6)
    soreness = float(user_state.get("muscle_soreness", 5) or 5)
    injury_sev = float(user_state.get("injury_severity", 0) or 0)
    acwr = float(user_state.get("acwr", 1.0) or 1.0)
    acwr_risk = str(user_state.get("acwr_risk_zone", "optimal") or "optimal")

    fatigue_proxy = _clamp((soreness - 5.0) / 5.0, 0.0, 1.0)

    hi_intensity = session_type in {"project", "limit_bouldering"}

    adj = 0.0

    # Injury/risk penalty for high intensity
    if hi_intensity:
        adj -= 0.6 * _clamp((injury_sev - 3.0) / 7.0, 0.0, 1.0)
        adj -= 0.5 * _clamp((5.0 - energy) / 5.0, 0.0, 1.0)
        adj -= 0.3 * fatigue_proxy
        if acwr_risk in {"moderate_risk", "high_risk"}:
            adj -= 0.5
        if acwr > 1.4:
            adj -= 0.3

    # Volume sessions need decent recovery and time
    if session_type == "volume":
        adj -= 0.25 * fatigue_proxy
        adj -= 0.15 * _clamp((injury_sev - 4.0) / 6.0, 0.0, 1.0)
        adj += 0.10 * _clamp((energy - 5.0) / 5.0, 0.0, 1.0)

    # Technique tends to be safer when sore
    if session_type == "technique":
        adj += 0.15 * fatigue_proxy
        adj -= 0.10 * _clamp((injury_sev - 6.0) / 4.0, 0.0, 1.0)

    # Light/recovery/rest should benefit low energy / high fatigue
    if session_type in {"light_session", "active_recovery"}:
        adj += 0.20 * _clamp((5.0 - energy) / 5.0, 0.0, 1.0)
        adj += 0.15 * fatigue_proxy

    if session_type == "rest_day":
        adj += 0.40 * _clamp((5.0 - energy) / 5.0, 0.0, 1.0)
        adj += 0.30 * fatigue_proxy
        if acwr_risk in {"high_risk"}:
            adj += 0.20

    return float(adj)


def _suggest_candidate_session_types(
    *,
    base_session_type: str,
    rule_session_type: Optional[str],
    adjusted_quality: float,
) -> List[str]:
    # Start with any rule-forced type (if present), then base.
    seeds = [t for t in [rule_session_type, base_session_type] if t]

    # Neighbors around base type.
    neighbors: List[str] = []
    if base_session_type in {"project", "limit_bouldering"}:
        neighbors = ["volume", "technique", "light_session"]
    elif base_session_type == "volume":
        neighbors = ["project", "technique", "light_session"]
    elif base_session_type == "technique":
        neighbors = ["volume", "light_session", "active_recovery"]
    elif base_session_type == "light_session":
        neighbors = ["technique", "active_recovery", "rest_day"]
    elif base_session_type == "active_recovery":
        neighbors = ["light_session", "rest_day", "technique"]
    else:
        neighbors = ["active_recovery", "light_session", "technique"]

    # Quality-based safety fallback
    if adjusted_quality < 4.0:
        neighbors = _unique_keep_order(neighbors + ["active_recovery", "rest_day"])

    # Fill order from global list
    return _unique_keep_order(seeds + neighbors + SESSION_TYPE_ORDER)


class CandidatePlanService:
    def __init__(self, engine: Any):
        self.engine = engine

    def generate_candidates(
        self,
        *,
        user_state: Dict[str, Any],
        user_id: Optional[str],
        k: int = 5,
    ) -> List[CandidatePlan]:
        self.engine._refresh_cache_if_needed()

        # Mirror engine’s Layer-1 enrichment so candidates are consistent.
        acwr_data = {}
        user_deviation = {}
        enriched_state = dict(user_state)
        if user_id:
            acwr_data = self.engine._get_user_acwr(user_id)
            user_deviation = self.engine._get_user_deviation(user_id)
            enriched_state = {
                **enriched_state,
                "acwr": acwr_data.get("acwr", 1.0),
                "acwr_risk_zone": acwr_data.get("risk_zone", "optimal"),
                "injury_probability": acwr_data.get("injury_probability", 0.05),
            }

        base_quality, contributions = self.engine._calculate_base_quality(enriched_state)
        matched_rules = self.engine._match_rules(enriched_state)
        adjusted_quality, rule_session_type, rule_recommendations = self.engine._apply_rule_actions(
            matched_rules, base_quality, contributions
        )

        base_session_type = rule_session_type or self.engine._determine_session_type(
            adjusted_quality, enriched_state, matched_rules
        )

        confidence = self.engine._calculate_confidence(contributions, matched_rules)
        max_intensity = self.engine._calculate_max_intensity(enriched_state)

        session_types = _suggest_candidate_session_types(
            base_session_type=base_session_type,
            rule_session_type=rule_session_type,
            adjusted_quality=float(adjusted_quality),
        )[: max(1, int(k))]

        candidates: List[CandidatePlan] = []
        for i, st in enumerate(session_types, start=1):
            structured_plan = self.engine._build_structured_plan(st, enriched_state)
            suggestions = self.engine._generate_suggestions(st, enriched_state, matched_rules)

            predicted_quality = float(adjusted_quality) + _session_type_adjustment(enriched_state, st)
            predicted_quality = _clamp(predicted_quality, 1.0, 10.0)

            rec = {
                "predicted_quality": round(predicted_quality, 1),
                "base_quality": round(float(base_quality), 1),
                "session_type": st,
                "max_intensity": max_intensity,
                "confidence": confidence,
                "suggestions": suggestions,
                "avoid": list(set(rule_recommendations.get("avoid", []))),
                "include": list(set(rule_recommendations.get("include", []))),
                "structured_plan": structured_plan,
                "model_version": self.engine.__class__.__name__,
            }

            planned_workout = planned_workout_from_recommendation(rec, enriched_state)
            validate_planned_workout(planned_workout)
            action_id = compute_action_id(planned_workout)
            planned_dose_features = compute_planned_dose_features(planned_workout)

            rationale = {
                "tags": {
                    "derived_from": "candidate_plan_service_v1",
                    "base_session_type": base_session_type,
                    "rule_session_type": rule_session_type,
                },
                "signals": {
                    "energy_level": enriched_state.get("energy_level"),
                    "muscle_soreness": enriched_state.get("muscle_soreness"),
                    "injury_severity": enriched_state.get("injury_severity"),
                    "acwr_risk_zone": enriched_state.get("acwr_risk_zone"),
                },
                "risks": {},
            }

            predicted_outcomes = {
                "version": "1.0",
                "predicted_quality": round(predicted_quality, 3),
                "confidence": confidence,
                "max_intensity": max_intensity,
            }

            candidates.append(
                CandidatePlan(
                    rank_seed=i,
                    session_type=st,
                    predicted_quality=float(predicted_quality),
                    confidence=str(confidence),
                    planned_workout=planned_workout,
                    action_id=action_id,
                    planned_dose_features=planned_dose_features,
                    rationale=rationale,
                    predicted_outcomes=predicted_outcomes,
                    structured_plan=structured_plan,
                )
            )

        # Stable sorting by predicted_quality then session_type so output is deterministic
        candidates.sort(key=lambda c: (-c.predicted_quality, c.session_type))

        # Re-rank seeds accordingly (used for rank assignment downstream)
        return candidates[: max(1, int(k))]

