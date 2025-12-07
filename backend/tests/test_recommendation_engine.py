import math
from datetime import datetime, timedelta
from typing import Any, Dict, List

from app.api.routes.recommendation_core.recommendation_engine import RecommendationEngine


class _FakeResult:
    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data


class _FakeTable:
    def __init__(self, name: str, data: List[Dict[str, Any]]):
        self._name = name
        self._data = data

    # The engine only calls select("*").execute() on these tables,
    # so the intermediate methods can simply return self.
    def select(self, *_args, **_kwargs) -> "_FakeTable":
        return self

    def eq(self, *_args, **_kwargs) -> "_FakeTable":
        return self

    def order(self, *_args, **_kwargs) -> "_FakeTable":
        return self

    def execute(self) -> _FakeResult:
        return _FakeResult(self._data)


class FakeSupabase:
    """
    Minimal supabase client stub to exercise the RecommendationEngine
    logic without hitting a real database.
    """

    def __init__(self, population_priors: List[Dict[str, Any]], expert_rules: List[Dict[str, Any]]):
        self._population_priors = population_priors
        self._expert_rules = expert_rules

    def table(self, name: str) -> _FakeTable:
        if name == "population_priors":
            return _FakeTable(name, self._population_priors)
        if name == "expert_rules":
            return _FakeTable(name, self._expert_rules)
        # Any other table: return empty
        return _FakeTable(name, [])


def _make_engine_with_priors(priors: Dict[str, float]) -> RecommendationEngine:
    """
    Helper to construct an engine with simple population priors.
    `priors` is a mapping from variable_name -> population_mean.
    """
    population_rows = [
        {
            "variable_name": name,
            "population_mean": mean,
            "population_std": 0.1,
            "individual_variance": 0.01,
            "source": "test",
            "confidence": "high",
            "variable_category": "test",
            "description": f"test prior for {name}",
            "metadata": {},
        }
        for name, mean in priors.items()
    ]
    fake = FakeSupabase(population_rows, expert_rules=[])
    engine = RecommendationEngine(fake)

    # Force cache refresh on first call
    engine._cache_timestamp = None  # type: ignore[attr-defined]
    return engine


def test_sleep_quality_changes_predicted_quality():
    """
    Increasing sleep_quality should increase predicted_quality when
    the sleep_quality prior has a positive effect.
    """
    engine = _make_engine_with_priors({"sleep_quality": 0.25})

    low_sleep_state = {"sleep_quality": 3}
    high_sleep_state = {"sleep_quality": 9}

    rec_low = engine.generate_recommendation(low_sleep_state)
    rec_high = engine.generate_recommendation(high_sleep_state)

    assert rec_high["predicted_quality"] > rec_low["predicted_quality"]


def test_warmup_priors_influence_warmup_message():
    """
    Changing the warmup_duration_min prior sign should flip the
    warmup suggestion between 'extended' and 'short'.
    """
    # Case 1: Positive effect -> extended warmup
    engine_pos = _make_engine_with_priors({"warmup_duration_min": 0.05})
    rec_pos = engine_pos.generate_recommendation({"warmup_completed": False})
    warmup_msgs_pos = [s["message"] for s in rec_pos["suggestions"] if s["type"] == "warmup"]
    assert any("extended 20-25" in msg or "extended" in msg for msg in warmup_msgs_pos)

    # Case 2: Negative effect -> short warmup
    engine_neg = _make_engine_with_priors({"warmup_duration_min": -0.05})
    rec_neg = engine_neg.generate_recommendation({"warmup_completed": False})
    warmup_msgs_neg = [s["message"] for s in rec_neg["suggestions"] if s["type"] == "warmup"]
    assert any("short" in msg or "5-10" in msg for msg in warmup_msgs_neg)


def test_rest_priors_influence_structure_recommendation():
    """
    main_session_rest_level priors should adjust session-structure suggestions.
    """
    engine = _make_engine_with_priors({"main_session_rest_level": 0.2})

    # High-quality day with projecting-type session
    user_state = {
        "energy_level": 9,
        "motivation": 9,
        "muscle_soreness": 3,
    }

    rec = engine.generate_recommendation(user_state)
    structure_msgs = [s["message"] for s in rec["suggestions"] if s["type"] == "structure"]

    # With positive rest-level effect, we expect a long-rest recommendation
    assert any("long rests" in msg or "3-5 min" in msg for msg in structure_msgs)


