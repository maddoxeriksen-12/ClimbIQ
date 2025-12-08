"""
Session Simulator for Learning Loop Tests

Simulates climbing sessions with realistic outcomes to test
how the recommendation engine learns and adapts.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import random
import uuid


class SessionSimulator:
    """Simulates climbing sessions with realistic outcomes."""

    def __init__(self, supabase_client, user_id: str, api_base_url: str = None):
        """
        Initialize the session simulator.

        Args:
            supabase_client: Supabase client instance
            user_id: User ID to simulate sessions for
            api_base_url: Optional API base URL for recommendation calls
        """
        self.client = supabase_client
        self.user_id = user_id
        self.api_base_url = api_base_url
        self.session_count = 0
        self.recommendation_history: List[Dict] = []
        self.cumulative_fatigue = 0.0
        self._session_date = datetime.utcnow()

    def generate_pre_session_state(
        self,
        base_state: Dict[str, Any],
        fatigue_accumulation: float = 0,
        variance: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate pre-session state with optional fatigue modifier.

        Args:
            base_state: Base pre-session metrics
            fatigue_accumulation: Additional fatigue modifier (0-1 scale)
            variance: Whether to add realistic daily variance

        Returns:
            Modified pre-session state dictionary
        """
        state = base_state.copy()

        # Apply fatigue accumulation (reduces energy, increases soreness)
        fatigue_effect = int(fatigue_accumulation * 2)
        state["energy_level"] = max(1, state.get("energy_level", 7) - fatigue_effect)
        state["muscle_soreness"] = min(
            10, state.get("muscle_soreness", 3) + fatigue_effect
        )

        # Fatigue also affects finger health slightly
        if fatigue_accumulation > 0.3:
            state["finger_tendon_health"] = max(
                1, state.get("finger_tendon_health", 8) - 1
            )

        # Add realistic daily variance (±1)
        if variance:
            for key in ["sleep_quality", "motivation", "stress_level"]:
                if key in state:
                    variation = random.choice([-1, 0, 0, 1])
                    state[key] = max(1, min(10, state[key] + variation))

        return state

    def simulate_session_outcome(
        self,
        pre_session_state: Dict[str, Any],
        recommendation: Dict[str, Any],
        outcome_pattern: str = "average",
    ) -> Dict[str, Any]:
        """
        Simulate a session and return post-session data.

        Args:
            pre_session_state: Pre-session readiness metrics
            recommendation: The recommendation that was given
            outcome_pattern: Pattern for outcome variance

        Returns:
            Post-session outcome data
        """
        # Base quality from recommendation
        predicted_quality = recommendation.get("predicted_quality", 5.0)

        # Determine actual quality based on pattern
        if outcome_pattern == "follows_prediction":
            actual_quality = predicted_quality + random.uniform(-0.5, 0.5)
        elif outcome_pattern == "better_than_expected":
            actual_quality = predicted_quality + random.uniform(0.5, 2.0)
        elif outcome_pattern == "worse_than_expected":
            actual_quality = predicted_quality - random.uniform(0.5, 2.0)
        elif outcome_pattern == "highly_variable":
            actual_quality = predicted_quality + random.uniform(-2, 2)
        else:
            # Average pattern with moderate variance
            actual_quality = predicted_quality + random.uniform(-1, 1)

        actual_quality = max(1, min(10, actual_quality))

        # Fatigue influenced by session intensity and duration
        session_type = recommendation.get("session_type", "technique")
        intensity_fatigue = {
            "project": 7,
            "limit_bouldering": 7,
            "volume": 6,
            "technique": 4,
            "active_recovery": 2,
            "rest_day": 0,
            "light_session": 3,
        }
        base_fatigue = intensity_fatigue.get(session_type, 5)
        fatigue_level = base_fatigue + random.randint(-1, 2)
        fatigue_level = max(1, min(10, fatigue_level))

        # RPE influenced by pre-session state and actual quality
        energy = pre_session_state.get("energy_level", 7)
        rpe = 10 - energy + random.randint(0, 2)
        rpe = max(1, min(10, rpe))

        # Completion status
        if actual_quality < 4 or pre_session_state.get("energy_level", 7) < 4:
            completed_as_planned = random.random() > 0.5
        else:
            completed_as_planned = random.random() > 0.15

        return {
            "session_quality": round(actual_quality, 1),
            "fatigue_level": fatigue_level,
            "rpe": rpe,
            "completed_as_planned": completed_as_planned,
            "actual_duration_minutes": recommendation.get(
                "recommended_duration", 90
            )
            + random.randint(-15, 15),
        }

    async def get_recommendation(
        self, pre_session_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get a recommendation from the engine for the given state.

        Args:
            pre_session_state: Pre-session readiness metrics

        Returns:
            Recommendation dictionary
        """
        try:
            # Use the actual recommendation engine
            from app.api.routes.recommendation_core.recommendation_engine import RecommendationEngine

            if not hasattr(self, '_engine'):
                self._engine = RecommendationEngine(self.client)

            recommendation = self._engine.generate_recommendation(pre_session_state, user_id=self.user_id)
            return recommendation
        except Exception as e:
            print(f"  Recommendation engine error: {e}")
            # Fallback - calculate basic recommendation from state
            return self._fallback_recommendation(pre_session_state)

    def _fallback_recommendation(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a basic recommendation when engine fails."""
        energy = state.get("energy_level", 5)
        motivation = state.get("motivation", 5)
        finger_health = state.get("finger_tendon_health", 8)
        soreness = state.get("muscle_soreness", 5)

        readiness = (energy + motivation + (10 - soreness) + finger_health) / 4

        if readiness >= 8 and finger_health >= 7:
            session_type = "project"
            duration = 120
        elif readiness >= 6:
            session_type = "volume"
            duration = 100
        elif readiness >= 4:
            session_type = "technique"
            duration = 90
        else:
            session_type = "active_recovery"
            duration = 60

        return {
            "session_type": session_type,
            "predicted_quality": round(readiness * 0.8, 1),
            "recommended_duration": duration,
            "warmup_duration": 15,
            "user_deviation_phase": "cold_start",
            "matched_modifiers": [],
        }

    async def create_session(
        self,
        pre_session_state: Dict[str, Any],
        recommendation: Dict[str, Any],
    ) -> str:
        """
        Create a session record in the database.

        Args:
            pre_session_state: Pre-session readiness metrics
            recommendation: Recommendation that was given

        Returns:
            Session ID
        """
        session_data = {
            "id": str(uuid.uuid4()),
            "user_id": self.user_id,
            "started_at": self._session_date.isoformat(),
            "pre_session_data": pre_session_state,
            "prediction_snapshot": recommendation,
            "session_type": recommendation.get("session_type", "technique"),
            "planned_session_type": recommendation.get("session_type", "technique"),
            "planned_duration_minutes": recommendation.get("recommended_duration", 90),
            "planned_warmup_min": recommendation.get("warmup_duration", 15),
            "status": "active",
            "location": "gym",
            "is_outdoor": False,
            "is_project_session": False,
            "sleep_quality": pre_session_state.get("sleep_quality", 7),
            "energy_level": pre_session_state.get("energy_level", 7),
            "motivation": pre_session_state.get("motivation", 7),
            "stress_level": pre_session_state.get("stress_level", 5),
            "muscle_soreness": pre_session_state.get("muscle_soreness", 3),
            "had_caffeine": False,
            "had_alcohol": False,
            "had_pain_before": False,
            "had_pain_after": False,
            "deviated_from_plan": False,
            "created_at": datetime.utcnow().isoformat(),
        }

        result = (
            self.client.table("climbing_sessions").insert(session_data).execute()
        )

        return result.data[0]["id"] if result.data else session_data["id"]

    async def complete_session(
        self,
        session_id: str,
        post_session_data: Dict[str, Any],
    ) -> None:
        """
        Complete a session with post-session data.

        Args:
            session_id: Session ID to complete
            post_session_data: Post-session outcome data
        """
        # Ensure numeric values are integers for DB
        session_quality = post_session_data.get("session_quality")
        session_rpe = post_session_data.get("rpe")
        actual_duration = post_session_data.get("actual_duration_minutes")

        update_data = {
            "status": "completed",
            "post_session_data": post_session_data,
            "session_quality": int(session_quality) if session_quality else None,
            "session_rpe": int(session_rpe) if session_rpe else None,
            "actual_duration_minutes": int(actual_duration) if actual_duration else None,
            "actual_duration_min": int(actual_duration) if actual_duration else None,
            "ended_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        self.client.table("climbing_sessions").update(update_data).eq(
            "id", session_id
        ).execute()

    async def run_session_cycle(
        self,
        pre_session_state: Dict[str, Any],
        outcome_pattern: str = "average",
    ) -> Dict[str, Any]:
        """
        Run one complete session cycle.

        1. Get recommendation
        2. Create session
        3. Complete session with outcome
        4. Return tracking data

        Args:
            pre_session_state: Pre-session readiness metrics
            outcome_pattern: Pattern for outcome simulation

        Returns:
            Complete cycle data for analysis
        """
        # 1. Get recommendation
        recommendation = await self.get_recommendation(pre_session_state)

        # 2. Create session in database
        session_id = await self.create_session(pre_session_state, recommendation)

        # 3. Simulate and complete session
        post_data = self.simulate_session_outcome(
            pre_session_state, recommendation, outcome_pattern
        )
        await self.complete_session(session_id, post_data)

        # 4. Track for analysis
        self.session_count += 1
        self.cumulative_fatigue += post_data.get("fatigue_level", 5) * 0.1

        # Advance simulated date
        self._session_date += timedelta(days=random.choice([1, 2, 2, 3]))

        cycle_data = {
            "session_number": self.session_count,
            "session_date": self._session_date.isoformat(),
            "pre_session_state": pre_session_state,
            "recommendation": recommendation,
            "post_session_data": post_data,
            "session_id": session_id,
            "cumulative_fatigue": self.cumulative_fatigue,
        }
        self.recommendation_history.append(cycle_data)

        return cycle_data

    async def run_session_series(
        self,
        base_state: Dict[str, Any],
        num_sessions: int,
        outcome_pattern: str = "average",
        fatigue_recovery_rate: float = 0.3,
    ) -> List[Dict[str, Any]]:
        """
        Run a series of sessions with fatigue accumulation.

        Args:
            base_state: Base pre-session state
            num_sessions: Number of sessions to simulate
            outcome_pattern: Pattern for all sessions
            fatigue_recovery_rate: How quickly fatigue recovers between sessions

        Returns:
            List of all cycle data
        """
        cycles = []

        for i in range(num_sessions):
            # Calculate effective fatigue (recovers between sessions)
            effective_fatigue = max(
                0, self.cumulative_fatigue - (i * fatigue_recovery_rate * 0.5)
            )

            # Generate state with current fatigue level
            state = self.generate_pre_session_state(base_state, effective_fatigue)

            # Run the cycle
            cycle = await self.run_session_cycle(state, outcome_pattern)
            cycles.append(cycle)

        return cycles

    def reset(self) -> None:
        """Reset the simulator state."""
        self.session_count = 0
        self.recommendation_history = []
        self.cumulative_fatigue = 0.0
        self._session_date = datetime.utcnow()

    def get_recommendation_evolution(self) -> Dict[str, List]:
        """
        Analyze how recommendations have evolved.

        Returns:
            Dictionary with evolution metrics
        """
        if not self.recommendation_history:
            return {}

        return {
            "session_types": [
                c["recommendation"].get("session_type")
                for c in self.recommendation_history
            ],
            "predicted_qualities": [
                c["recommendation"].get("predicted_quality")
                for c in self.recommendation_history
            ],
            "actual_qualities": [
                c["post_session_data"].get("session_quality")
                for c in self.recommendation_history
            ],
            "phases": [
                c["recommendation"].get("user_deviation_phase")
                for c in self.recommendation_history
            ],
            "fatigue_levels": [
                c["post_session_data"].get("fatigue_level")
                for c in self.recommendation_history
            ],
        }
