"""
Pytest Configuration and Fixtures for ClimbIQ Tests

Provides shared fixtures for database access, test users, and cleanup.
"""

import os
import uuid
from datetime import datetime
from typing import Generator, Dict, Any

import pytest
from supabase import create_client, Client

from tests.fixtures.expert_scenarios import seed_expert_scenarios, cleanup_scenarios
from tests.fixtures.session_simulator import SessionSimulator


@pytest.fixture(scope="session")
def supabase_client() -> Client:
    """
    Create a Supabase client for testing.

    Uses environment variables for connection details.
    Set SUPABASE_URL and SUPABASE_SERVICE_KEY for integration tests.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

    if not url or not key:
        pytest.skip("Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.")

    return create_client(url, key)


@pytest.fixture
async def test_user(supabase_client: Client) -> Generator[Dict[str, Any], None, None]:
    """
    Create a fresh test user for each test.

    Yields the user data and cleans up after the test.
    """
    user_id = str(uuid.uuid4())
    user_data = {
        "id": user_id,
        "email": f"test_{user_id[:8]}@climbiq-test.local",
        "created_at": datetime.utcnow().isoformat(),
    }

    # Create user in profiles table
    profile_data = {
        "id": user_id,
        "email": user_data["email"],
        "max_grade": "V5",
        "years_climbing": 2,
        "sessions_per_week": 3,
        "created_at": datetime.utcnow().isoformat(),
    }

    supabase_client.table("profiles").insert(profile_data).execute()

    yield {**user_data, **profile_data}

    # Cleanup: Delete all user data
    await cleanup_test_user(supabase_client, user_id)


async def cleanup_test_user(supabase_client: Client, user_id: str) -> None:
    """
    Remove all data associated with a test user.

    Args:
        supabase_client: Supabase client instance
        user_id: User ID to clean up
    """
    # Order matters due to foreign key constraints

    # Delete prediction accuracy records
    supabase_client.table("prediction_accuracy").delete().eq(
        "user_id", user_id
    ).execute()

    # Delete session execution state
    supabase_client.table("session_execution_state").delete().eq(
        "user_id", user_id
    ).execute()

    # Delete sessions
    supabase_client.table("climbing_sessions").delete().eq(
        "user_id", user_id
    ).execute()

    # Delete model outputs
    supabase_client.table("model_outputs").delete().eq(
        "user_id", user_id
    ).execute()

    # Delete user deviations
    supabase_client.table("user_deviation_metrics").delete().eq(
        "user_id", user_id
    ).execute()

    # Delete fatigue tracking
    supabase_client.table("user_fatigue_metrics").delete().eq(
        "user_id", user_id
    ).execute()

    # Delete profile
    supabase_client.table("profiles").delete().eq("id", user_id).execute()


@pytest.fixture
async def seeded_scenarios(
    supabase_client: Client,
) -> Generator[list[str], None, None]:
    """
    Seed expert scenarios before tests.

    Yields scenario IDs and cleans up after.
    """
    scenario_ids = await seed_expert_scenarios(supabase_client)
    yield scenario_ids
    await cleanup_scenarios(supabase_client, scenario_ids)


@pytest.fixture
def session_simulator(
    supabase_client: Client, test_user: Dict[str, Any]
) -> SessionSimulator:
    """
    Create a session simulator for the test user.
    """
    return SessionSimulator(supabase_client, test_user["id"])


async def create_test_user(
    supabase_client: Client,
    profile_override: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """
    Manually create a test user with optional profile overrides.

    Args:
        supabase_client: Supabase client instance
        profile_override: Optional profile field overrides

    Returns:
        Created user data
    """
    user_id = str(uuid.uuid4())
    profile_data = {
        "id": user_id,
        "email": f"test_{user_id[:8]}@climbiq-test.local",
        "max_grade": "V5",
        "years_climbing": 2,
        "sessions_per_week": 3,
        "created_at": datetime.utcnow().isoformat(),
    }

    if profile_override:
        profile_data.update(profile_override)

    supabase_client.table("profiles").insert(profile_data).execute()

    return profile_data


async def trigger_learning_loop(supabase_client: Client, user_id: str) -> None:
    """
    Manually trigger the learning loop for a user.

    In production this runs via Dagster; in tests we call directly.

    Args:
        supabase_client: Supabase client instance
        user_id: User to trigger learning for
    """
    try:
        # Record prediction accuracy for recent sessions via RPC if available
        try:
            supabase_client.rpc(
                "record_prediction_accuracy",
                {"p_user_id": user_id}
            ).execute()
        except Exception:
            pass  # RPC may not exist yet

        # Fetch recent sessions to calculate prediction accuracy
        sessions = (
            supabase_client.table("climbing_sessions")
            .select("id, prediction_snapshot, session_quality, post_session_data")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )

        if sessions.data and len(sessions.data) >= 3:
            # Calculate average prediction error
            errors = []
            for session in sessions.data:
                prediction = session.get("prediction_snapshot") or {}
                predicted = prediction.get("predicted_quality", 5)
                actual = session.get("session_quality", 5)
                if predicted and actual:
                    errors.append(actual - predicted)

            if errors:
                avg_deviation = sum(errors) / len(errors)
                session_count = len(sessions.data)

                # Determine phase based on session count
                if session_count < 5:
                    phase = "cold_start"
                elif session_count < 15:
                    phase = "learning"
                else:
                    phase = "personalized"

                # Try to update model_outputs table (may not have all columns)
                try:
                    model_data = {
                        "user_id": user_id,
                        "user_deviation_phase": phase,
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                    supabase_client.table("model_outputs").upsert(
                        model_data,
                        on_conflict="user_id"
                    ).execute()
                except Exception:
                    pass  # Table may have different schema

    except Exception as e:
        # Learning loop is optional - don't fail the test
        print(f"  Learning loop skipped: {e}")
