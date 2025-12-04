"""
Synthetic Scenario Generator for Expert Capture System

Generates diverse climbing scenarios for expert review, covering
edge cases and unusual combinations that the recommendation engine
needs to handle.
"""

import random
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from supabase import Client


# Edge case dimensions for scenario generation
EDGE_CASE_DIMENSIONS = {
    "anxiety_stress": [
        {"performance_anxiety": 9, "stress_level": 5},
        {"performance_anxiety": 8, "stress_level": 4, "sleep_quality": 3},
        {"performance_anxiety": 7, "competition_upcoming": True},
    ],
    "injury_combinations": [
        {"current_injuries": [{"location": "finger", "severity": 2}], "days_since_last_session": 1},
        {"current_injuries": [{"location": "shoulder", "severity": 1}], "primary_goal": "steep_overhang"},
        {"current_injuries": [{"location": "elbow", "severity": 3}], "planned_session_type": "training"},
        {"current_injuries": [{"location": "finger", "severity": 4}, {"location": "skin", "severity": 2}]},
    ],
    "recovery_extremes": [
        {"days_since_last_session": 0, "sleep_quality": 9, "muscle_soreness": 2},
        {"days_since_last_session": 7, "sleep_quality": 5, "motivation": 9},
        {"days_since_last_session": 1, "previous_session_rpe": 10},
        {"days_since_rest_day": 6, "weekly_session_count": 6},
    ],
    "demographic_edge_cases": [
        {"age": 55, "years_climbing": 2, "fitness_level": "moderate"},
        {"age": 18, "years_climbing": 10, "performance_anxiety": 8},
        {"age": 45, "years_climbing": 25, "injury_history": ["chronic_shoulder"]},
        {"age": 14, "years_climbing": 4, "adult_supervised": True},
    ],
    "contradictory_signals": [
        {"sleep_quality": 9, "energy_level": 3},  # Good sleep, low energy
        {"stress_level": 8, "motivation": 9},  # High stress, high motivation
        {"caffeine_today": True, "performance_anxiety": 9},
        {"energy_level": 9, "muscle_soreness": 8},  # High energy, very sore
    ],
    "environmental_factors": [
        {"is_outdoor": True, "temperature": 35, "humidity": 80},
        {"is_outdoor": True, "temperature": 5, "precipitation_recent": True},
        {"is_outdoor": True, "altitude": 3000, "acclimatized": False},
        {"gym_crowded": True, "time_constraint": 60},
    ],
    "goal_conflicts": [
        {"primary_goal": "project", "skin_condition": "poor"},
        {"primary_goal": "volume", "days_since_rest_day": 0},
        {"primary_goal": "limit_bouldering", "finger_fatigue": 7},
        {"primary_goal": "technique", "motivation": 3},
    ],
    "physiological_edge_cases": [
        {"hydration_status": "dehydrated", "caffeine_today": True},
        {"hours_since_meal": 0.5, "meal_size": "large"},
        {"hours_since_meal": 6, "blood_sugar_feeling": "low"},
        {"menstrual_phase": "day_1", "cramp_severity": 6},
    ],
}

# Baseline profile ranges
BASELINE_RANGES = {
    "age": (14, 65),
    "years_climbing": (0.5, 30),
    "sessions_per_week": (1, 6),
    "highest_boulder_grade": ["VB", "V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12"],
    "highest_sport_grade": ["5.7", "5.8", "5.9", "5.10a", "5.10b", "5.10c", "5.10d", "5.11a", "5.11b", "5.11c", "5.11d", "5.12a", "5.12b", "5.12c", "5.12d", "5.13a"],
    "training_focus": ["general", "bouldering", "sport", "endurance", "power", "technique"],
    "fear_of_falling": (1, 10),
    "performance_anxiety_baseline": (1, 10),
    "injury_history": [
        [],
        ["finger_injury"],
        ["shoulder_injury"],
        ["elbow_injury"],
        ["finger_injury", "shoulder_injury"],
        ["chronic_tendonitis"],
    ],
}

# Pre-session state ranges
PRE_SESSION_RANGES = {
    "energy_level": (1, 10),
    "motivation": (1, 10),
    "sleep_quality": (1, 10),
    "sleep_hours": (4, 10),
    "stress_level": (1, 10),
    "muscle_soreness": (1, 10),
    "days_since_last_session": (0, 14),
    "days_since_rest_day": (0, 7),
    "planned_duration": (30, 180),
    "primary_goal": ["push_limits", "volume", "technique", "active_recovery", "social", "skill_work", "project"],
    "is_outdoor": [True, False],
    "caffeine_today": [True, False],
    "alcohol_last_24h": [True, False],
}


class ScenarioGenerator:
    """Generates synthetic scenarios for expert review"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    def generate_batch(
        self,
        count: int = 10,
        edge_case_types: Optional[List[str]] = None,
        review_session_id: Optional[str] = None,
        difficulty_distribution: Optional[Dict[str, float]] = None
    ) -> List[Dict[str, Any]]:
        """Generate a batch of synthetic scenarios"""
        
        if difficulty_distribution is None:
            difficulty_distribution = {
                "common": 0.5,
                "edge_case": 0.4,
                "extreme": 0.1,
            }
        
        generation_batch = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        scenarios = []
        edge_case_breakdown = {"common": 0, "edge_case": 0, "extreme": 0}
        
        for i in range(count):
            # Determine difficulty level
            rand = random.random()
            cumulative = 0
            difficulty = "common"
            for level, prob in difficulty_distribution.items():
                cumulative += prob
                if rand <= cumulative:
                    difficulty = level
                    break
            
            edge_case_breakdown[difficulty] += 1
            
            # Generate scenario
            scenario = self._generate_single_scenario(
                difficulty=difficulty,
                edge_case_types=edge_case_types,
                generation_batch=generation_batch,
                review_session_id=review_session_id,
            )
            
            # Save to database
            result = self.supabase.table("synthetic_scenarios").insert(scenario).execute()
            if result.data:
                scenarios.append(result.data[0])
        
        return {
            "scenarios_generated": len(scenarios),
            "scenario_ids": [s["id"] for s in scenarios],
            "generation_batch": generation_batch,
            "edge_case_breakdown": edge_case_breakdown,
        }
    
    def _generate_single_scenario(
        self,
        difficulty: str,
        edge_case_types: Optional[List[str]],
        generation_batch: str,
        review_session_id: Optional[str],
    ) -> Dict[str, Any]:
        """Generate a single synthetic scenario"""
        
        # Generate baseline profile
        baseline = self._generate_baseline_profile()
        
        # Generate pre-session state
        pre_session = self._generate_pre_session_state()
        
        # Apply edge cases based on difficulty
        edge_case_tags = []
        
        if difficulty in ["edge_case", "extreme"]:
            # Select edge case dimensions to apply
            available_dimensions = list(EDGE_CASE_DIMENSIONS.keys())
            if edge_case_types:
                available_dimensions = [d for d in available_dimensions if d in edge_case_types]
            
            num_edge_cases = 1 if difficulty == "edge_case" else random.randint(2, 3)
            selected_dimensions = random.sample(available_dimensions, min(num_edge_cases, len(available_dimensions)))
            
            for dimension in selected_dimensions:
                edge_case = random.choice(EDGE_CASE_DIMENSIONS[dimension])
                edge_case_tags.append(dimension)
                
                # Apply edge case to appropriate snapshot
                for key, value in edge_case.items():
                    if key in baseline:
                        baseline[key] = value
                    else:
                        pre_session[key] = value
        
        # Generate scenario description
        description = self._generate_description(baseline, pre_session, edge_case_tags)
        
        return {
            "baseline_snapshot": baseline,
            "pre_session_snapshot": pre_session,
            "scenario_description": description,
            "edge_case_tags": edge_case_tags,
            "difficulty_level": difficulty,
            "generation_batch": generation_batch,
            "review_session_id": review_session_id,
            "status": "pending",
        }
    
    def _generate_baseline_profile(self) -> Dict[str, Any]:
        """Generate a random baseline climber profile"""
        
        age = random.randint(*BASELINE_RANGES["age"])
        years_climbing = min(random.uniform(*BASELINE_RANGES["years_climbing"]), age - 10)
        years_climbing = max(0.5, years_climbing)
        
        # Grades correlated with experience
        experience_factor = min(years_climbing / 10, 1.0)
        boulder_idx = int(experience_factor * (len(BASELINE_RANGES["highest_boulder_grade"]) - 1))
        boulder_idx = max(0, min(boulder_idx + random.randint(-2, 2), len(BASELINE_RANGES["highest_boulder_grade"]) - 1))
        
        sport_idx = int(experience_factor * (len(BASELINE_RANGES["highest_sport_grade"]) - 1))
        sport_idx = max(0, min(sport_idx + random.randint(-2, 2), len(BASELINE_RANGES["highest_sport_grade"]) - 1))
        
        return {
            "age": age,
            "years_climbing": round(years_climbing, 1),
            "sessions_per_week": random.randint(*BASELINE_RANGES["sessions_per_week"]),
            "highest_boulder_grade": BASELINE_RANGES["highest_boulder_grade"][boulder_idx],
            "highest_sport_grade": BASELINE_RANGES["highest_sport_grade"][sport_idx],
            "training_focus": random.choice(BASELINE_RANGES["training_focus"]),
            "fear_of_falling": random.randint(*BASELINE_RANGES["fear_of_falling"]),
            "performance_anxiety_baseline": random.randint(*BASELINE_RANGES["performance_anxiety_baseline"]),
            "injury_history": random.choice(BASELINE_RANGES["injury_history"]),
        }
    
    def _generate_pre_session_state(self) -> Dict[str, Any]:
        """Generate a random pre-session state"""
        
        return {
            "energy_level": random.randint(*PRE_SESSION_RANGES["energy_level"]),
            "motivation": random.randint(*PRE_SESSION_RANGES["motivation"]),
            "sleep_quality": random.randint(*PRE_SESSION_RANGES["sleep_quality"]),
            "sleep_hours": round(random.uniform(*PRE_SESSION_RANGES["sleep_hours"]), 1),
            "stress_level": random.randint(*PRE_SESSION_RANGES["stress_level"]),
            "muscle_soreness": random.randint(*PRE_SESSION_RANGES["muscle_soreness"]),
            "days_since_last_session": random.randint(*PRE_SESSION_RANGES["days_since_last_session"]),
            "days_since_rest_day": random.randint(*PRE_SESSION_RANGES["days_since_rest_day"]),
            "planned_duration": random.choice([60, 90, 120, 150, 180]),
            "primary_goal": random.choice(PRE_SESSION_RANGES["primary_goal"]),
            "is_outdoor": random.choice(PRE_SESSION_RANGES["is_outdoor"]),
            "caffeine_today": random.choice(PRE_SESSION_RANGES["caffeine_today"]),
            "alcohol_last_24h": random.choice(PRE_SESSION_RANGES["alcohol_last_24h"]),
            "has_pain": False,
            "pain_location": None,
            "pain_severity": 0,
        }
    
    def _generate_description(
        self,
        baseline: Dict[str, Any],
        pre_session: Dict[str, Any],
        edge_case_tags: List[str]
    ) -> str:
        """Generate a human-readable scenario description"""
        
        age = baseline.get("age", "unknown")
        years = baseline.get("years_climbing", "unknown")
        boulder = baseline.get("highest_boulder_grade", "unknown")
        sport = baseline.get("highest_sport_grade", "unknown")
        
        energy = pre_session.get("energy_level", "?")
        motivation = pre_session.get("motivation", "?")
        goal = pre_session.get("primary_goal", "unknown").replace("_", " ")
        location = "outdoors" if pre_session.get("is_outdoor") else "at the gym"
        
        description = f"{age}-year-old climber with {years} years experience (boulder: {boulder}, sport: {sport}). "
        description += f"Energy {energy}/10, motivation {motivation}/10, planning to climb {location} with goal: {goal}. "
        
        # Add edge case context
        if edge_case_tags:
            description += f"Edge cases: {', '.join(edge_case_tags).replace('_', ' ')}."
        
        # Add specific notable conditions
        if pre_session.get("has_pain"):
            description += f" Currently experiencing pain in {pre_session.get('pain_location')} (severity {pre_session.get('pain_severity')}/10)."
        
        if pre_session.get("days_since_rest_day", 0) >= 5:
            description += f" Has not taken a rest day in {pre_session.get('days_since_rest_day')} days."
        
        if pre_session.get("sleep_quality", 10) <= 4:
            description += " Poor sleep quality last night."
        
        if pre_session.get("stress_level", 0) >= 8:
            description += " High stress levels."
        
        return description.strip()
    
    def generate_from_template(
        self,
        template_name: str,
        variations: int = 5,
        review_session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate scenarios from a predefined template with variations"""
        
        templates = {
            "returning_from_injury": {
                "baseline_overrides": {"injury_history": ["recent_finger_injury"]},
                "pre_session_overrides": {"days_since_last_session": lambda: random.randint(7, 21)},
                "edge_case_tags": ["returning_from_break", "injury_combinations"],
            },
            "competition_prep": {
                "baseline_overrides": {"performance_anxiety_baseline": lambda: random.randint(6, 9)},
                "pre_session_overrides": {"competition_upcoming": True, "days_until_competition": lambda: random.randint(1, 14)},
                "edge_case_tags": ["anxiety_stress", "goal_conflicts"],
            },
            "overtraining_risk": {
                "pre_session_overrides": {
                    "days_since_rest_day": lambda: random.randint(5, 8),
                    "muscle_soreness": lambda: random.randint(6, 9),
                    "energy_level": lambda: random.randint(3, 5),
                },
                "edge_case_tags": ["recovery_extremes"],
            },
        }
        
        if template_name not in templates:
            return {"error": f"Template '{template_name}' not found"}
        
        template = templates[template_name]
        generation_batch = f"template_{template_name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        scenarios = []
        
        for _ in range(variations):
            baseline = self._generate_baseline_profile()
            pre_session = self._generate_pre_session_state()
            
            # Apply template overrides
            for key, value in template.get("baseline_overrides", {}).items():
                baseline[key] = value() if callable(value) else value
            
            for key, value in template.get("pre_session_overrides", {}).items():
                pre_session[key] = value() if callable(value) else value
            
            description = self._generate_description(baseline, pre_session, template["edge_case_tags"])
            
            scenario_data = {
                "baseline_snapshot": baseline,
                "pre_session_snapshot": pre_session,
                "scenario_description": description,
                "edge_case_tags": template["edge_case_tags"],
                "difficulty_level": "edge_case",
                "generation_batch": generation_batch,
                "review_session_id": review_session_id,
                "status": "pending",
            }
            
            result = self.supabase.table("synthetic_scenarios").insert(scenario_data).execute()
            if result.data:
                scenarios.append(result.data[0])
        
        return {
            "template": template_name,
            "scenarios_generated": len(scenarios),
            "scenario_ids": [s["id"] for s in scenarios],
            "generation_batch": generation_batch,
        }

