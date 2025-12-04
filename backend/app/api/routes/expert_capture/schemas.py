"""
Pydantic schemas for the Expert Capture system
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


class ConfidenceLevel(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"
    experimental = "experimental"


class SessionType(str, Enum):
    project = "project"
    limit_bouldering = "limit_bouldering"
    volume = "volume"
    technique = "technique"
    training = "training"
    light_session = "light_session"
    rest_day = "rest_day"
    active_recovery = "active_recovery"


class ScenarioStatus(str, Enum):
    pending = "pending"
    in_review = "in_review"
    consensus_reached = "consensus_reached"
    disputed = "disputed"
    needs_discussion = "needs_discussion"
    archived = "archived"


class DifficultyLevel(str, Enum):
    common = "common"
    edge_case = "edge_case"
    extreme = "extreme"


class RuleCategory(str, Enum):
    safety = "safety"
    interaction = "interaction"
    edge_case = "edge_case"
    conservative = "conservative"
    performance = "performance"


class RuleSource(str, Enum):
    literature = "literature"
    coach_consensus = "coach_consensus"
    ai_suggested = "ai_suggested"
    safety_protocol = "safety_protocol"
    manual = "manual"


class ReviewSessionStatus(str, Enum):
    active = "active"
    completed = "completed"
    archived = "archived"


# ============ Treatment Recommendation ============

class TreatmentRecommendation(BaseModel):
    value: Any
    importance: str = Field(..., pattern="^(critical|helpful|neutral|avoid)$")


# ============ Counterfactual ============

class Counterfactual(BaseModel):
    variable: str
    actual_value: float
    counterfactual_value: float
    new_predicted_quality: float
    would_change_session_type: bool = False
    new_session_type: Optional[SessionType] = None


# ============ Key Driver ============

class KeyDriver(BaseModel):
    rank: int = Field(..., ge=1, le=5)
    variable: str
    direction: str = Field(..., pattern="^(positive|negative)$")


# ============ Interaction Effect ============

class InteractionEffect(BaseModel):
    variables: List[str] = Field(..., min_length=2, max_length=3)
    description: str
    recommendation_without: str
    recommendation_with: str


# ============ Session Structure ============

class WarmupStructure(BaseModel):
    duration_min: int
    include_mobility: bool = True
    include_traversing: bool = True
    intensity: str = Field(..., pattern="^(very_light|light|moderate)$")


class MainSessionStructure(BaseModel):
    focus: str = Field(..., pattern="^(limit_attempts|project_burns|volume|technique_drills)$")
    duration_min: int
    rest_between_attempts: str = Field(..., pattern="^(short|medium|long)$")
    stop_condition: str = Field(..., pattern="^(time_limit|energy_drop|skin_limit|send_progress)$")


class HangboardStructure(BaseModel):
    include: bool
    contraindicated: bool = False
    structure: Optional[str] = Field(None, pattern="^(max_hangs|repeaters|density_hangs)$")
    volume: Optional[str] = Field(None, pattern="^(reduced|normal|extended)$")
    rationale: Optional[str] = None


class SessionStructure(BaseModel):
    warmup: Optional[WarmupStructure] = None
    main_session: Optional[MainSessionStructure] = None
    hangboard: Optional[HangboardStructure] = None
    cooldown_duration_min: Optional[int] = None
    antagonist_work: bool = False


# ============ Expert Response Schemas ============

class ExpertResponseCreate(BaseModel):
    scenario_id: str
    expert_id: str
    
    predicted_quality_optimal: float = Field(..., ge=1, le=10)
    predicted_quality_baseline: float = Field(..., ge=1, le=10)
    prediction_confidence: ConfidenceLevel
    
    recommended_session_type: SessionType
    session_type_confidence: ConfidenceLevel
    
    treatment_recommendations: Dict[str, TreatmentRecommendation] = {}
    counterfactuals: List[Counterfactual] = []
    key_drivers: List[KeyDriver] = []
    interaction_effects: List[InteractionEffect] = []
    session_structure: Optional[SessionStructure] = None
    
    reasoning: str
    agrees_with_ai: str = Field(..., pattern="^(yes|partially|no)$")
    response_duration_sec: Optional[int] = None


class ExpertResponseUpdate(BaseModel):
    predicted_quality_optimal: Optional[float] = Field(None, ge=1, le=10)
    predicted_quality_baseline: Optional[float] = Field(None, ge=1, le=10)
    prediction_confidence: Optional[ConfidenceLevel] = None
    recommended_session_type: Optional[SessionType] = None
    session_type_confidence: Optional[ConfidenceLevel] = None
    treatment_recommendations: Optional[Dict[str, TreatmentRecommendation]] = None
    counterfactuals: Optional[List[Counterfactual]] = None
    key_drivers: Optional[List[KeyDriver]] = None
    interaction_effects: Optional[List[InteractionEffect]] = None
    session_structure: Optional[SessionStructure] = None
    reasoning: Optional[str] = None
    agrees_with_ai: Optional[str] = Field(None, pattern="^(yes|partially|no)$")
    is_complete: Optional[bool] = None


class ExpertResponseOut(BaseModel):
    id: str
    scenario_id: str
    expert_id: str
    predicted_quality_optimal: Optional[float]
    predicted_quality_baseline: Optional[float]
    prediction_confidence: Optional[str]
    recommended_session_type: Optional[str]
    session_type_confidence: Optional[str]
    treatment_recommendations: Dict[str, Any]
    counterfactuals: List[Dict[str, Any]]
    key_drivers: List[Dict[str, Any]]
    interaction_effects: List[Dict[str, Any]]
    session_structure: Optional[Dict[str, Any]]
    reasoning: Optional[str]
    agrees_with_ai: Optional[str]
    response_duration_sec: Optional[int]
    is_complete: bool
    created_at: datetime
    updated_at: datetime


# ============ Scenario Schemas ============

class SyntheticScenarioCreate(BaseModel):
    baseline_snapshot: Dict[str, Any]
    pre_session_snapshot: Dict[str, Any]
    scenario_description: Optional[str] = None
    edge_case_tags: List[str] = []
    difficulty_level: DifficultyLevel = DifficultyLevel.common
    ai_recommendation: Optional[Dict[str, Any]] = None
    ai_reasoning: Optional[str] = None
    assigned_reviewers: List[str] = []
    generation_batch: Optional[str] = None


class SyntheticScenarioOut(BaseModel):
    id: str
    baseline_snapshot: Dict[str, Any]
    pre_session_snapshot: Dict[str, Any]
    scenario_description: Optional[str]
    edge_case_tags: Optional[List[str]]
    difficulty_level: Optional[str]
    ai_recommendation: Optional[Dict[str, Any]]
    ai_reasoning: Optional[str]
    status: str
    assigned_reviewers: Optional[List[str]]
    consensus_recommendation: Optional[Dict[str, Any]]
    generated_at: datetime
    reviewed_at: Optional[datetime]


class ScenarioWithResponses(BaseModel):
    id: str
    baseline_snapshot: Dict[str, Any]
    pre_session_snapshot: Dict[str, Any]
    scenario_description: Optional[str]
    edge_case_tags: List[str]
    difficulty_level: Optional[str]
    ai_recommendation: Optional[Dict[str, Any]]
    ai_reasoning: Optional[str]
    status: str
    responses: List[Dict[str, Any]]
    generated_at: datetime


# ============ Review Session Schemas ============

class ReviewSessionCreate(BaseModel):
    session_date: date = Field(default_factory=date.today)
    session_name: str
    participants: List[str]
    notes: Optional[str] = None


class ReviewSessionUpdate(BaseModel):
    session_name: Optional[str] = None
    participants: Optional[List[str]] = None
    scenarios_reviewed: Optional[int] = None
    rules_created: Optional[int] = None
    rules_modified: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[ReviewSessionStatus] = None


class ReviewSessionOut(BaseModel):
    id: str
    session_date: date
    session_name: Optional[str]
    participants: List[str]
    scenarios_reviewed: int
    rules_created: int
    rules_modified: int
    notes: Optional[str]
    status: str
    created_at: datetime
    completed_at: Optional[datetime]


# ============ Rule Schemas ============

class RuleCondition(BaseModel):
    field: str
    op: str = Field(..., pattern="^(>=|<=|>|<|==|!=|in|contains|contains_location)$")
    value: Any


class RuleConditions(BaseModel):
    ALL: Optional[List[RuleCondition]] = None
    ANY: Optional[List[RuleCondition]] = None
    NOT: Optional[Dict[str, Any]] = None


class RuleAction(BaseModel):
    type: str = Field(..., pattern="^(suppress|add_recommendation|modify_coefficient|override)$")
    target: Optional[str] = None
    recommendation: Optional[Dict[str, Any]] = None
    multiplier: Optional[float] = None
    message: Optional[str] = None
    reason: Optional[str] = None


class ExpertRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    conditions: Dict[str, Any]
    actions: List[Dict[str, Any]]
    condition_fields: List[str]
    rule_category: RuleCategory
    priority: int = Field(50, ge=0, le=100)
    confidence: ConfidenceLevel
    source: RuleSource
    evidence: Optional[str] = None
    contributors: List[str] = []
    source_scenario_id: Optional[str] = None
    review_session_id: Optional[str] = None


class ExpertRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    condition_fields: Optional[List[str]] = None
    rule_category: Optional[RuleCategory] = None
    priority: Optional[int] = Field(None, ge=0, le=100)
    confidence: Optional[ConfidenceLevel] = None
    is_active: Optional[bool] = None
    evidence: Optional[str] = None


class ExpertRuleOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    conditions: Dict[str, Any]
    actions: Dict[str, Any]
    condition_fields: Optional[List[str]]
    rule_category: str
    priority: int
    confidence: Optional[str]
    is_active: bool
    source: str
    evidence: Optional[str]
    contributors: Optional[List[str]]
    created_at: datetime
    updated_at: datetime


# ============ Consensus Schemas ============

class ScenarioConsensusCreate(BaseModel):
    scenario_id: str
    consensus_quality_optimal: Optional[float] = None
    consensus_quality_baseline: Optional[float] = None
    consensus_session_type: Optional[str] = None
    consensus_treatments: Optional[Dict[str, Any]] = None
    coefficient_signals: Optional[Dict[str, Any]] = None
    expert_agreement_score: Optional[float] = Field(None, ge=0, le=1)
    n_experts: int = 0
    disputed_factors: List[str] = []


class ScenarioConsensusOut(BaseModel):
    id: str
    scenario_id: str
    consensus_quality_optimal: Optional[float]
    consensus_quality_baseline: Optional[float]
    consensus_session_type: Optional[str]
    consensus_treatments: Optional[Dict[str, Any]]
    coefficient_signals: Optional[Dict[str, Any]]
    expert_agreement_score: Optional[float]
    n_experts: Optional[int]
    disputed_factors: Optional[List[str]]
    processed_into_priors: bool
    processed_at: Optional[datetime]
    created_at: datetime


# ============ Coefficient Signal Schema ============

class CoefficientSignal(BaseModel):
    variable: str
    implied_effect: float
    n_experts: int
    std_dev: float
    confidence: ConfidenceLevel
    min_effect: Optional[float] = None
    max_effect: Optional[float] = None
    interaction_note: Optional[str] = None


# ============ Prior Extraction Output ============

class ExtractedPrior(BaseModel):
    variable: str
    population_mean: float
    population_std: float
    individual_variance: float
    n_scenarios: int
    total_judgments: int
    sources: List[str]
    agreement_with_literature: Optional[bool] = None


class ExtractedPriorsResponse(BaseModel):
    priors: List[ExtractedPrior]
    extraction_timestamp: datetime
    total_scenarios_processed: int
    total_judgments: int


# ============ Analytics Schemas ============

class AnalyticsOverview(BaseModel):
    total_scenarios: int
    pending_scenarios: int
    reviewed_scenarios: int
    total_responses: int
    complete_responses: int
    total_rules: int
    active_rules: int
    total_review_sessions: int
    active_review_sessions: int
    avg_responses_per_scenario: float
    avg_agreement_score: Optional[float]


class ExpertAnalytics(BaseModel):
    expert_id: str
    total_responses: int
    complete_responses: int
    avg_response_time_sec: Optional[float]
    scenarios_reviewed: int
    agreement_rate_with_ai: float
    rules_contributed: int


# ============ Scenario Generation Schemas ============

class ScenarioGenerationRequest(BaseModel):
    count: int = Field(10, ge=1, le=50)
    edge_case_types: Optional[List[str]] = None
    review_session_id: Optional[str] = None
    difficulty_distribution: Optional[Dict[str, float]] = None  # e.g., {"common": 0.6, "edge_case": 0.3, "extreme": 0.1}


class ScenarioGenerationResponse(BaseModel):
    scenarios_generated: int
    scenario_ids: List[str]
    generation_batch: str
    edge_case_breakdown: Dict[str, int]

