"""
Grok AI Service for Scenario Generation

Uses xAI's Grok model to generate realistic synthetic climbing scenarios
for expert review.
"""

import json
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

from app.core.config import settings


GROK_API_URL = "https://api.x.ai/v1/chat/completions"

SCENARIO_GENERATION_PROMPT = """You are an expert climbing coach and sports scientist. Generate realistic synthetic climbing scenarios for expert review.

Each scenario should represent a real climber about to start a session. Generate diverse scenarios that cover:
- Different experience levels (beginner to elite)
- Various physical states (well-rested to fatigued)
- Different psychological profiles
- Edge cases that require nuanced recommendations

For each scenario, provide:

1. **baseline_snapshot** (climber's general profile):
   - age (14-65)
   - years_climbing (0.5-30)
   - highest_boulder_grade (VB to V14)
   - highest_sport_grade (5.6 to 5.15a)
   - sessions_per_week (1-7)
   - training_focus (bouldering/sport/general/power/endurance/technique)
   - fear_of_falling (1-10)
   - performance_anxiety_baseline (1-10)
   - injury_history (list of past injuries or empty)

2. **pre_session_snapshot** (current state before session):
   - energy_level (1-10)
   - motivation (1-10)
   - sleep_quality (1-10)
   - sleep_hours (4-10)
   - stress_level (1-10)
   - muscle_soreness (1-10)
   - days_since_last_session (0-14)
   - days_since_rest_day (0-7)
   - planned_duration (30-180 minutes)
   - primary_goal (push_limits/volume/technique/active_recovery/social/skill_work/project)
   - is_outdoor (true/false)
   - caffeine_today (true/false)
   - alcohol_last_24h (true/false)
   - has_pain (true/false)
   - pain_location (if has_pain: finger/shoulder/elbow/wrist/knee/back/skin)
   - pain_severity (if has_pain: 1-10)

3. **scenario_description**: A 2-3 sentence description of the climber and their situation.

4. **edge_case_tags**: List of applicable tags from:
   - injury_present, high_fatigue, low_motivation, outdoor_conditions
   - competition_prep, returning_from_break, overtraining, mental_block
   - weather_dependent, time_constrained, recovery_focused, project_session
   - beginner, elite, masters_athlete, youth_climber
   - contradictory_signals, anxiety_stress, demographic_edge

5. **difficulty_level**: "common", "edge_case", or "extreme"

6. **ai_recommendation**: Your recommended session type and why:
   - session_type: project/limit_bouldering/volume/technique/training/light_session/rest_day/active_recovery
   - intensity: very_light/light/moderate/high/max_effort
   - key_considerations: list of 2-3 important factors
   - warnings: list of any concerns

7. **ai_reasoning**: 2-4 sentences explaining your recommendation.

Generate {count} diverse scenarios. Make sure to include a mix of:
- Common everyday scenarios (50%)
- Edge cases with unusual combinations (35%)
- Extreme/challenging decision scenarios (15%)

Return valid JSON array of scenarios.
"""


async def generate_scenarios_with_grok(
    count: int = 5,
    edge_case_focus: Optional[List[str]] = None,
    difficulty_bias: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate synthetic scenarios using Grok AI.
    
    Args:
        count: Number of scenarios to generate (1-10)
        edge_case_focus: Optional list of edge case types to focus on
        difficulty_bias: Optional bias toward 'common', 'edge_case', or 'extreme'
    
    Returns:
        Dictionary with generated scenarios and metadata
    """
    
    if not settings.GROK_API_KEY:
        return {"error": "GROK_API_KEY not configured", "scenarios": []}
    
    # Build the prompt
    prompt = SCENARIO_GENERATION_PROMPT.format(count=count)
    
    if edge_case_focus:
        prompt += f"\n\nFocus on these edge case types: {', '.join(edge_case_focus)}"
    
    if difficulty_bias:
        prompt += f"\n\nBias toward '{difficulty_bias}' difficulty scenarios."
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GROK_API_URL,
                headers={
                    "Authorization": f"Bearer {settings.GROK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "grok-4-1-fast-reasoning",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an expert climbing coach. Always respond with valid JSON only, no markdown formatting."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.8,
                    "max_tokens": 8000,
                }
            )
            
            if response.status_code != 200:
                return {
                    "error": f"Grok API error: {response.status_code} - {response.text}",
                    "scenarios": []
                }
            
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Parse the JSON response
            # Handle potential markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            scenarios = json.loads(content.strip())
            
            # Ensure it's a list
            if isinstance(scenarios, dict) and "scenarios" in scenarios:
                scenarios = scenarios["scenarios"]
            elif not isinstance(scenarios, list):
                scenarios = [scenarios]
            
            # Add metadata to each scenario
            generation_batch = f"grok_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
            for scenario in scenarios:
                scenario["generation_batch"] = generation_batch
                scenario["status"] = "pending"
                scenario["generated_at"] = datetime.utcnow().isoformat()
            
            return {
                "success": True,
                "scenarios": scenarios,
                "generation_batch": generation_batch,
                "count": len(scenarios),
                "model": "grok-4-1-fast-reasoning",
            }
            
    except json.JSONDecodeError as e:
        return {
            "error": f"Failed to parse Grok response as JSON: {str(e)}",
            "scenarios": [],
            "raw_content": content[:500] if 'content' in dir() else None
        }
    except httpx.TimeoutException:
        return {"error": "Grok API request timed out", "scenarios": []}
    except Exception as e:
        return {"error": f"Error generating scenarios: {str(e)}", "scenarios": []}


def validate_scenario(scenario: Dict[str, Any]) -> tuple[bool, List[str]]:
    """Validate a generated scenario has all required fields."""
    errors = []
    
    required_baseline = ["age", "years_climbing", "highest_boulder_grade"]
    required_presession = ["energy_level", "motivation", "sleep_quality", "primary_goal"]
    
    baseline = scenario.get("baseline_snapshot", {})
    presession = scenario.get("pre_session_snapshot", {})
    
    for field in required_baseline:
        if field not in baseline:
            errors.append(f"Missing baseline field: {field}")
    
    for field in required_presession:
        if field not in presession:
            errors.append(f"Missing pre_session field: {field}")
    
    if not scenario.get("scenario_description"):
        errors.append("Missing scenario_description")
    
    return len(errors) == 0, errors


def normalize_scenario(scenario: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize and clean up a generated scenario."""
    
    # Ensure baseline snapshot has all fields with defaults
    baseline = scenario.get("baseline_snapshot", {})
    baseline.setdefault("age", 30)
    baseline.setdefault("years_climbing", 3)
    baseline.setdefault("highest_boulder_grade", "V5")
    baseline.setdefault("highest_sport_grade", "5.11a")
    baseline.setdefault("sessions_per_week", 3)
    baseline.setdefault("training_focus", "general")
    baseline.setdefault("fear_of_falling", 5)
    baseline.setdefault("performance_anxiety_baseline", 5)
    baseline.setdefault("injury_history", [])
    
    # Ensure pre_session snapshot has all fields with defaults
    presession = scenario.get("pre_session_snapshot", {})
    presession.setdefault("energy_level", 7)
    presession.setdefault("motivation", 7)
    presession.setdefault("sleep_quality", 7)
    presession.setdefault("sleep_hours", 7)
    presession.setdefault("stress_level", 4)
    presession.setdefault("muscle_soreness", 3)
    presession.setdefault("days_since_last_session", 2)
    presession.setdefault("days_since_rest_day", 1)
    presession.setdefault("planned_duration", 90)
    presession.setdefault("primary_goal", "volume")
    presession.setdefault("is_outdoor", False)
    presession.setdefault("caffeine_today", False)
    presession.setdefault("alcohol_last_24h", False)
    presession.setdefault("has_pain", False)
    
    # Clamp numeric values to valid ranges
    baseline["age"] = max(14, min(65, baseline.get("age", 30)))
    baseline["fear_of_falling"] = max(1, min(10, baseline.get("fear_of_falling", 5)))
    baseline["performance_anxiety_baseline"] = max(1, min(10, baseline.get("performance_anxiety_baseline", 5)))
    
    presession["energy_level"] = max(1, min(10, presession.get("energy_level", 7)))
    presession["motivation"] = max(1, min(10, presession.get("motivation", 7)))
    presession["sleep_quality"] = max(1, min(10, presession.get("sleep_quality", 7)))
    presession["stress_level"] = max(1, min(10, presession.get("stress_level", 4)))
    presession["muscle_soreness"] = max(1, min(10, presession.get("muscle_soreness", 3)))
    
    scenario["baseline_snapshot"] = baseline
    scenario["pre_session_snapshot"] = presession
    
    # Ensure other fields
    scenario.setdefault("edge_case_tags", [])
    scenario.setdefault("difficulty_level", "common")
    scenario.setdefault("status", "pending")
    
    return scenario

