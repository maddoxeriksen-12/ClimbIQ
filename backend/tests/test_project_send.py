"""
Project Send Test

Tests the recommendation engine for a user with "Send a project" goal.
Validates that recommendations align with projecting needs:
- High intensity sessions when ready
- Appropriate rest recommendations
- Session structure optimized for limit climbing

Run with:
    cd backend && source .venv/bin/activate
    SUPABASE_URL="https://qiqyvjtvduuzwetqhsoc.supabase.co" SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpcXl2anR2ZHV1endldHFoc29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUxNzk3MCwiZXhwIjoyMDgwMDkzOTcwfQ.6O_0_dS22fRQF4dWzaYMppoaUs5Sm_2aWETYFDhcswk" python tests/test_project_send.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
import numpy as np
from datetime import datetime
from collections import Counter

from tests.fixtures.session_simulator import SessionSimulator
from tests.conftest import trigger_learning_loop
from app.core.supabase import get_supabase_client
import asyncio


async def run_project_send_test():
    print("=" * 60)
    print("PROJECT SEND TEST - FULL RUN")
    print("=" * 60)

    client = get_supabase_client()

    # Use existing test user
    test_user_id = "83a8e22c-2783-4f7d-b9f1-e7cfd3af5424"
    print(f'Using test user: {test_user_id}')

    simulator = SessionSimulator(client, test_user_id)

    recommendations = []
    total_sessions = 0

    # =====================================================
    # SCENARIO 1: Optimal Projecting Day
    # High sleep, high energy, high motivation, low soreness
    # =====================================================
    print("\n" + "=" * 60)
    print("SCENARIO 1: OPTIMAL PROJECTING CONDITIONS")
    print("=" * 60)

    optimal_state = {
        'sleep_quality': 9,
        'energy_level': 9,
        'motivation': 10,  # Super psyched to send!
        'stress_level': 2,
        'muscle_soreness': 1,
        'finger_tendon_health': 9,
        'planned_duration': 120,
        'primary_goal': 'send_project',
        'training_phase': 'peak'
    }

    print(f"State: sleep={optimal_state['sleep_quality']}, energy={optimal_state['energy_level']}, "
          f"motivation={optimal_state['motivation']}, soreness={optimal_state['muscle_soreness']}")

    cycle = await simulator.run_session_cycle(optimal_state, 'follows_prediction')
    rec = cycle['recommendation']
    recommendations.append({'scenario': 'optimal', 'rec': rec, 'state': optimal_state})

    print(f"\nRecommendation:")
    print(f"  Session Type: {rec.get('session_type')}")
    print(f"  Predicted Quality: {rec.get('predicted_quality', 'N/A'):.1f}")
    print(f"  Max Intensity: {rec.get('max_intensity', 'N/A')}")

    # Check structured plan
    plan = rec.get('structured_plan', {})
    if plan:
        for block in plan.get('main', []):
            print(f"  Main Block: {block.get('title', 'unnamed')}")
            print(f"    Focus: {block.get('focus', 'N/A')}")
            print(f"    Intensity: {block.get('intensity_score', 'N/A')}")

    total_sessions += 1

    # =====================================================
    # SCENARIO 2: Good But Not Peak
    # Good sleep, moderate energy, high motivation
    # =====================================================
    print("\n" + "=" * 60)
    print("SCENARIO 2: GOOD CONDITIONS (NOT PEAK)")
    print("=" * 60)

    good_state = {
        'sleep_quality': 7,
        'energy_level': 7,
        'motivation': 8,
        'stress_level': 4,
        'muscle_soreness': 3,
        'finger_tendon_health': 8,
        'planned_duration': 100,
        'primary_goal': 'send_project',
        'training_phase': 'intensity'
    }

    print(f"State: sleep={good_state['sleep_quality']}, energy={good_state['energy_level']}, "
          f"motivation={good_state['motivation']}, soreness={good_state['muscle_soreness']}")

    cycle = await simulator.run_session_cycle(good_state, 'follows_prediction')
    rec = cycle['recommendation']
    recommendations.append({'scenario': 'good', 'rec': rec, 'state': good_state})

    print(f"\nRecommendation:")
    print(f"  Session Type: {rec.get('session_type')}")
    print(f"  Predicted Quality: {rec.get('predicted_quality', 'N/A'):.1f}")

    plan = rec.get('structured_plan', {})
    if plan:
        for block in plan.get('main', []):
            print(f"  Main Block: {block.get('title', 'unnamed')}")
            print(f"    Focus: {block.get('focus', 'N/A')}")
            print(f"    Intensity: {block.get('intensity_score', 'N/A')}")

    total_sessions += 1

    # =====================================================
    # SCENARIO 3: Fatigued - Need Recovery
    # Poor sleep, low energy, sore
    # =====================================================
    print("\n" + "=" * 60)
    print("SCENARIO 3: FATIGUED - NEEDS RECOVERY")
    print("=" * 60)

    fatigued_state = {
        'sleep_quality': 4,
        'energy_level': 4,
        'motivation': 6,  # Still wants to climb but tired
        'stress_level': 7,
        'muscle_soreness': 7,
        'finger_tendon_health': 6,
        'planned_duration': 90,
        'primary_goal': 'send_project',
        'training_phase': 'intensity'
    }

    print(f"State: sleep={fatigued_state['sleep_quality']}, energy={fatigued_state['energy_level']}, "
          f"motivation={fatigued_state['motivation']}, soreness={fatigued_state['muscle_soreness']}")

    cycle = await simulator.run_session_cycle(fatigued_state, 'worse_than_expected')
    rec = cycle['recommendation']
    recommendations.append({'scenario': 'fatigued', 'rec': rec, 'state': fatigued_state})

    print(f"\nRecommendation:")
    print(f"  Session Type: {rec.get('session_type')}")
    print(f"  Predicted Quality: {rec.get('predicted_quality', 'N/A'):.1f}")

    plan = rec.get('structured_plan', {})
    if plan:
        for block in plan.get('main', []):
            print(f"  Main Block: {block.get('title', 'unnamed')}")
            print(f"    Focus: {block.get('focus', 'N/A')}")
            print(f"    Intensity: {block.get('intensity_score', 'N/A')}")

    total_sessions += 1

    # =====================================================
    # SCENARIO 4: Finger Tweaky - Caution Required
    # Good overall but finger concern
    # =====================================================
    print("\n" + "=" * 60)
    print("SCENARIO 4: FINGER CONCERN - NEED CAUTION")
    print("=" * 60)

    finger_concern_state = {
        'sleep_quality': 7,
        'energy_level': 7,
        'motivation': 8,
        'stress_level': 4,
        'muscle_soreness': 3,
        'finger_tendon_health': 4,  # Tweaky finger!
        'planned_duration': 90,
        'primary_goal': 'send_project',
        'training_phase': 'intensity'
    }

    print(f"State: sleep={finger_concern_state['sleep_quality']}, energy={finger_concern_state['energy_level']}, "
          f"motivation={finger_concern_state['motivation']}, finger_health={finger_concern_state['finger_tendon_health']}")

    cycle = await simulator.run_session_cycle(finger_concern_state, 'follows_prediction')
    rec = cycle['recommendation']
    recommendations.append({'scenario': 'finger_concern', 'rec': rec, 'state': finger_concern_state})

    print(f"\nRecommendation:")
    print(f"  Session Type: {rec.get('session_type')}")
    print(f"  Predicted Quality: {rec.get('predicted_quality', 'N/A'):.1f}")

    plan = rec.get('structured_plan', {})
    if plan:
        for block in plan.get('main', []):
            print(f"  Main Block: {block.get('title', 'unnamed')}")
            print(f"    Focus: {block.get('focus', 'N/A')}")
            print(f"    Intensity: {block.get('intensity_score', 'N/A')}")

    # Check if any modifiers triggered
    modifiers = rec.get('matched_modifiers', [])
    if modifiers:
        print(f"  Modifiers triggered: {[m.get('modifier_name') for m in modifiers]}")

    total_sessions += 1

    # =====================================================
    # SCENARIO 5: Fresh After Rest Days
    # Coming back from rest, ready to send
    # =====================================================
    print("\n" + "=" * 60)
    print("SCENARIO 5: FRESH AFTER REST - SEND DAY")
    print("=" * 60)

    fresh_state = {
        'sleep_quality': 8,
        'energy_level': 9,
        'motivation': 9,
        'stress_level': 2,
        'muscle_soreness': 1,
        'finger_tendon_health': 9,
        'planned_duration': 150,  # Long session for project attempts
        'primary_goal': 'send_project',
        'training_phase': 'peak',
        'days_since_last_session': 3  # Well rested
    }

    print(f"State: sleep={fresh_state['sleep_quality']}, energy={fresh_state['energy_level']}, "
          f"motivation={fresh_state['motivation']}, days_rest={fresh_state['days_since_last_session']}")

    cycle = await simulator.run_session_cycle(fresh_state, 'better_than_expected')
    rec = cycle['recommendation']
    recommendations.append({'scenario': 'fresh_send_day', 'rec': rec, 'state': fresh_state})

    print(f"\nRecommendation:")
    print(f"  Session Type: {rec.get('session_type')}")
    print(f"  Predicted Quality: {rec.get('predicted_quality', 'N/A'):.1f}")
    print(f"  Max Intensity: {rec.get('max_intensity', 'N/A')}")

    plan = rec.get('structured_plan', {})
    if plan:
        print(f"\n  FULL SESSION STRUCTURE:")
        for phase in ['warmup', 'main', 'cooldown']:
            blocks = plan.get(phase, [])
            if blocks:
                print(f"\n  {phase.upper()}:")
                for block in blocks:
                    print(f"    - {block.get('title', 'unnamed')}")
                    print(f"      Duration: {block.get('duration_min', 'N/A')} min")
                    print(f"      Intensity: {block.get('intensity_score', 'N/A')}")
                    print(f"      Focus: {block.get('focus', 'N/A')}")
                    exercises = block.get('exercises', [])
                    if exercises:
                        print(f"      Exercises:")
                        for ex in exercises[:3]:  # Show first 3
                            print(f"        - {ex.get('name', 'unnamed')}")

    total_sessions += 1

    # =====================================================
    # SUMMARY
    # =====================================================
    print("\n" + "=" * 60)
    print("SUMMARY REPORT")
    print("=" * 60)

    print(f"\nTotal scenarios tested: {len(recommendations)}")

    session_types = [r['rec'].get('session_type', 'unknown') for r in recommendations]
    print(f"\nSession types by scenario:")
    for r in recommendations:
        print(f"  {r['scenario']}: {r['rec'].get('session_type')} "
              f"(quality={r['rec'].get('predicted_quality', 0):.1f})")

    # Validate expectations
    print("\n" + "=" * 60)
    print("VALIDATION")
    print("=" * 60)

    issues = []

    # Optimal day should recommend projecting
    optimal_type = recommendations[0]['rec'].get('session_type')
    if optimal_type != 'project':
        issues.append(f"ISSUE: Optimal conditions got '{optimal_type}' instead of 'project'")
    else:
        print("PASS: Optimal conditions -> project session")

    # Fatigued day should NOT recommend projecting
    fatigued_type = recommendations[2]['rec'].get('session_type')
    if fatigued_type == 'project':
        issues.append(f"ISSUE: Fatigued state got 'project' (should be recovery/technique)")
    else:
        print(f"PASS: Fatigued state -> {fatigued_type} (not project)")

    # Finger concern should cap intensity
    finger_rec = recommendations[3]['rec']
    finger_intensity = finger_rec.get('max_intensity', 10)
    if finger_intensity > 7:
        issues.append(f"ISSUE: Finger concern has max_intensity={finger_intensity} (should be lower)")
    else:
        print(f"PASS: Finger concern -> intensity capped at {finger_intensity}")

    # Fresh send day should be project with high intensity allowed
    fresh_rec = recommendations[4]['rec']
    fresh_type = fresh_rec.get('session_type')
    fresh_intensity = fresh_rec.get('max_intensity', 0)
    if fresh_type == 'project' and fresh_intensity >= 8:
        print(f"PASS: Fresh send day -> {fresh_type} with max_intensity={fresh_intensity}")
    else:
        issues.append(f"ISSUE: Fresh send day got type={fresh_type}, intensity={fresh_intensity}")

    if issues:
        print("\n" + "-" * 40)
        print("ISSUES FOUND:")
        for issue in issues:
            print(f"  {issue}")
    else:
        print("\nALL VALIDATIONS PASSED")

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)


if __name__ == '__main__':
    asyncio.run(run_project_send_test())
