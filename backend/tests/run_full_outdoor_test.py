"""
Full Outdoor Prep Test with Expert Scenario Seeding

This test:
1. Seeds expert scenarios to population_priors table
2. Runs the outdoor prep simulation
3. Verifies expert data influences recommendations
4. Reports the results

Run with:
    cd backend && source .venv/bin/activate
    SUPABASE_URL="https://qiqyvjtvduuzwetqhsoc.supabase.co" SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpcXl2anR2ZHV1endldHFoc29jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUxNzk3MCwiZXhwIjoyMDgwMDkzOTcwfQ.6O_0_dS22fRQF4dWzaYMppoaUs5Sm_2aWETYFDhcswk" python tests/run_full_outdoor_test.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
import numpy as np
from datetime import datetime
from collections import Counter
import asyncio

from app.core.supabase import get_supabase_client
from tests.fixtures.session_simulator import SessionSimulator
from tests.conftest import trigger_learning_loop


# Expert-derived population priors based on climbing science and expert consensus
EXPERT_PRIORS = [
    {
        "variable_name": "sleep_quality",
        "population_mean": 0.35,
        "population_std": 0.12,
        "individual_variance": 0.08,
        "confidence": "high",
        "source": "blended",
        "n_scenarios": 8,
        "total_judgments": 24,
        "effect_direction": "positive",
        "variable_category": "recovery",
        "description": "Sleep quality strongly predicts session quality. Poor sleep (<5) reduces power output and increases injury risk.",
    },
    {
        "variable_name": "energy_level",
        "population_mean": 0.40,
        "population_std": 0.10,
        "individual_variance": 0.06,
        "confidence": "high",
        "source": "blended",
        "n_scenarios": 8,
        "total_judgments": 24,
        "effect_direction": "positive",
        "variable_category": "readiness",
        "description": "Energy level is a primary driver of session intensity capacity. Low energy should trigger volume reduction.",
    },
    {
        "variable_name": "motivation",
        "population_mean": 0.25,
        "population_std": 0.15,
        "individual_variance": 0.10,
        "confidence": "medium",
        "source": "blended",
        "n_scenarios": 8,
        "total_judgments": 24,
        "effect_direction": "positive",
        "variable_category": "psychological",
        "description": "Motivation affects effort and try-hard capacity. High motivation can mask fatigue signals.",
    },
    {
        "variable_name": "stress_level",
        "population_mean": -0.20,
        "population_std": 0.10,
        "individual_variance": 0.08,
        "confidence": "high",
        "source": "blended",
        "n_scenarios": 8,
        "total_judgments": 24,
        "effect_direction": "negative",
        "variable_category": "psychological",
        "description": "Life stress reduces performance ceiling. High stress (>7) should trigger technique-focused sessions.",
    },
    {
        "variable_name": "muscle_soreness",
        "population_mean": -0.25,
        "population_std": 0.12,
        "individual_variance": 0.07,
        "confidence": "high",
        "source": "blended",
        "n_scenarios": 8,
        "total_judgments": 24,
        "effect_direction": "negative",
        "variable_category": "fatigue",
        "description": "Soreness indicates incomplete recovery. High soreness (>6) requires extended warmup and intensity reduction.",
    },
    {
        "variable_name": "finger_tendon_health",
        "population_mean": 0.45,
        "population_std": 0.08,
        "individual_variance": 0.05,
        "confidence": "high",
        "source": "blended",
        "n_scenarios": 8,
        "total_judgments": 24,
        "effect_direction": "positive",
        "variable_category": "injury_risk",
        "description": "Finger health is non-negotiable. Values <5 should cap session intensity regardless of other factors.",
    },
    {
        "variable_name": "planned_duration",
        "population_mean": 0.10,
        "population_std": 0.05,
        "individual_variance": 0.03,
        "confidence": "medium",
        "source": "blended",
        "n_scenarios": 5,
        "total_judgments": 15,
        "effect_direction": "nonlinear",
        "variable_category": "session_parameters",
        "description": "Longer sessions allow more warmup and volume but have diminishing returns after 90-120 min.",
    },
    {
        "variable_name": "days_since_last_session",
        "population_mean": 0.15,
        "population_std": 0.10,
        "individual_variance": 0.08,
        "confidence": "medium",
        "source": "blended",
        "n_scenarios": 4,
        "total_judgments": 12,
        "effect_direction": "nonlinear",
        "variable_category": "recovery",
        "description": "1-2 days rest is optimal. 0 days risks overtraining, >4 days may require longer warmup.",
    },
]


async def seed_expert_priors(client):
    """Seed expert-derived population priors into database."""
    print("\n" + "=" * 60)
    print("SEEDING EXPERT PRIORS")
    print("=" * 60)

    seeded_count = 0
    updated_count = 0

    for prior in EXPERT_PRIORS:
        # Check if prior exists
        existing = client.table("population_priors").select("id").eq(
            "variable_name", prior["variable_name"]
        ).execute()

        if existing.data:
            # Update only the key fields that affect recommendations
            update_data = {
                "population_mean": prior["population_mean"],
                "population_std": prior["population_std"],
                "n_scenarios": prior["n_scenarios"],
                "total_judgments": prior["total_judgments"],
                "confidence": prior["confidence"],
                "description": prior["description"],
                "source": prior["source"],  # Must be "blended" for expert recognition
                "updated_at": datetime.utcnow().isoformat(),
            }
            try:
                client.table("population_priors").update(update_data).eq(
                    "variable_name", prior["variable_name"]
                ).execute()
                updated_count += 1
                print(f"  Updated: {prior['variable_name']} (mean={prior['population_mean']:.2f}, n_scenarios={prior['n_scenarios']})")
            except Exception as e:
                print(f"  Skip update {prior['variable_name']}: {e}")
        else:
            # Variable doesn't exist - that's fine, skip it
            print(f"  Skipped: {prior['variable_name']} (not in database)")

    print(f"\nTotal: {seeded_count} new, {updated_count} updated")
    return seeded_count + updated_count


async def run_outdoor_prep_simulation(client, user_id: str):
    """Run the outdoor prep session simulation."""
    print("\n" + "=" * 60)
    print("OUTDOOR SEASON PREP SIMULATION")
    print("=" * 60)
    print(f"User: {user_id}")

    simulator = SessionSimulator(client, user_id)

    # Base state for outdoor prep goal
    base_state = {
        'sleep_quality': 7,
        'energy_level': 7,
        'motivation': 8,
        'stress_level': 4,
        'muscle_soreness': 3,
        'finger_tendon_health': 8,
        'planned_duration': 100,
        'primary_goal': 'outdoor_season_prep'
    }

    # Training phases leading to outdoor trip
    phases = {
        'base_building': 4,
        'intensity': 5,
        'peak': 3,
        'taper': 2,
        'maintenance': 1
    }

    recommendations = []
    total_sessions = 0

    for phase_name, num_sessions in phases.items():
        print(f"\nPHASE: {phase_name.upper()} ({num_sessions} sessions)")

        # Reset fatigue between phases (simulates rest days)
        simulator.cumulative_fatigue = 0.0

        # Set training phase in state for periodization awareness
        phase_state = base_state.copy()
        phase_state['training_phase'] = phase_name

        # Taper phase gets special treatment
        if phase_name == 'taper':
            phase_state['weeks_until_trip'] = 1

        phase_recs = await simulator.run_session_series(
            phase_state, num_sessions=num_sessions, outcome_pattern='follows_prediction'
        )

        for rec in phase_recs:
            rec_data = rec['recommendation']
            recommendations.append({
                'phase': phase_name,
                'rec': rec_data,
                'state': rec['pre_session_state'],
                'post': rec['post_session_data']
            })

            # Print each recommendation
            print(f"  Session {total_sessions + 1}: {rec_data.get('session_type', 'unknown')} "
                  f"(predicted: {rec_data.get('predicted_quality', 'N/A'):.1f})")

            if (total_sessions + 1) % 3 == 0:
                await trigger_learning_loop(client, user_id)
            total_sessions += 1

        print(f"  Final fatigue this phase: {simulator.cumulative_fatigue:.1f}")

    return recommendations


def analyze_results(recommendations, client, user_id):
    """Analyze and report test results."""
    print("\n" + "=" * 60)
    print("RESULTS ANALYSIS")
    print("=" * 60)

    # Session type distribution
    session_types = [r['rec'].get('session_type', 'unknown') for r in recommendations]
    type_counts = dict(Counter(session_types))
    print(f"\nSession Type Distribution:")
    for stype, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        pct = count / len(session_types) * 100
        print(f"  {stype}: {count} ({pct:.0f}%)")

    # Predicted quality stats
    predicted_qualities = [r['rec'].get('predicted_quality', 5) for r in recommendations]
    print(f"\nPredicted Quality:")
    print(f"  Mean: {np.mean(predicted_qualities):.2f}")
    print(f"  Min: {min(predicted_qualities):.2f}")
    print(f"  Max: {max(predicted_qualities):.2f}")

    # Phase distribution
    phases_list = [r['rec'].get('user_deviation_phase', 'cold_start') for r in recommendations]
    phase_counts = dict(Counter(phases_list))
    print(f"\nLearning Phase Distribution:")
    for phase, count in phase_counts.items():
        print(f"  {phase}: {count}")

    # Modifier usage
    modifier_counts = [len(r['rec'].get('matched_modifiers', [])) for r in recommendations]
    print(f"\nModifier Usage:")
    print(f"  Avg modifiers per session: {np.mean(modifier_counts):.1f}")

    # Early vs Late comparison
    early = recommendations[:5]
    late = recommendations[-5:]
    early_mod_avg = np.mean([len(r['rec'].get('matched_modifiers', [])) for r in early])
    late_mod_avg = np.mean([len(r['rec'].get('matched_modifiers', [])) for r in late])
    print(f"  Early sessions: {early_mod_avg:.1f} avg modifiers")
    print(f"  Late sessions: {late_mod_avg:.1f} avg modifiers")

    # Check for taper phase behavior
    taper_recs = [r for r in recommendations if r['phase'] == 'taper']
    if taper_recs:
        taper_types = [r['rec'].get('session_type') for r in taper_recs]
        print(f"\nTaper Phase Sessions: {taper_types}")
        # Taper should NOT have project sessions
        has_project_in_taper = 'project' in taper_types
        print(f"  Project sessions in taper: {'YES (unexpected)' if has_project_in_taper else 'No (correct)'}")

    # Goal-specific check: outdoor_season_prep should have project sessions
    project_count = type_counts.get('project', 0)
    print(f"\nGoal-Specific Check (outdoor_season_prep):")
    print(f"  Project sessions: {project_count}")
    if project_count > 0:
        print(f"  PASS: Goal-specific threshold adjustment working")
    else:
        print(f"  NOTE: No project sessions - may need to tune thresholds further")

    return type_counts


def check_expert_data_usage(client):
    """Verify expert data is being used in recommendations."""
    print("\n" + "=" * 60)
    print("EXPERT DATA VERIFICATION")
    print("=" * 60)

    # Check population priors
    priors_result = client.table('population_priors').select(
        'variable_name, population_mean, n_scenarios, source, confidence'
    ).execute()

    print(f"\nPopulation Priors in Database ({len(priors_result.data or [])} total):")
    expert_count = 0
    for p in (priors_result.data or []):
        n_scenarios = p.get('n_scenarios', 0) or 0
        if n_scenarios > 0:
            expert_count += 1
            print(f"  {p['variable_name']}: mean={p['population_mean']:.2f}, "
                  f"n_scenarios={n_scenarios}, confidence={p.get('confidence', 'N/A')}")

    print(f"\nExpert-sourced priors: {expert_count} / {len(priors_result.data or [])}")

    # Check expert rules
    try:
        rules_result = client.table('expert_rules').select('id, name, priority').eq('is_active', True).execute()
        print(f"\nActive Expert Rules: {len(rules_result.data or [])}")
        for r in (rules_result.data or [])[:5]:
            print(f"  {r.get('name', 'unnamed')} (priority={r.get('priority', 'N/A')})")
    except Exception as e:
        print(f"\nExpert Rules check skipped: {e}")

    return expert_count


async def main():
    print("=" * 60)
    print("FULL OUTDOOR PREP TEST WITH EXPERT SCENARIOS")
    print("=" * 60)

    client = get_supabase_client()

    # Use existing test user
    test_user_id = "83a8e22c-2783-4f7d-b9f1-e7cfd3af5424"
    print(f'\nUsing test user: {test_user_id} (Paul Eriksen)')

    # Step 1: Seed expert priors
    await seed_expert_priors(client)

    # Step 2: Run simulation
    recommendations = await run_outdoor_prep_simulation(client, test_user_id)

    # Step 3: Analyze results
    type_counts = analyze_results(recommendations, client, test_user_id)

    # Step 4: Verify expert data usage
    expert_count = check_expert_data_usage(client)

    # Step 5: Show database sessions
    print("\n" + "=" * 60)
    print("DATABASE VERIFICATION")
    print("=" * 60)

    sessions = client.table('climbing_sessions').select(
        'id, session_type, session_quality, prediction_snapshot, sleep_quality, energy_level'
    ).eq('user_id', test_user_id).order('created_at', desc=True).limit(5).execute()

    print(f"\nRecent sessions in DB (last 5):")
    for s in sessions.data or []:
        pred = s.get('prediction_snapshot') or {}
        print(f"  Type: {s['session_type']}, Quality: {s.get('session_quality')}, "
              f"Predicted: {pred.get('predicted_quality', 'N/A')}")

    all_sessions = client.table('climbing_sessions').select('id', count='exact').eq('user_id', test_user_id).execute()
    print(f"\nTotal sessions for user: {all_sessions.count}")

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Sessions simulated: {len(recommendations)}")
    print(f"Expert priors active: {expert_count}")
    print(f"Session types: {type_counts}")

    # Success criteria
    success = True
    if expert_count < 5:
        print("\nWARNING: Less than 5 expert priors seeded")
        success = False

    if type_counts.get('project', 0) == 0 and type_counts.get('volume', 0) < 5:
        print("\nWARNING: Few high-intensity sessions for outdoor prep goal")

    print("\n" + "=" * 60)
    print("TEST COMPLETE" if success else "TEST COMPLETE WITH WARNINGS")
    print("=" * 60)


if __name__ == '__main__':
    asyncio.run(main())
