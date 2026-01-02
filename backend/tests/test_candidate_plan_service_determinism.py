from __future__ import annotations

from app.services.candidate_plan_service import _suggest_candidate_session_types


def test_candidate_session_type_order_is_deterministic() -> None:
    types1 = _suggest_candidate_session_types(
        base_session_type="volume",
        rule_session_type=None,
        adjusted_quality=6.0,
    )
    types2 = _suggest_candidate_session_types(
        base_session_type="volume",
        rule_session_type=None,
        adjusted_quality=6.0,
    )

    assert types1 == types2
    assert types1[0] == "volume"


def test_low_quality_includes_recovery_and_rest() -> None:
    types = _suggest_candidate_session_types(
        base_session_type="project",
        rule_session_type=None,
        adjusted_quality=3.5,
    )
    assert "active_recovery" in types
    assert "rest_day" in types

