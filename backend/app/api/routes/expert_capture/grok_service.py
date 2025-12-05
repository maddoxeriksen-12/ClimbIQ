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
   - current_goal: object with:
     - type (send_outdoor_project/competition_prep/improve_grade/build_endurance/finger_strength/technique_refinement/general_fitness/return_from_injury/mental_game/volume_building)
     - target_grade (optional, e.g., "V8" or "5.13a")
     - deadline (optional, e.g., "3 months", "competition in 6 weeks")
     - description (short description of what they're working toward)

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
    baseline.setdefault("current_goal", {
        "type": "general_fitness",
        "target_grade": None,
        "deadline": None,
        "description": "General climbing improvement"
    })
    
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


# ============================================================================
# AI RESEARCH FOR RULE GENERATION
# ============================================================================

RESEARCH_PROMPT = """You are a sports science researcher with expertise in rock climbing, exercise physiology, and sports medicine. 

The user wants to research: "{topic}"

Search your knowledge for relevant peer-reviewed research on this topic as it relates to climbing performance, training, and injury prevention. Focus on:
- Studies from sports medicine journals
- Climbing-specific research
- Exercise physiology findings applicable to climbing
- Sports psychology research

For EACH relevant research finding, provide:

1. **citation**: Complete citation information
   - authors: List of author names (array of strings)
   - title: Full paper title
   - journal: Journal name
   - year: Publication year (integer)
   - volume: Volume number (or null)
   - pages: Page numbers (or null)
   - doi: DOI if known (or null)
   - pmid: PubMed ID if known (or null)

2. **study_details**:
   - study_type: One of: meta_analysis, systematic_review, rct, cohort, cross_sectional, case_control, case_series, expert_opinion
   - sample_size: Number of participants (or null if not applicable)
   - population: Description of study population
   - evidence_level: One of: 1a, 1b, 2a, 2b, 3a, 3b, 4, 5

3. **key_findings**: Array of objects with:
   - finding: Clear description of finding
   - effect_size: Quantified effect if available (or null)
   - confidence: high, medium, or low

4. **proposed_rules**: Array of rule objects that could be derived from this research:
   - name: Descriptive rule name (snake_case)
   - description: Clear description of what the rule does
   - rule_category: One of: safety, interaction, edge_case, conservative, performance
   - conditions: JSON conditions object with format {{"ALL": [{{"field": "field_name", "op": ">=", "value": number}}]}}
   - actions: Array of action objects with format [{{"type": "add_recommendation", "message": "recommendation text", "reason": "reasoning"}}]
   - priority: Suggested priority 0-100 (safety=90-100, conservative=70-89, performance=40-69)
   - confidence: high, medium, or low based on evidence quality

5. **relevance_score**: 1-10 how relevant this is to "{topic}"

Return 3-6 research findings with their proposed rules. Focus on quality over quantity.
Return valid JSON only with this structure:
{{
  "research_topic": "{topic}",
  "findings": [
    {{
      "citation": {{...}},
      "study_details": {{...}},
      "key_findings": [...],
      "proposed_rules": [...],
      "relevance_score": 8
    }}
  ],
  "summary": "Brief summary of research landscape",
  "total_proposed_rules": 5
}}
"""


async def research_topic_for_rules(topic: str) -> Dict[str, Any]:
    """
    Use Grok AI to research a topic and generate evidence-based rules.
    
    Args:
        topic: The topic to research (e.g., "finger injury prevention", "sleep and performance")
    
    Returns:
        Dictionary with research findings and proposed rules
    """
    
    if not settings.GROK_API_KEY:
        return {"error": "GROK_API_KEY not configured", "findings": []}
    
    prompt = RESEARCH_PROMPT.format(topic=topic)
    
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
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
                            "content": "You are a sports science researcher. Always respond with valid JSON only, no markdown formatting. Provide real, accurate citations from peer-reviewed literature."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.3,  # Lower temp for more accurate research
                    "max_tokens": 12000,
                }
            )
            
            if response.status_code != 200:
                return {
                    "error": f"Grok API error: {response.status_code} - {response.text}",
                    "findings": []
                }
            
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            # Parse the JSON response
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            research_data = json.loads(content.strip())
            
            # Validate and enrich the response
            findings = research_data.get("findings", [])
            
            for finding in findings:
                # Ensure citation has all required fields
                citation = finding.get("citation", {})
                citation.setdefault("authors", ["Unknown"])
                citation.setdefault("title", "Untitled")
                citation.setdefault("journal", None)
                citation.setdefault("year", datetime.utcnow().year)
                citation.setdefault("doi", None)
                citation.setdefault("pmid", None)
                finding["citation"] = citation
                
                # Ensure study_details has all required fields
                study = finding.get("study_details", {})
                study.setdefault("study_type", "cross_sectional")
                study.setdefault("sample_size", None)
                study.setdefault("population", "climbers")
                study.setdefault("evidence_level", "3b")
                finding["study_details"] = study
                
                # Generate citation key
                first_author = citation["authors"][0].split()[-1].lower() if citation["authors"] else "unknown"
                year = citation.get("year", datetime.utcnow().year)
                topic_slug = topic.lower().replace(" ", "_")[:20]
                finding["citation_key"] = f"{first_author}_{year}_{topic_slug}"
                
                # Ensure proposed_rules have all required fields
                rules = finding.get("proposed_rules", [])
                for rule in rules:
                    rule.setdefault("name", f"rule_{uuid.uuid4().hex[:8]}")
                    rule.setdefault("description", "Generated rule")
                    rule.setdefault("rule_category", "performance")
                    rule.setdefault("conditions", {"ALL": []})
                    rule.setdefault("actions", [])
                    rule.setdefault("priority", 50)
                    rule.setdefault("confidence", "medium")
                    # Add source info
                    rule["source"] = "literature"
                    rule["evidence"] = f"{', '.join(citation['authors'][:3])} ({citation['year']}): {citation['title'][:100]}"
                    rule["citation_key"] = finding["citation_key"]
                finding["proposed_rules"] = rules
            
            return {
                "success": True,
                "research_topic": topic,
                "findings": findings,
                "summary": research_data.get("summary", ""),
                "total_proposed_rules": sum(len(f.get("proposed_rules", [])) for f in findings),
                "model": "grok-4-1-fast-reasoning",
                "generated_at": datetime.utcnow().isoformat(),
            }
            
    except json.JSONDecodeError as e:
        return {
            "error": f"Failed to parse Grok response as JSON: {str(e)}",
            "findings": [],
            "raw_content": content[:1000] if 'content' in dir() else None
        }
    except httpx.TimeoutException:
        return {"error": "Grok API request timed out (research may take up to 90s)", "findings": []}
    except Exception as e:
        return {"error": f"Error researching topic: {str(e)}", "findings": []}

