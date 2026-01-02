from __future__ import annotations

from dataclasses import dataclass

from app.services.reranker_service import RerankerService


@dataclass
class _FakeCandidate:
    action_id: str
    session_type: str
    predicted_quality: float
    planned_workout: dict
    planned_dose_features: dict
    predicted_outcomes: dict
    rationale: dict


def test_risk_penalty_increases_with_injury_for_high_intensity() -> None:
    user_state_low = {"injury_severity": 1, "acwr": 1.0, "acwr_risk_zone": "optimal", "muscle_soreness": 5}
    user_state_high = {"injury_severity": 8, "acwr": 1.0, "acwr_risk_zone": "optimal", "muscle_soreness": 5}

    cand = _FakeCandidate(
        action_id="a",
        session_type="limit_bouldering",
        predicted_quality=7.0,
        planned_workout={"time_cap_min": 90},
        planned_dose_features={"summary": {"item_count": 6}},
        predicted_outcomes={"predicted_quality": 7.0},
        rationale={},
    )

    rr = RerankerService()
    r1, _ = rr.rerank(user_state=user_state_low, candidates=[cand], recent_action_ids=[])
    r2, _ = rr.rerank(user_state=user_state_high, candidates=[cand], recent_action_ids=[])

    assert r2[0].score_components["risk_penalty"] > r1[0].score_components["risk_penalty"]
    assert r2[0].score_total < r1[0].score_total


def test_adherence_penalizes_time_over_budget() -> None:
    user_state = {"planned_duration": 60, "energy_level": 6, "muscle_soreness": 5}

    cand_ok = _FakeCandidate(
        action_id="a",
        session_type="technique",
        predicted_quality=6.0,
        planned_workout={"time_cap_min": 60},
        planned_dose_features={"summary": {"item_count": 4}},
        predicted_outcomes={"predicted_quality": 6.0},
        rationale={},
    )
    cand_over = _FakeCandidate(
        action_id="b",
        session_type="technique",
        predicted_quality=6.0,
        planned_workout={"time_cap_min": 120},
        planned_dose_features={"summary": {"item_count": 4}},
        predicted_outcomes={"predicted_quality": 6.0},
        rationale={},
    )

    rr = RerankerService()
    r_ok, _ = rr.rerank(user_state=user_state, candidates=[cand_ok], recent_action_ids=[])
    r_over, _ = rr.rerank(user_state=user_state, candidates=[cand_over], recent_action_ids=[])

    assert r_ok[0].score_components["reward_adherence"] > r_over[0].score_components["reward_adherence"]


def test_novelty_rewards_unseen_action_id() -> None:
    user_state = {"planned_duration": 90}
    cand = _FakeCandidate(
        action_id="seen",
        session_type="volume",
        predicted_quality=6.5,
        planned_workout={"time_cap_min": 90},
        planned_dose_features={"summary": {"item_count": 6}},
        predicted_outcomes={"predicted_quality": 6.5},
        rationale={},
    )

    rr = RerankerService()
    r_seen, _ = rr.rerank(user_state=user_state, candidates=[cand], recent_action_ids=["seen"])
    r_new, _ = rr.rerank(user_state=user_state, candidates=[cand], recent_action_ids=["other"])

    assert r_new[0].score_components["novelty"] > r_seen[0].score_components["novelty"]

