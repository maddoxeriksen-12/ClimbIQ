from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


@dataclass(frozen=True)
class RerankedCandidate:
    action_id: str
    session_type: str
    planned_workout: Dict[str, Any]
    planned_dose_features: Dict[str, Any]
    predicted_outcomes: Dict[str, Any]
    rationale: Dict[str, Any]

    score_total: float
    score_components: Dict[str, float]


class RerankerService:
    """Deterministic heuristic reranker (v1).

    Goal: produce stable, inspectable component scores suitable for logging and later
    replacement with an ML model.
    """

    def __init__(
        self,
        *,
        w_progress: float = 1.00,
        w_adherence: float = 0.80,
        w_goal_fit: float = 0.60,
        w_novelty: float = 0.25,
        w_risk: float = 1.10,
    ) -> None:
        self.w_progress = w_progress
        self.w_adherence = w_adherence
        self.w_goal_fit = w_goal_fit
        self.w_novelty = w_novelty
        self.w_risk = w_risk

    def _score_progress(self, candidate: Any) -> float:
        pq = float(getattr(candidate, "predicted_quality", 5.0) or 5.0)
        return _clamp(pq / 10.0, 0.0, 1.0)

    def _score_adherence(self, user_state: Dict[str, Any], candidate: Any) -> float:
        # Penalty for exceeding time budget + high complexity under low energy/high soreness.
        planned_time = float((candidate.planned_workout or {}).get("time_cap_min", 90) or 90)
        budget = float(user_state.get("planned_duration", planned_time) or planned_time)
        energy = float(user_state.get("energy_level", 6) or 6)
        soreness = float(user_state.get("muscle_soreness", 5) or 5)

        item_count = float(((candidate.planned_dose_features or {}).get("summary") or {}).get("item_count", 1) or 1)

        time_over = max(0.0, (planned_time - budget) / max(1.0, budget))
        complexity = _clamp(item_count / 12.0, 0.0, 1.0)
        fatigue = _clamp((soreness - 5.0) / 5.0, 0.0, 1.0)
        low_energy = _clamp((5.0 - energy) / 5.0, 0.0, 1.0)

        # Start at 1.0 and subtract penalties.
        score = 1.0
        score -= 0.65 * time_over
        score -= 0.25 * complexity
        score -= 0.20 * fatigue
        score -= 0.20 * low_energy
        return _clamp(score, 0.0, 1.0)

    def _score_goal_fit(self, user_state: Dict[str, Any], candidate: Any) -> float:
        goal = str(user_state.get("primary_goal", "") or "").lower()
        st = str(candidate.session_type or "")

        if not goal:
            return 0.5

        # very simple mapping; expand later
        if "project" in goal or "outdoor" in goal:
            return 1.0 if st in {"project", "limit_bouldering"} else 0.6 if st == "technique" else 0.3
        if "volume" in goal or "endurance" in goal:
            return 1.0 if st == "volume" else 0.6 if st == "technique" else 0.3
        if "technique" in goal or "movement" in goal:
            return 1.0 if st == "technique" else 0.6 if st == "volume" else 0.3

        return 0.5

    def _score_novelty(self, candidate: Any, recent_action_ids: Sequence[str]) -> float:
        # Novel if not seen recently
        if candidate.action_id in set(recent_action_ids or []):
            return 0.0
        return 1.0

    def _risk_penalty(self, user_state: Dict[str, Any], candidate: Any) -> float:
        injury = float(user_state.get("injury_severity", 0) or 0)
        acwr = float(user_state.get("acwr", 1.0) or 1.0)
        risk_zone = str(user_state.get("acwr_risk_zone", "optimal") or "optimal")
        soreness = float(user_state.get("muscle_soreness", 5) or 5)

        st = str(candidate.session_type or "")
        hi_intensity = st in {"project", "limit_bouldering"}

        # Base risk from state
        risk = 0.0
        risk += 0.45 * _clamp(injury / 10.0, 0.0, 1.0)
        risk += 0.20 * _clamp((soreness - 5.0) / 5.0, 0.0, 1.0)
        risk += 0.15 * _clamp((acwr - 1.1) / 0.9, 0.0, 1.0)
        if risk_zone in {"moderate_risk"}:
            risk += 0.15
        if risk_zone in {"high_risk"}:
            risk += 0.30

        # Action multiplier
        if hi_intensity:
            risk *= 1.35
        elif st in {"volume"}:
            risk *= 1.10
        elif st in {"technique", "light_session"}:
            risk *= 0.85
        elif st in {"active_recovery", "rest_day"}:
            risk *= 0.50

        return _clamp(risk, 0.0, 1.0)

    def rerank(
        self,
        *,
        user_state: Dict[str, Any],
        candidates: Sequence[Any],
        recent_action_ids: Optional[Sequence[str]] = None,
    ) -> Tuple[List[RerankedCandidate], Dict[str, Any]]:
        recent_action_ids = list(recent_action_ids or [])

        reranked: List[RerankedCandidate] = []
        for c in candidates:
            progress = self._score_progress(c)
            adherence = self._score_adherence(user_state, c)
            goal_fit = self._score_goal_fit(user_state, c)
            novelty = self._score_novelty(c, recent_action_ids)
            risk = self._risk_penalty(user_state, c)

            # Score is reward - risk
            score_total = (
                self.w_progress * progress
                + self.w_adherence * adherence
                + self.w_goal_fit * goal_fit
                + self.w_novelty * novelty
                - self.w_risk * risk
            )

            reranked.append(
                RerankedCandidate(
                    action_id=c.action_id,
                    session_type=c.session_type,
                    planned_workout=c.planned_workout,
                    planned_dose_features=c.planned_dose_features,
                    predicted_outcomes=c.predicted_outcomes,
                    rationale=c.rationale,
                    score_total=float(score_total),
                    score_components={
                        "reward_progress": float(progress),
                        "reward_adherence": float(adherence),
                        "goal_fit": float(goal_fit),
                        "novelty": float(novelty),
                        "risk_penalty": float(risk),
                    },
                )
            )

        # Stable sorting
        reranked.sort(key=lambda x: (-x.score_total, x.session_type, x.action_id))

        # Confidence: normalized margin between top1 and top2 (v1)
        confidence = "medium"
        if len(reranked) == 1:
            confidence = "medium"
        else:
            margin = reranked[0].score_total - reranked[1].score_total
            if margin >= 0.35:
                confidence = "high"
            elif margin <= 0.10:
                confidence = "low"

        meta = {
            "confidence": confidence,
            "top_score": reranked[0].score_total if reranked else None,
            "margin": (reranked[0].score_total - reranked[1].score_total) if len(reranked) >= 2 else None,
            "weights": {
                "w_progress": self.w_progress,
                "w_adherence": self.w_adherence,
                "w_goal_fit": self.w_goal_fit,
                "w_novelty": self.w_novelty,
                "w_risk": self.w_risk,
            },
        }

        return reranked, meta

