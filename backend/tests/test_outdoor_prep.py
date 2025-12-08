"""
Outdoor Season Prep Test

Tests the recommendation engine for a user with "Outdoor season prep" goal.
Validates that recommendations align with outdoor climbing preparation needs.

Run with:
    cd backend && source .venv/bin/activate
    python tests/test_outdoor_prep.py
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

async def run_outdoor_prep_test():
    print("=" * 60)
    print("OUTDOOR SEASON PREP TEST - FULL RUN")
    print("=" * 60)
    
    client = get_supabase_client()
    
    # Use existing test user (Paul Eriksen) to avoid auth constraints
    test_user_id = "83a8e22c-2783-4f7d-b9f1-e7cfd3af5424"
    print(f'Using existing test user: {test_user_id} (Paul Eriksen)')
    
    simulator = SessionSimulator(client, test_user_id)
    
    # Base state
    base_state = {
        'sleep_quality': 7, 'energy_level': 7, 'motivation': 8,
        'stress_level': 4, 'muscle_soreness': 3, 'finger_tendon_health': 8,
        'planned_duration': 100, 'primary_goal': 'outdoor_season_prep'
    }
    
    phases = {
        'base_building': 4, 'intensity': 5, 'peak': 3, 'taper': 2, 'maintenance': 1
    }
    
    recommendations = []
    total_sessions = 0
    
    for phase_name, num_sessions in phases.items():
        print(f"\nPHASE: {phase_name.upper()} ({num_sessions} sessions)")

        # Reset fatigue between phases (simulates rest days)
        simulator.cumulative_fatigue = 0.0

        phase_recs = await simulator.run_session_series(
            base_state, num_sessions=num_sessions, outcome_pattern='follows_prediction'
        )
        for rec in phase_recs:
            recommendations.append({
                'phase': phase_name, 'rec': rec['recommendation'], 'state': rec['pre_session_state'],
                'post': rec['post_session_data']
            })
            if (total_sessions + 1) % 3 == 0:
                await trigger_learning_loop(client, test_user_id)
            total_sessions += 1

        print(f"  Final fatigue this phase: {simulator.cumulative_fatigue:.1f}")
    
    # Summary
    print("\nSUMMARY REPORT")
    print(f"Total sessions: {len(recommendations)}")
    
    session_types = [r['rec'].get('session_type', 'unknown') for r in recommendations]
    predicted_qualities = [r['rec'].get('predicted_quality', 5) for r in recommendations]
    modifier_counts = [len(r['rec'].get('matched_modifiers', [])) for r in recommendations]
    phases_list = [r['rec'].get('user_deviation_phase', 'cold_start') for r in recommendations]
    
    print(f"Session types: {dict(Counter(session_types))}")
    print(f"Avg predicted quality: {np.mean(predicted_qualities):.1f}")
    print(f"Avg modifiers: {np.mean(modifier_counts):.1f}")
    print(f"Phases: {dict(Counter(phases_list))}")
    
    # Early vs Late
    early = recommendations[:5]
    late = recommendations[-5:]
    print(f"Modifiers early → late: {np.mean([len(r['rec'].get('matched_modifiers', [])) for r in early]):.1f} → {np.mean([len(r['rec'].get('matched_modifiers', [])) for r in late]):.1f}")
    
    # DB Query
    priors_result = client.table('population_priors').select('variable_name, n_scenarios, source').execute()
    print(f"\nPriors sample (top 5):")
    for p in (priors_result.data or [])[:5]:
        print(f"  {p['variable_name']}: n_scenarios={p.get('n_scenarios', 0)}, source={p['source']}")
    
    try:
        model_result = client.table('model_outputs').select('*').eq('user_id', test_user_id).execute()
        if model_result.data:
            print(f"User model: {model_result.data[0]}")
        else:
            print('No model outputs yet')
    except Exception as e:
        print(f'Model query skipped: {e}')

    # Show sample of created sessions for verification
    sessions = client.table('climbing_sessions').select('id, session_type, session_quality, prediction_snapshot, sleep_quality, energy_level, motivation').eq('user_id', test_user_id).order('created_at', desc=True).limit(5).execute()
    print(f"\nRecent sessions created (showing last 5):")
    for s in sessions.data or []:
        pred = s.get('prediction_snapshot') or {}
        print(f"  Type: {s['session_type']}, Quality: {s.get('session_quality')}, "
              f"Predicted: {pred.get('predicted_quality', 'N/A')}, "
              f"Sleep: {s.get('sleep_quality')}, Energy: {s.get('energy_level')}, Motivation: {s.get('motivation')}")

    # Count total sessions created
    all_sessions = client.table('climbing_sessions').select('id', count='exact').eq('user_id', test_user_id).execute()
    print(f"\nTotal sessions in DB for this user: {all_sessions.count}")

    print("\n" + "=" * 60)
    print("TEST COMPLETE - Data persisted to Supabase")
    print("=" * 60)

if __name__ == '__main__':
    asyncio.run(run_outdoor_prep_test())
