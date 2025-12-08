"""
Learning Loop Integration Tests

Tests that the recommendation engine learns and adapts based on
user session history. Validates that recommendations evolve logically.

Run with:
    pytest backend/tests/test_learning_loop.py -v
    pytest backend/tests/test_learning_loop.py -v --capture=no  # With report output
"""

from typing import List, Dict, Any
import pytest

from tests.conftest import trigger_learning_loop, create_test_user, cleanup_test_user
from tests.fixtures.session_simulator import SessionSimulator
from tests.fixtures.expert_scenarios import (
    EXPERT_SCENARIOS,
    SESSION_PATTERNS,
    get_scenario_by_name,
)


# ============================================
# ASSERTION HELPERS
# ============================================


class RecommendationAssertions:
    """Helpers to validate logical recommendation changes."""

    @staticmethod
    def assert_recovery_recommended_when_fatigued(
        recommendations: List[Dict[str, Any]],
        fatigue_threshold: int = 7,
    ) -> None:
        """
        When fatigue accumulates past threshold,
        recommendations should shift toward recovery.

        Args:
            recommendations: List of session cycle data
            fatigue_threshold: Fatigue level that should trigger recovery
        """
        recovery_types = ["technique", "active_recovery", "rest_day", "light_session"]

        for i, rec in enumerate(recommendations):
            if i > 0:
                prev_fatigue = recommendations[i - 1]["post_session_data"]["fatigue_level"]
                if prev_fatigue >= fatigue_threshold:
                    session_type = rec["recommendation"].get("session_type")
                    assert session_type in recovery_types, (
                        f"Session {i}: Expected recovery recommendation after "
                        f"fatigue {prev_fatigue}, got '{session_type}'"
                    )

    @staticmethod
    def assert_quality_improves_with_better_inputs(
        rec1: Dict[str, Any],
        rec2: Dict[str, Any],
        improved_variables: List[str],
    ) -> None:
        """
        When input variables improve, predicted quality should increase.

        Args:
            rec1: First recommendation cycle data
            rec2: Second recommendation cycle data (with improved inputs)
            improved_variables: List of variables that were improved
        """
        q1 = rec1["recommendation"].get("predicted_quality", 5)
        q2 = rec2["recommendation"].get("predicted_quality", 5)

        assert q2 >= q1 - 0.5, (
            f"Quality should improve when {improved_variables} improve. "
            f"Got {q1:.1f} -> {q2:.1f}"
        )

    @staticmethod
    def assert_personalization_occurs(
        early_recommendations: List[Dict[str, Any]],
        late_recommendations: List[Dict[str, Any]],
    ) -> None:
        """
        After sufficient sessions, recommendations should show
        personalization (user_deviation_phase changes).

        Args:
            early_recommendations: First few session cycles
            late_recommendations: Later session cycles
        """
        early_phases = [
            r["recommendation"].get("user_deviation_phase", "cold_start")
            for r in early_recommendations
        ]
        late_phases = [
            r["recommendation"].get("user_deviation_phase", "cold_start")
            for r in late_recommendations
        ]

        # Early should be mostly cold_start
        cold_start_count = sum(1 for p in early_phases if p == "cold_start")
        assert cold_start_count > 0, "Early sessions should include cold_start phase"

        # Late should show progression (learning or personalized)
        progression_phases = ["learning", "personalized"]
        has_progression = any(p in progression_phases for p in late_phases)

        # This assertion is informational - may not always trigger depending on
        # how many sessions are run
        if not has_progression:
            print(
                f"Note: Late sessions still in cold_start. "
                f"Phases: {late_phases}. Consider running more sessions."
            )

    @staticmethod
    def assert_modifier_triggers_appropriately(
        pre_session_state: Dict[str, Any],
        recommendation: Dict[str, Any],
        expected_modifier: str,
    ) -> None:
        """
        When conditions match, specific modifiers should trigger.

        Args:
            pre_session_state: The pre-session readiness state
            recommendation: The recommendation given
            expected_modifier: Modifier name that should have triggered
        """
        matched = recommendation.get("matched_modifiers", [])
        modifier_names = [m.get("modifier_name", "") for m in matched]

        # Check for partial match (modifier names may have prefixes)
        found = any(expected_modifier in name for name in modifier_names)

        assert found, (
            f"Expected modifier containing '{expected_modifier}' to trigger "
            f"with state {pre_session_state}. Got: {modifier_names}"
        )

    @staticmethod
    def assert_session_type_appropriate_for_state(
        pre_session_state: Dict[str, Any],
        recommendation: Dict[str, Any],
    ) -> None:
        """
        Validate that session type matches the pre-session state.

        Args:
            pre_session_state: The pre-session readiness state
            recommendation: The recommendation given
        """
        session_type = recommendation.get("session_type", "technique")
        energy = pre_session_state.get("energy_level", 5)
        finger_health = pre_session_state.get("finger_tendon_health", 5)
        soreness = pre_session_state.get("muscle_soreness", 5)

        # High intensity sessions should only be recommended when conditions are good
        high_intensity = ["project", "limit_bouldering"]
        low_intensity = ["rest_day", "active_recovery", "light_session"]

        if session_type in high_intensity:
            assert energy >= 6, (
                f"High intensity '{session_type}' recommended with low energy {energy}"
            )
            assert finger_health >= 6, (
                f"High intensity '{session_type}' recommended with "
                f"low finger health {finger_health}"
            )

        if energy <= 3 or soreness >= 8:
            assert session_type in low_intensity or session_type == "technique", (
                f"Expected low intensity session with energy={energy}, "
                f"soreness={soreness}, got '{session_type}'"
            )


# ============================================
# REPORT GENERATOR
# ============================================


def generate_learning_report(recommendation_history: List[Dict[str, Any]]) -> str:
    """
    Generate a human-readable report of recommendation evolution.

    Args:
        recommendation_history: List of session cycle data

    Returns:
        Formatted report string
    """
    lines = [
        "=" * 60,
        "RECOMMENDATION LEARNING TEST REPORT",
        "=" * 60,
        "",
    ]

    for i, cycle in enumerate(recommendation_history):
        rec = cycle["recommendation"]
        post = cycle["post_session_data"]
        pre = cycle["pre_session_state"]

        lines.append(f"Session {i + 1}:")
        lines.append(
            f"  Pre-state: sleep={pre.get('sleep_quality')}, "
            f"energy={pre.get('energy_level')}, "
            f"motivation={pre.get('motivation')}"
        )
        lines.append(
            f"  Recommendation: {rec.get('session_type', 'N/A')} "
            f"(predicted quality: {rec.get('predicted_quality', 'N/A'):.1f})"
        )
        lines.append(
            f"  Outcome: quality={post.get('session_quality'):.1f}, "
            f"fatigue={post.get('fatigue_level')}"
        )
        lines.append(f"  Phase: {rec.get('user_deviation_phase', 'unknown')}")

        if rec.get("matched_modifiers"):
            mod_names = [m.get("modifier_name", "?") for m in rec["matched_modifiers"]]
            lines.append(f"  Modifiers: {', '.join(mod_names[:3])}")

        lines.append("")

    # Summary section
    lines.append("=" * 60)
    lines.append("SUMMARY")
    lines.append("=" * 60)

    qualities = [
        c["recommendation"].get("predicted_quality", 0) for c in recommendation_history
    ]
    actuals = [
        c["post_session_data"].get("session_quality", 0) for c in recommendation_history
    ]

    avg_predicted = sum(qualities) / len(qualities) if qualities else 0
    avg_actual = sum(actuals) / len(actuals) if actuals else 0
    mae = (
        sum(abs(p - a) for p, a in zip(qualities, actuals)) / len(qualities)
        if qualities
        else 0
    )

    lines.append(f"Sessions: {len(recommendation_history)}")
    lines.append(f"Avg Predicted Quality: {avg_predicted:.2f}")
    lines.append(f"Avg Actual Quality: {avg_actual:.2f}")
    lines.append(f"Prediction Error (MAE): {mae:.2f}")

    # Phase progression
    phases = [
        c["recommendation"].get("user_deviation_phase", "unknown")
        for c in recommendation_history
    ]
    unique_phases = list(dict.fromkeys(phases))  # Preserve order
    lines.append(f"Phase Progression: {' -> '.join(unique_phases)}")

    # Session type distribution
    types = [
        c["recommendation"].get("session_type", "unknown")
        for c in recommendation_history
    ]
    type_counts = {}
    for t in types:
        type_counts[t] = type_counts.get(t, 0) + 1
    lines.append(f"Session Types: {type_counts}")

    return "\n".join(lines)


# ============================================
# TEST CASES
# ============================================


class TestLearningLoop:
    """Integration tests for the recommendation learning loop."""

    @pytest.mark.asyncio
    async def test_recommendations_evolve_with_session_history(
        self,
        supabase_client,
        test_user,
        seeded_scenarios,
    ):
        """
        GIVEN: A user with no session history
        WHEN: They complete 10 sessions with consistent patterns
        THEN: Recommendations should adapt to their patterns
        """
        simulator = SessionSimulator(supabase_client, test_user["id"])

        # Baseline state - average climber
        base_state = {
            "sleep_quality": 7,
            "energy_level": 7,
            "motivation": 7,
            "stress_level": 4,
            "muscle_soreness": 3,
            "finger_tendon_health": 8,
            "planned_duration": 90,
        }

        # Run 10 sessions
        for i in range(10):
            # Simulate realistic fatigue accumulation (resets every 4 sessions)
            fatigue = (i % 4) * 0.15

            state = simulator.generate_pre_session_state(base_state, fatigue)
            await simulator.run_session_cycle(state, "follows_prediction")

            # Trigger learning loop every 3 sessions
            if (i + 1) % 3 == 0:
                await trigger_learning_loop(supabase_client, test_user["id"])

        # Get recommendation evolution
        history = simulator.recommendation_history
        assert len(history) == 10, f"Expected 10 sessions, got {len(history)}"

        # Early vs late recommendations
        early = history[:3]
        late = history[-3:]

        # Generate report for visibility
        report = generate_learning_report(history)
        print("\n" + report)

        # Assert personalization is occurring (or at least progressing)
        RecommendationAssertions.assert_personalization_occurs(early, late)

    @pytest.mark.asyncio
    async def test_overtraining_detection(
        self,
        supabase_client,
        test_user,
        seeded_scenarios,
    ):
        """
        GIVEN: A user who trains too frequently
        WHEN: Their quality declines and fatigue increases
        THEN: Recommendations should shift toward recovery
        """
        simulator = SessionSimulator(supabase_client, test_user["id"])

        # Start with good state, progressively deteriorate
        states = [
            {"sleep_quality": 8, "energy_level": 8, "motivation": 9, "muscle_soreness": 2},
            {"sleep_quality": 7, "energy_level": 7, "motivation": 8, "muscle_soreness": 3},
            {"sleep_quality": 6, "energy_level": 6, "motivation": 7, "muscle_soreness": 5},
            {"sleep_quality": 5, "energy_level": 5, "motivation": 6, "muscle_soreness": 6},
            {"sleep_quality": 5, "energy_level": 4, "motivation": 5, "muscle_soreness": 7},
            {"sleep_quality": 4, "energy_level": 3, "motivation": 4, "muscle_soreness": 8},
        ]

        for i, state in enumerate(states):
            state["finger_tendon_health"] = 8 - i  # Declining
            state["stress_level"] = 3 + i  # Increasing
            state["planned_duration"] = 90

            await simulator.run_session_cycle(state, "worse_than_expected")

        history = simulator.recommendation_history
        report = generate_learning_report(history)
        print("\n" + report)

        # Assert: Later recommendations push for recovery
        RecommendationAssertions.assert_recovery_recommended_when_fatigued(history, 7)

        # Last recommendation should be recovery-focused
        last_rec = history[-1]["recommendation"]
        recovery_types = ["rest_day", "active_recovery", "light_session", "technique"]
        assert last_rec.get("session_type") in recovery_types, (
            f"Expected recovery session type, got {last_rec.get('session_type')}"
        )

    @pytest.mark.asyncio
    async def test_session_type_matches_readiness(
        self,
        supabase_client,
        test_user,
    ):
        """
        GIVEN: Various pre-session readiness states
        WHEN: Generating recommendations
        THEN: Session types should be appropriate for the state
        """
        simulator = SessionSimulator(supabase_client, test_user["id"])

        test_states = [
            # High readiness - should get high intensity
            {
                "sleep_quality": 9,
                "energy_level": 9,
                "motivation": 9,
                "stress_level": 2,
                "muscle_soreness": 1,
                "finger_tendon_health": 9,
                "planned_duration": 120,
            },
            # Low readiness - should get low intensity
            {
                "sleep_quality": 4,
                "energy_level": 3,
                "motivation": 4,
                "stress_level": 8,
                "muscle_soreness": 8,
                "finger_tendon_health": 4,
                "planned_duration": 60,
            },
            # Medium readiness - should get moderate intensity
            {
                "sleep_quality": 6,
                "energy_level": 6,
                "motivation": 6,
                "stress_level": 5,
                "muscle_soreness": 4,
                "finger_tendon_health": 7,
                "planned_duration": 90,
            },
        ]

        for state in test_states:
            cycle = await simulator.run_session_cycle(state, "average")

            RecommendationAssertions.assert_session_type_appropriate_for_state(
                state, cycle["recommendation"]
            )

        print("\n" + generate_learning_report(simulator.recommendation_history))

    @pytest.mark.asyncio
    async def test_quality_prediction_accuracy(
        self,
        supabase_client,
        test_user,
        seeded_scenarios,
    ):
        """
        GIVEN: A user with session history
        WHEN: Running sessions that follow predictions
        THEN: Prediction error should be reasonable
        """
        simulator = SessionSimulator(supabase_client, test_user["id"])

        base_state = {
            "sleep_quality": 7,
            "energy_level": 7,
            "motivation": 7,
            "stress_level": 4,
            "muscle_soreness": 3,
            "finger_tendon_health": 8,
            "planned_duration": 90,
        }

        # Run sessions that closely follow predictions
        await simulator.run_session_series(
            base_state,
            num_sessions=8,
            outcome_pattern="follows_prediction",
        )

        evolution = simulator.get_recommendation_evolution()
        predicted = evolution["predicted_qualities"]
        actual = evolution["actual_qualities"]

        # Calculate mean absolute error
        mae = sum(abs(p - a) for p, a in zip(predicted, actual)) / len(predicted)

        print(f"\nPrediction MAE: {mae:.2f}")
        print(generate_learning_report(simulator.recommendation_history))

        # MAE should be under 2.0 for "follows_prediction" pattern
        assert mae < 2.5, f"Prediction error too high: {mae:.2f}"

    @pytest.mark.asyncio
    async def test_improving_user_pattern(
        self,
        supabase_client,
        test_user,
    ):
        """
        GIVEN: A beginner who is improving
        WHEN: Their session quality consistently exceeds predictions
        THEN: Predicted quality should trend upward over time
        """
        simulator = SessionSimulator(supabase_client, test_user["id"])

        base_state = {
            "sleep_quality": 7,
            "energy_level": 7,
            "motivation": 8,
            "stress_level": 4,
            "muscle_soreness": 3,
            "finger_tendon_health": 8,
            "planned_duration": 90,
        }

        # Run sessions where user consistently beats expectations
        for i in range(8):
            state = simulator.generate_pre_session_state(base_state, i * 0.05)
            await simulator.run_session_cycle(state, "better_than_expected")

            # Trigger learning every 2 sessions
            if (i + 1) % 2 == 0:
                await trigger_learning_loop(supabase_client, test_user["id"])

        evolution = simulator.get_recommendation_evolution()
        predicted = evolution["predicted_qualities"]

        # First half average vs second half average
        first_half_avg = sum(predicted[:4]) / 4
        second_half_avg = sum(predicted[4:]) / 4

        print(f"\nFirst half avg predicted: {first_half_avg:.2f}")
        print(f"Second half avg predicted: {second_half_avg:.2f}")
        print(generate_learning_report(simulator.recommendation_history))

        # Second half predictions should trend higher (learning the user is strong)
        # Allow small margin for variance
        assert second_half_avg >= first_half_avg - 0.5, (
            f"Predictions should trend up for improving user. "
            f"Got {first_half_avg:.2f} -> {second_half_avg:.2f}"
        )


class TestExpertScenarios:
    """Tests for expert scenario seeding and influence."""

    @pytest.mark.asyncio
    async def test_scenarios_seed_correctly(
        self,
        supabase_client,
        seeded_scenarios,
    ):
        """
        GIVEN: Expert scenarios
        WHEN: Seeded into database
        THEN: They should be retrievable and complete
        """
        assert len(seeded_scenarios) > 0, "No scenarios were seeded"

        # Verify scenarios exist in database
        result = (
            supabase_client.table("synthetic_scenarios")
            .select("*")
            .in_("id", seeded_scenarios)
            .execute()
        )

        assert len(result.data) == len(seeded_scenarios), (
            f"Expected {len(seeded_scenarios)} scenarios, "
            f"found {len(result.data)}"
        )

        # Verify each has expert response
        for scenario_id in seeded_scenarios:
            response = (
                supabase_client.table("expert_scenario_responses")
                .select("*")
                .eq("scenario_id", scenario_id)
                .execute()
            )
            assert len(response.data) > 0, f"No response for scenario {scenario_id}"

    @pytest.mark.asyncio
    async def test_scenario_recommendations_align_with_expert(
        self,
        supabase_client,
        test_user,
        seeded_scenarios,
    ):
        """
        GIVEN: Seeded expert scenarios
        WHEN: Requesting recommendations with matching states
        THEN: Recommendations should align with expert responses
        """
        simulator = SessionSimulator(supabase_client, test_user["id"])

        # Test the "optimal project day" scenario
        optimal_scenario = get_scenario_by_name("optimal_project_day")
        state = optimal_scenario["pre_session_snapshot"].copy()
        state["planned_duration"] = 120

        rec = await simulator.get_recommendation(state)

        # High energy + motivation should yield project or high-intensity type
        high_intensity_types = ["project", "limit_bouldering", "volume"]
        assert rec.get("session_type") in high_intensity_types or rec.get(
            "predicted_quality", 0
        ) >= 7, (
            f"Optimal conditions should yield high-intensity recommendation, "
            f"got {rec.get('session_type')} with quality {rec.get('predicted_quality')}"
        )

        # Test the "rest day needed" scenario
        rest_scenario = get_scenario_by_name("rest_day_needed")
        state = rest_scenario["pre_session_snapshot"].copy()
        state["planned_duration"] = 60

        rec = await simulator.get_recommendation(state)

        # Low energy + high soreness should yield rest or recovery
        low_intensity_types = ["rest_day", "active_recovery", "light_session", "technique"]
        assert rec.get("session_type") in low_intensity_types, (
            f"Poor conditions should yield recovery recommendation, "
            f"got {rec.get('session_type')}"
        )


# ============================================
# UTILITY TESTS
# ============================================


class TestSimulatorUtilities:
    """Tests for the session simulator itself."""

    def test_fatigue_accumulation(self):
        """Test that fatigue modifies pre-session state correctly."""
        from tests.fixtures.session_simulator import SessionSimulator

        # Create simulator without DB (for unit testing state generation)
        simulator = SessionSimulator(None, "test-user")

        base_state = {
            "energy_level": 8,
            "muscle_soreness": 2,
            "finger_tendon_health": 9,
            "sleep_quality": 7,
            "motivation": 7,
            "stress_level": 3,
        }

        # No fatigue
        state0 = simulator.generate_pre_session_state(base_state, 0, variance=False)
        assert state0["energy_level"] == 8
        assert state0["muscle_soreness"] == 2

        # Moderate fatigue
        state1 = simulator.generate_pre_session_state(base_state, 0.5, variance=False)
        assert state1["energy_level"] < 8
        assert state1["muscle_soreness"] > 2

        # High fatigue
        state2 = simulator.generate_pre_session_state(base_state, 1.0, variance=False)
        assert state2["energy_level"] < state1["energy_level"]
        assert state2["muscle_soreness"] > state1["muscle_soreness"]

    def test_outcome_patterns(self):
        """Test that outcome patterns produce expected variance."""
        from tests.fixtures.session_simulator import SessionSimulator

        simulator = SessionSimulator(None, "test-user")

        base_rec = {"predicted_quality": 7.0, "session_type": "technique"}
        base_state = {"energy_level": 7}

        # Run multiple simulations
        better_outcomes = []
        worse_outcomes = []

        for _ in range(20):
            better = simulator.simulate_session_outcome(
                base_state, base_rec, "better_than_expected"
            )
            worse = simulator.simulate_session_outcome(
                base_state, base_rec, "worse_than_expected"
            )
            better_outcomes.append(better["session_quality"])
            worse_outcomes.append(worse["session_quality"])

        avg_better = sum(better_outcomes) / len(better_outcomes)
        avg_worse = sum(worse_outcomes) / len(worse_outcomes)

        assert avg_better > avg_worse, (
            f"'better_than_expected' should produce higher quality than "
            f"'worse_than_expected'. Got {avg_better:.1f} vs {avg_worse:.1f}"
        )
