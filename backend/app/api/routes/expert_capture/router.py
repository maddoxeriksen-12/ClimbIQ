"""
API Router for Expert Capture System

Provides endpoints for:
- Review session management
- Scenario generation and retrieval
- Expert response submission
- Consensus calculation
- Rule management
- Prior extraction
- Analytics
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from .schemas import (
    # Enums
    ScenarioStatus, ConfidenceLevel, RuleCategory, RuleSource,
    # Review Session
    ReviewSessionCreate, ReviewSessionUpdate, ReviewSessionOut,
    # Scenario
    SyntheticScenarioCreate, SyntheticScenarioOut, ScenarioWithResponses,
    ScenarioGenerationRequest, ScenarioGenerationResponse,
    # Response
    ExpertResponseCreate, ExpertResponseUpdate, ExpertResponseOut,
    # Rule
    ExpertRuleCreate, ExpertRuleUpdate, ExpertRuleOut,
    # Consensus
    ScenarioConsensusOut,
    # Analytics
    AnalyticsOverview, ExpertAnalytics,
    # Priors
    ExtractedPriorsResponse,
)
from .services import ExpertCaptureService
from .scenario_generator import ScenarioGenerator
from .prior_extractor import PriorExtractor
from .rule_engine import RuleEngine
from app.core.supabase import get_supabase_client


router = APIRouter(prefix="/expert-capture", tags=["Expert Capture"])


# ============ DEPENDENCIES ============

def get_service() -> ExpertCaptureService:
    """Get ExpertCaptureService instance"""
    return ExpertCaptureService(get_supabase_client())


def get_generator() -> ScenarioGenerator:
    """Get ScenarioGenerator instance"""
    return ScenarioGenerator(get_supabase_client())


def get_extractor() -> PriorExtractor:
    """Get PriorExtractor instance"""
    return PriorExtractor(get_supabase_client())


def get_rule_engine() -> RuleEngine:
    """Get RuleEngine instance"""
    return RuleEngine(get_supabase_client())


# ============ REVIEW SESSIONS ============

@router.post("/sessions", response_model=dict)
async def create_review_session(
    session: ReviewSessionCreate,
    service: ExpertCaptureService = Depends(get_service)
):
    """Create a new expert review session"""
    return service.create_review_session(session)


@router.get("/sessions", response_model=List[dict])
async def list_review_sessions(
    status: Optional[str] = None,
    service: ExpertCaptureService = Depends(get_service)
):
    """List all review sessions"""
    return service.list_review_sessions(status)


@router.get("/sessions/{session_id}", response_model=dict)
async def get_review_session(
    session_id: str,
    service: ExpertCaptureService = Depends(get_service)
):
    """Get review session details with associated scenarios"""
    result = service.get_review_session(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Review session not found")
    return result


@router.patch("/sessions/{session_id}", response_model=dict)
async def update_review_session(
    session_id: str,
    update: ReviewSessionUpdate,
    service: ExpertCaptureService = Depends(get_service)
):
    """Update review session"""
    result = service.update_review_session(session_id, update)
    if not result:
        raise HTTPException(status_code=404, detail="Review session not found")
    return result


# ============ SCENARIOS ============

@router.post("/scenarios/generate", response_model=dict)
async def generate_scenarios(
    count: int = Query(10, ge=1, le=50, description="Number of scenarios to generate"),
    edge_case_types: Optional[List[str]] = Query(None, description="Specific edge case types to include"),
    review_session_id: Optional[str] = Query(None, description="Associated review session ID"),
    generator: ScenarioGenerator = Depends(get_generator)
):
    """Generate synthetic scenarios for expert review"""
    return generator.generate_batch(count, edge_case_types, review_session_id)


@router.post("/scenarios/generate/template", response_model=dict)
async def generate_from_template(
    template_name: str = Query(..., description="Template name (e.g., 'returning_from_injury', 'competition_prep', 'overtraining_risk')"),
    variations: int = Query(5, ge=1, le=20, description="Number of variations to generate"),
    review_session_id: Optional[str] = None,
    generator: ScenarioGenerator = Depends(get_generator)
):
    """Generate scenarios from a predefined template with variations"""
    result = generator.generate_from_template(template_name, variations, review_session_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/ai/status", response_model=dict)
async def check_ai_status():
    """Check if AI generation is configured and working"""
    from app.core.config import settings
    
    api_key_configured = bool(settings.GROK_API_KEY and len(settings.GROK_API_KEY) > 10)
    api_key_preview = settings.GROK_API_KEY[:10] + "..." if api_key_configured else "NOT SET"
    
    return {
        "ai_configured": api_key_configured,
        "api_key_preview": api_key_preview,
        "model": "grok-4-1-fast-reasoning",
        "endpoint": "https://api.x.ai/v1/chat/completions",
    }


@router.post("/scenarios/generate/ai", response_model=dict)
async def generate_scenarios_with_ai(
    count: int = Query(5, ge=1, le=10, description="Number of scenarios to generate (1-10)"),
    edge_case_focus: Optional[List[str]] = Query(None, description="Edge case types to focus on"),
    difficulty_bias: Optional[str] = Query(None, description="Bias toward 'common', 'edge_case', or 'extreme'"),
    service: ExpertCaptureService = Depends(get_service)
):
    """
    Generate realistic synthetic scenarios using Grok AI.
    
    The AI will create diverse, realistic climbing scenarios covering:
    - Different experience levels and demographics
    - Various physical and psychological states
    - Edge cases requiring nuanced recommendations
    
    Scenarios are automatically saved to the database with 'pending' status.
    """
    from .grok_service import generate_scenarios_with_grok, normalize_scenario
    
    result = await generate_scenarios_with_grok(count, edge_case_focus, difficulty_bias)
    
    if "error" in result and result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])
    
    scenarios = result.get("scenarios", [])
    saved_scenarios = []
    
    for scenario in scenarios:
        # Normalize and validate
        normalized = normalize_scenario(scenario)
        
        # Save to database
        from .schemas import SyntheticScenarioCreate, DifficultyLevel
        
        try:
            difficulty = DifficultyLevel(normalized.get("difficulty_level", "common"))
        except ValueError:
            difficulty = DifficultyLevel.common
        
        scenario_input = SyntheticScenarioCreate(
            baseline_snapshot=normalized["baseline_snapshot"],
            pre_session_snapshot=normalized["pre_session_snapshot"],
            scenario_description=normalized.get("scenario_description", ""),
            edge_case_tags=normalized.get("edge_case_tags", []),
            difficulty_level=difficulty,
            ai_recommendation=normalized.get("ai_recommendation"),
            ai_reasoning=normalized.get("ai_reasoning"),
            generation_batch=result.get("generation_batch"),
        )
        
        saved = service.create_scenario(scenario_input)
        if saved:
            saved_scenarios.append(saved)
    
    return {
        "success": True,
        "scenarios_generated": len(saved_scenarios),
        "generation_batch": result.get("generation_batch"),
        "model": result.get("model", "grok-3-fast"),
        "scenario_ids": [s.get("id") for s in saved_scenarios],
    }


@router.post("/rules/research", response_model=dict)
async def research_topic_for_rule_creation(
    topic: str = Query(..., min_length=3, max_length=200, description="Topic to research for rule creation"),
    service: ExpertCaptureService = Depends(get_service)
):
    """
    Use AI to research a topic and generate evidence-based rule proposals.
    
    The AI will:
    1. Search for relevant peer-reviewed research
    2. Extract key findings and citations
    3. Generate proposed rules based on evidence
    
    Returns research findings with proposed rules that can be reviewed and added.
    """
    from .grok_service import research_topic_for_rules
    
    result = await research_topic_for_rules(topic)
    
    if "error" in result and result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])
    
    return result


@router.post("/rules/research/add", response_model=dict)
async def add_researched_rule(
    rule_data: dict,
    citation_data: dict,
    created_by: str = Query(..., description="User who is adding this rule"),
    service: ExpertCaptureService = Depends(get_service)
):
    """
    Add a rule generated from AI research, along with its literature citation.
    
    This saves both the literature reference and the rule to the database.
    """
    from .schemas import ExpertRuleCreate
    
    # First, save the literature reference if it has citation info
    citation = citation_data.get("citation", {})
    if citation.get("title"):
        lit_ref_data = {
            "citation_key": citation_data.get("citation_key", f"research_{citation.get('year', 2024)}"),
            "authors": citation.get("authors", []),
            "title": citation.get("title", ""),
            "journal": citation.get("journal"),
            "year": citation.get("year", 2024),
            "volume": citation.get("volume"),
            "pages": citation.get("pages"),
            "doi": citation.get("doi"),
            "pmid": citation.get("pmid"),
            "study_type": citation_data.get("study_details", {}).get("study_type"),
            "sample_size": citation_data.get("study_details", {}).get("sample_size"),
            "population": citation_data.get("study_details", {}).get("population"),
            "evidence_level": citation_data.get("study_details", {}).get("evidence_level"),
            "key_findings": citation_data.get("key_findings", []),
        }
        
        # Upsert literature reference
        try:
            supabase = get_supabase_client()
            supabase.table("literature_references").upsert(
                lit_ref_data,
                on_conflict="citation_key"
            ).execute()
        except Exception as e:
            print(f"Warning: Could not save literature reference: {e}")
    
    # Now create the rule
    rule_create = ExpertRuleCreate(
        name=rule_data.get("name"),
        description=rule_data.get("description"),
        conditions=rule_data.get("conditions", {}),
        actions=rule_data.get("actions", []),
        condition_fields=list(extract_condition_fields(rule_data.get("conditions", {}))),
        rule_category=rule_data.get("rule_category", "performance"),
        priority=rule_data.get("priority", 50),
        confidence=rule_data.get("confidence", "medium"),
        source="literature",
        evidence=rule_data.get("evidence", ""),
        contributors=[created_by],
    )
    
    result = service.create_rule(rule_create, created_by)
    
    return {
        "success": True,
        "rule": result,
        "citation_saved": bool(citation.get("title")),
    }


def extract_condition_fields(conditions: dict) -> set:
    """Extract field names from condition structure"""
    fields = set()
    
    if "ALL" in conditions:
        for cond in conditions["ALL"]:
            if "field" in cond:
                fields.add(cond["field"])
    if "ANY" in conditions:
        for cond in conditions["ANY"]:
            if "field" in cond:
                fields.add(cond["field"])
    if "field" in conditions:
        fields.add(conditions["field"])
    
    return fields


@router.post("/scenarios", response_model=dict)
async def create_scenario(
    scenario: SyntheticScenarioCreate,
    service: ExpertCaptureService = Depends(get_service)
):
    """Create a single scenario manually"""
    return service.create_scenario(scenario)


@router.get("/scenarios", response_model=List[dict])
async def list_scenarios(
    status: Optional[ScenarioStatus] = None,
    review_session_id: Optional[str] = None,
    edge_case_tag: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    service: ExpertCaptureService = Depends(get_service)
):
    """List scenarios with optional filters"""
    return service.list_scenarios(status, review_session_id, edge_case_tag, limit, offset)


@router.get("/scenarios/next", response_model=Optional[dict])
async def get_next_scenario(
    expert_id: str = Query(..., description="Expert user ID"),
    review_session_id: Optional[str] = None,
    service: ExpertCaptureService = Depends(get_service)
):
    """Get next unreviewed scenario for an expert"""
    return service.get_next_scenario_for_expert(expert_id, review_session_id)


@router.get("/scenarios/{scenario_id}", response_model=dict)
async def get_scenario(
    scenario_id: str,
    service: ExpertCaptureService = Depends(get_service)
):
    """Get scenario with all expert responses"""
    result = service.get_scenario_with_responses(scenario_id)
    if not result:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return result


@router.patch("/scenarios/{scenario_id}/status", response_model=dict)
async def update_scenario_status(
    scenario_id: str,
    status: ScenarioStatus = Query(..., description="New status"),
    service: ExpertCaptureService = Depends(get_service)
):
    """Update scenario status"""
    result = service.update_scenario_status(scenario_id, status)
    if not result:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return result


# ============ EXPERT RESPONSES ============

@router.post("/responses", response_model=dict)
async def create_expert_response(
    response: ExpertResponseCreate,
    service: ExpertCaptureService = Depends(get_service)
):
    """Submit expert response for a scenario"""
    return service.create_response(response)


@router.get("/responses/{response_id}", response_model=dict)
async def get_response(
    response_id: str,
    service: ExpertCaptureService = Depends(get_service)
):
    """Get a specific expert response"""
    result = service.get_response(response_id)
    if not result:
        raise HTTPException(status_code=404, detail="Response not found")
    return result


@router.patch("/responses/{response_id}", response_model=dict)
async def update_response(
    response_id: str,
    update: ExpertResponseUpdate,
    service: ExpertCaptureService = Depends(get_service)
):
    """Update an existing response (before final submission)"""
    result = service.update_response(response_id, update)
    if not result:
        raise HTTPException(status_code=404, detail="Response not found")
    return result


@router.get("/experts/{expert_id}/responses", response_model=List[dict])
async def list_expert_responses(
    expert_id: str,
    review_session_id: Optional[str] = None,
    service: ExpertCaptureService = Depends(get_service)
):
    """List all responses from a specific expert"""
    return service.list_responses_by_expert(expert_id, review_session_id)


# ============ CONSENSUS ============

@router.post("/scenarios/{scenario_id}/consensus", response_model=dict)
async def calculate_consensus(
    scenario_id: str,
    service: ExpertCaptureService = Depends(get_service)
):
    """Calculate consensus from all expert responses for a scenario"""
    result = service.calculate_consensus(scenario_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/consensus", response_model=List[dict])
async def list_consensus(
    processed: Optional[bool] = None,
    service: ExpertCaptureService = Depends(get_service)
):
    """List all consensus records"""
    return service.list_consensus(processed)


# ============ RULES ============

@router.post("/rules", response_model=dict)
async def create_rule(
    rule: ExpertRuleCreate,
    created_by: str = Query(..., description="User ID of rule creator"),
    service: ExpertCaptureService = Depends(get_service),
    rule_engine: RuleEngine = Depends(get_rule_engine)
):
    """Create a new expert rule"""
    # Validate rule
    is_valid, errors = rule_engine.validate_rule(rule.model_dump())
    if not is_valid:
        raise HTTPException(status_code=400, detail={"message": "Invalid rule", "errors": errors})
    
    return service.create_rule(rule, created_by)


@router.get("/rules", response_model=List[dict])
async def list_rules(
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    service: ExpertCaptureService = Depends(get_service)
):
    """List rules with optional filters"""
    return service.list_rules(category, is_active)


@router.get("/rules/by-category", response_model=dict)
async def get_rules_by_category(
    rule_engine: RuleEngine = Depends(get_rule_engine)
):
    """Get all active rules grouped by category"""
    return rule_engine.get_rules_by_category()


@router.get("/rules/conflicts", response_model=List[dict])
async def find_rule_conflicts(
    rule_engine: RuleEngine = Depends(get_rule_engine)
):
    """Identify potentially conflicting rules"""
    return rule_engine.find_conflicting_rules()


@router.get("/rules/{rule_id}", response_model=dict)
async def get_rule(
    rule_id: str,
    service: ExpertCaptureService = Depends(get_service)
):
    """Get rule details with audit history"""
    result = service.get_rule(rule_id)
    if not result:
        raise HTTPException(status_code=404, detail="Rule not found")
    return result


@router.patch("/rules/{rule_id}", response_model=dict)
async def update_rule(
    rule_id: str,
    updates: ExpertRuleUpdate,
    updated_by: str = Query(..., description="User ID making the update"),
    reason: Optional[str] = Query(None, description="Reason for the update"),
    service: ExpertCaptureService = Depends(get_service)
):
    """Update a rule (creates audit log entry)"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    result = service.update_rule(rule_id, update_data, updated_by, reason)
    if not result:
        raise HTTPException(status_code=404, detail="Rule not found")
    return result


@router.post("/rules/{rule_id}/deactivate", response_model=dict)
async def deactivate_rule(
    rule_id: str,
    reason: str = Query(..., description="Reason for deactivation"),
    deactivated_by: str = Query(..., description="User ID performing deactivation"),
    service: ExpertCaptureService = Depends(get_service)
):
    """Deactivate a rule"""
    result = service.deactivate_rule(rule_id, reason, deactivated_by)
    if not result:
        raise HTTPException(status_code=404, detail="Rule not found")
    return result


@router.post("/rules/{rule_id}/test", response_model=dict)
async def test_rule(
    rule_id: str,
    test_states: List[dict],
    service: ExpertCaptureService = Depends(get_service),
    rule_engine: RuleEngine = Depends(get_rule_engine)
):
    """Test a rule against multiple test states"""
    rule = service.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    return rule_engine.test_rule(rule, test_states)


@router.post("/rules/match", response_model=dict)
async def match_rules(
    user_state: dict,
    rule_engine: RuleEngine = Depends(get_rule_engine)
):
    """Find all rules that match a given user state"""
    matched = rule_engine.match_rules(user_state)
    return {
        "user_state_summary": {k: v for k, v in user_state.items() if not isinstance(v, (dict, list))},
        "matched_rules": len(matched),
        "rules": [{"id": r["id"], "name": r["name"], "category": r["rule_category"], "priority": r["priority"]} for r in matched],
    }


# ============ PRIOR EXTRACTION ============

@router.post("/priors/extract", response_model=dict)
async def extract_priors(
    extractor: PriorExtractor = Depends(get_extractor)
):
    """Extract coefficient signals from all unprocessed consensus records"""
    return extractor.extract_and_aggregate_priors()


@router.get("/priors/current", response_model=dict)
async def get_current_priors(
    extractor: PriorExtractor = Depends(get_extractor)
):
    """Get current blended priors (literature + expert)"""
    return extractor.get_blended_priors()


@router.get("/priors/comparison", response_model=dict)
async def compare_priors(
    extractor: PriorExtractor = Depends(get_extractor)
):
    """Compare literature priors vs expert-derived priors"""
    return extractor.compare_sources()


@router.get("/priors/scenario/{scenario_id}", response_model=dict)
async def get_scenario_coefficient_signals(
    scenario_id: str,
    extractor: PriorExtractor = Depends(get_extractor)
):
    """Extract coefficient signals from a single scenario"""
    result = extractor.extract_coefficient_signals(scenario_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ============ ANALYTICS ============

@router.get("/analytics/overview", response_model=dict)
async def get_analytics_overview(
    service: ExpertCaptureService = Depends(get_service)
):
    """Get overview analytics for expert capture system"""
    return service.get_analytics_overview()


@router.get("/analytics/expert/{expert_id}", response_model=dict)
async def get_expert_analytics(
    expert_id: str,
    service: ExpertCaptureService = Depends(get_service)
):
    """Get analytics for a specific expert"""
    return service.get_expert_analytics(expert_id)


@router.get("/analytics/coefficients", response_model=dict)
async def get_coefficient_analytics(
    extractor: PriorExtractor = Depends(get_extractor)
):
    """Get analytics on extracted coefficient signals"""
    return extractor.get_coefficient_analytics()

