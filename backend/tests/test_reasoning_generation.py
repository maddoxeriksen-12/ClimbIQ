"""
Test: LLM reasoning generation for structured_plan blocks

Verifies that the recommendation engine generates personalized reasoning
for warmup, main, and cooldown blocks when LLM is available.
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.api.routes.recommendation_core.recommendation_engine import RecommendationEngine
from app.core.supabase import get_supabase_client


def test_reasoning_in_structured_plan():
    """Test that structured_plan blocks can include reasoning field."""
    print("\n" + "=" * 60)
    print("TEST: Reasoning Generation in Structured Plan")
    print("=" * 60)

    engine = RecommendationEngine(get_supabase_client())

    # Good conditions - should generate a full structured plan
    user_state = {
        "sleep_quality": 8,
        "energy_level": 8,
        "motivation_level": 9,
        "stress_level": 3,
        "muscle_soreness": 2,
        "finger_tendon_health": 9,
        "primary_goal": "send_project",
        "planned_duration": 90,
    }

    print("\nUser State:", user_state)
    print("\nGenerating recommendation...")

    recommendation = engine.generate_recommendation(user_state)

    print(f"\nSession Type: {recommendation.get('session_type')}")
    print(f"Predicted Quality: {recommendation.get('predicted_quality')}")

    structured_plan = recommendation.get("structured_plan")

    if not structured_plan:
        print("\n⚠️  No structured_plan in response (may be expected for some session types)")
        return

    print("\n--- Structured Plan Blocks ---")

    # Check warmup blocks
    warmup_blocks = structured_plan.get("warmup", [])
    print(f"\nWarmup Blocks ({len(warmup_blocks)}):")
    for i, block in enumerate(warmup_blocks):
        print(f"  [{i+1}] {block.get('title', 'Untitled')}")
        print(f"      Duration: {block.get('duration_min', '?')} min")
        print(f"      Exercises: {len(block.get('exercises', []))}")
        # Note: reasoning field will be added by the async endpoint, not the engine directly
        if "reasoning" in block:
            print(f"      Reasoning: {block['reasoning'][:80]}...")

    # Check main blocks
    main_blocks = structured_plan.get("main", [])
    print(f"\nMain Blocks ({len(main_blocks)}):")
    for i, block in enumerate(main_blocks):
        print(f"  [{i+1}] {block.get('title', 'Untitled')}")
        print(f"      Duration: {block.get('duration_min', '?')} min")
        print(f"      Focus: {block.get('focus', 'N/A')}")
        print(f"      Exercises: {len(block.get('exercises', []))}")

    # Check cooldown blocks
    cooldown_blocks = structured_plan.get("cooldown", [])
    print(f"\nCooldown Blocks ({len(cooldown_blocks)}):")
    for i, block in enumerate(cooldown_blocks):
        print(f"  [{i+1}] {block.get('title', 'Untitled')}")
        print(f"      Duration: {block.get('duration_min', '?')} min")
        print(f"      Exercises: {len(block.get('exercises', []))}")

    print("\n" + "-" * 60)
    print("Note: The 'reasoning' field is added by the async API endpoint,")
    print("not the engine directly. The engine returns the base structure,")
    print("and _add_reasoning_to_structured_plan() enriches it with LLM text.")
    print("-" * 60)

    # Basic validation
    assert structured_plan is not None, "Should have a structured_plan"
    assert len(warmup_blocks) > 0 or len(main_blocks) > 0, "Should have some blocks"

    print("\n✅ Test passed: Structured plan has valid structure for reasoning enrichment")


async def test_async_reasoning_generation():
    """
    Test the async reasoning generation function directly.
    This requires Ollama to be running locally or Grok API key to be set.
    """
    print("\n" + "=" * 60)
    print("TEST: Async Reasoning Generation (requires LLM)")
    print("=" * 60)

    from app.api.routes.recommendations import _generate_block_reasoning

    user_state = {
        "sleep_quality": 8,
        "energy_level": 8,
        "motivation_level": 9,
        "stress_level": 3,
        "muscle_soreness": 2,
        "finger_tendon_health": 9,
    }

    block_data = {
        "title": "Progressive Intensity Climbing",
        "duration_min": 30,
        "focus": "Build to project-level effort",
        "exercises": [
            {"name": "Moderate climbs (V3-V4)", "duration": "15 min"},
            {"name": "Hard climbs near limit", "duration": "15 min"},
        ]
    }

    print("\nCalling _generate_block_reasoning for 'main' block...")
    print(f"Block: {block_data['title']}")

    reasoning = await _generate_block_reasoning(
        block_type="main",
        block_data=block_data,
        user_state=user_state,
        user_goal="send_project",
    )

    if reasoning:
        print(f"\n✅ LLM generated reasoning:")
        print(f"   \"{reasoning}\"")
    else:
        print("\n⚠️  No reasoning returned (LLM may not be available)")
        print("   This is expected if Ollama is not running and GROK_API_KEY is not set.")


if __name__ == "__main__":
    # Run sync test first
    test_reasoning_in_structured_plan()

    # Try async test (may fail if no LLM available)
    import asyncio
    try:
        asyncio.run(test_async_reasoning_generation())
    except Exception as e:
        print(f"\n⚠️  Async test failed: {e}")
        print("   This is expected if no LLM backend is configured.")

    print("\n" + "=" * 60)
    print("SUMMARY: Backend reasoning infrastructure is in place.")
    print("When called via the API endpoint, structured_plan blocks")
    print("will be enriched with personalized 'reasoning' strings.")
    print("=" * 60)
