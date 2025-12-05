"""
Edge Case Dimensions for Synthetic Scenario Generation

Defines scenarios that require expert judgment beyond what
statistical models can easily learn. Used to generate synthetic
scenarios for expert review.

Categories:
- anxiety_stress: High anxiety combined with other stressors
- injury_combinations: Niggles with risky session types
- recovery_extremes: Unusual recovery patterns
- demographic_edge_cases: Age/experience combinations
- contradictory_signals: Mixed positive/negative indicators
- time_constraints: Limited time scenarios
- interaction_effects: Where factor interactions matter

Each edge case specifies conditions that, when combined,
create scenarios requiring nuanced expert judgment.
"""

EDGE_CASE_DIMENSIONS = {
    # =========================================================================
    # ANXIETY + STRESS COMBINATIONS
    # =========================================================================
    "anxiety_stress": [
        {
            "name": "High anxiety + high life stress",
            "conditions": {
                "performance_anxiety": 9,
                "stress_level": 5
            },
            "description": "Climber with high performance anxiety also dealing with significant life stress"
        },
        {
            "name": "Anxiety + sleep deprivation + stress",
            "conditions": {
                "performance_anxiety": 8,
                "stress_level": 4,
                "sleep_hours": 4
            },
            "description": "Triple threat: anxiety, stress, and poor sleep"
        },
        {
            "name": "High anxiety + high motivation + project day",
            "conditions": {
                "performance_anxiety": 7,
                "motivation_level": 5,
                "session_goal": "project"
            },
            "description": "Anxious but highly motivated for a project session"
        },
        {
            "name": "Competition prep anxiety",
            "conditions": {
                "performance_anxiety": 9,
                "stress_level": 4,
                "session_goal": "competition_prep"
            },
            "description": "Pre-competition anxiety peak"
        },
    ],
    
    # =========================================================================
    # INJURY COMBINATIONS
    # =========================================================================
    "injury_combinations": [
        {
            "name": "Finger niggle + back-to-back days",
            "conditions": {
                "current_niggles": [{"location": "finger", "severity": 2}],
                "days_since_hard_session": 1
            },
            "description": "Mild finger issue with insufficient recovery"
        },
        {
            "name": "Shoulder issue + steep project",
            "conditions": {
                "current_niggles": [{"location": "shoulder", "severity": 1}],
                "session_goal": "steep_project"
            },
            "description": "Shoulder niggle when planning steep/powerful climbing"
        },
        {
            "name": "Elbow + hangboard plan",
            "conditions": {
                "current_niggles": [{"location": "elbow", "severity": 3}],
                "planned_session_type": "hangboard"
            },
            "description": "Moderate elbow issue with high-load training plan"
        },
        {
            "name": "Multiple niggles",
            "conditions": {
                "current_niggles": [
                    {"location": "finger", "severity": 2},
                    {"location": "shoulder", "severity": 1}
                ],
                "session_goal": "project"
            },
            "description": "Multiple minor issues, wants to project"
        },
        {
            "name": "Recurring injury + good day",
            "conditions": {
                "current_niggles": [{"location": "finger", "severity": 1, "recurring": True}],
                "energy_level": 5,
                "motivation_level": 5
            },
            "description": "Low-grade recurring injury on an otherwise good day"
        },
    ],
    
    # =========================================================================
    # RECOVERY EXTREMES
    # =========================================================================
    "recovery_extremes": [
        {
            "name": "No rest + excellent sleep",
            "conditions": {
                "days_since_hard_session": 0,
                "sleep_hours": 9,
                "sleep_quality": 5
            },
            "description": "Back-to-back days but exceptionally rested"
        },
        {
            "name": "Week off + poor sleep",
            "conditions": {
                "days_since_hard_session": 7,
                "sleep_hours": 5,
                "sleep_quality": 2
            },
            "description": "Well rested from time off but poorly slept night before"
        },
        {
            "name": "Recent hard session + high soreness",
            "conditions": {
                "days_since_hard_session": 1,
                "soreness_level": 4
            },
            "description": "DOMS from yesterday's session"
        },
        {
            "name": "Extended rest + motivation concerns",
            "conditions": {
                "days_since_hard_session": 10,
                "motivation_level": 2,
                "session_goal": "project"
            },
            "description": "Long break leading to low motivation but wanting to project"
        },
        {
            "name": "High weekly volume + technical session",
            "conditions": {
                "days_since_rest_day": 5,
                "planned_session_type": "technique",
                "soreness_level": 3
            },
            "description": "Many days without rest, planning low-intensity technique work"
        },
    ],
    
    # =========================================================================
    # DEMOGRAPHIC EDGE CASES
    # =========================================================================
    "demographic_edge_cases": [
        {
            "name": "Masters beginner",
            "conditions": {
                "age": 55,
                "years_climbing": 2,
                "days_since_hard_session": 2
            },
            "description": "Older climber with less experience"
        },
        {
            "name": "Young veteran with anxiety",
            "conditions": {
                "age": 18,
                "years_climbing": 10,
                "performance_anxiety": 8
            },
            "description": "Experienced young climber dealing with performance pressure"
        },
        {
            "name": "Middle-aged high volume",
            "conditions": {
                "age": 45,
                "sessions_per_week": 5,
                "sleep_hours": 5
            },
            "description": "High training volume for age with sleep deficit"
        },
        {
            "name": "Returning after break",
            "conditions": {
                "years_climbing": 8,
                "days_since_hard_session": 60,
                "motivation_level": 5
            },
            "description": "Experienced climber returning after injury/break"
        },
    ],
    
    # =========================================================================
    # CONTRADICTORY SIGNALS
    # =========================================================================
    "contradictory_signals": [
        {
            "name": "Long sleep, poor quality",
            "conditions": {
                "sleep_hours": 9,
                "sleep_quality": 1
            },
            "description": "Lots of sleep but very poor quality (restless, waking)"
        },
        {
            "name": "High stress, high motivation",
            "conditions": {
                "stress_level": 5,
                "motivation_level": 5
            },
            "description": "Very stressed but highly motivated to climb"
        },
        {
            "name": "High caffeine, high anxiety",
            "conditions": {
                "caffeine_mg": 400,
                "performance_anxiety": 9
            },
            "description": "High caffeine intake with already elevated anxiety"
        },
        {
            "name": "High energy, high soreness",
            "conditions": {
                "energy_level": 5,
                "soreness_level": 4
            },
            "description": "Feeling energetic but body is sore"
        },
        {
            "name": "Low energy, low soreness, poor sleep",
            "conditions": {
                "energy_level": 1,
                "soreness_level": 1,
                "sleep_hours": 4
            },
            "description": "Feeling terrible from lack of sleep but no physical soreness"
        },
        {
            "name": "Recent hard session + high energy",
            "conditions": {
                "days_since_hard_session": 1,
                "energy_level": 5,
                "motivation_level": 5
            },
            "description": "Climbed hard yesterday but feeling great today"
        },
    ],
    
    # =========================================================================
    # TIME CONSTRAINTS
    # =========================================================================
    "time_constraints": [
        {
            "name": "Short time, wants to project",
            "conditions": {
                "time_available_min": 45,
                "session_goal": "project"
            },
            "description": "Limited time but wants to try hard"
        },
        {
            "name": "Very short session window",
            "conditions": {
                "time_available_min": 30,
                "planned_warmup_min": 25
            },
            "description": "Barely enough time for proper warmup"
        },
        {
            "name": "Long available time, low energy",
            "conditions": {
                "time_available_min": 180,
                "energy_level": 2
            },
            "description": "Lots of time but not feeling great"
        },
    ],
    
    # =========================================================================
    # INTERACTION EFFECTS
    # These are scenarios where the interaction between factors is key
    # =========================================================================
    "interaction_effects": [
        {
            "name": "Caffeine + anxiety interaction",
            "conditions": {
                "caffeine_mg": 300,
                "performance_anxiety": 8,
                "planned_session_type": "project"
            },
            "description": "High caffeine may worsen anxiety symptoms during projecting"
        },
        {
            "name": "Sleep debt + caffeine compensation",
            "conditions": {
                "sleep_hours": 4,
                "caffeine_mg": 400,
                "energy_level": 3
            },
            "description": "Using caffeine to mask sleep deprivation"
        },
        {
            "name": "Age + recovery interaction",
            "conditions": {
                "age": 50,
                "days_since_hard_session": 2,
                "soreness_level": 3
            },
            "description": "Older climber may need more recovery than 2 days"
        },
        {
            "name": "Experience + anxiety moderation",
            "conditions": {
                "years_climbing": 15,
                "performance_anxiety": 7,
                "session_goal": "competition"
            },
            "description": "Experienced climber may handle competition anxiety better"
        },
        {
            "name": "High altitude + recovery",
            "conditions": {
                "altitude_m": 2500,
                "days_since_hard_session": 2,
                "session_goal": "project"
            },
            "description": "Altitude affects both performance and recovery needs"
        },
    ],
    
    # =========================================================================
    # ENVIRONMENTAL FACTORS
    # =========================================================================
    "environmental": [
        {
            "name": "Hot conditions + outdoor project",
            "conditions": {
                "temperature_c": 32,
                "humidity_pct": 70,
                "session_goal": "outdoor_project"
            },
            "description": "Suboptimal conditions for hard climbing"
        },
        {
            "name": "Perfect conditions + fatigue",
            "conditions": {
                "temperature_c": 15,
                "humidity_pct": 40,
                "energy_level": 2,
                "session_goal": "project"
            },
            "description": "Great conditions but not feeling fresh"
        },
    ],
}


def get_all_edge_case_tags() -> list:
    """Get list of all edge case category tags."""
    return list(EDGE_CASE_DIMENSIONS.keys())


def get_edge_cases_by_category(category: str) -> list:
    """Get all edge cases in a category."""
    return EDGE_CASE_DIMENSIONS.get(category, [])


def get_random_edge_case_combo(n_dimensions: int = 2) -> dict:
    """
    Generate a random combination of edge case conditions.
    Useful for generating diverse synthetic scenarios.
    """
    import random
    
    categories = list(EDGE_CASE_DIMENSIONS.keys())
    selected_categories = random.sample(categories, min(n_dimensions, len(categories)))
    
    combined_conditions = {}
    tags = []
    
    for category in selected_categories:
        cases = EDGE_CASE_DIMENSIONS[category]
        if cases:
            case = random.choice(cases)
            combined_conditions.update(case["conditions"])
            tags.append(category)
    
    return {
        "conditions": combined_conditions,
        "edge_case_tags": tags
    }


def validate_scenario_coverage(scenarios: list) -> dict:
    """
    Check how well a set of scenarios covers edge cases.
    
    Returns coverage statistics.
    """
    coverage = {category: 0 for category in EDGE_CASE_DIMENSIONS.keys()}
    
    for scenario in scenarios:
        tags = scenario.get("edge_case_tags", [])
        for tag in tags:
            if tag in coverage:
                coverage[tag] += 1
    
    return {
        "coverage": coverage,
        "total_scenarios": len(scenarios),
        "categories_covered": sum(1 for v in coverage.values() if v > 0),
        "uncovered_categories": [k for k, v in coverage.items() if v == 0]
    }

