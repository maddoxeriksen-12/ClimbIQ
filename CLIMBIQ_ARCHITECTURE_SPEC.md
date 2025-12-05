# ClimbIQ Architecture Specification

> **Purpose**: This document defines the complete ClimbIQ system architecture. Use it to audit the codebase, identify gaps, and implement missing components. Every component described here should exist in the codebase.

---

## Quick Reference: The Three Data Paths

| Data Path | Source | Destination Table | Role |
|-----------|--------|-------------------|------|
| **Expert Rules** | Coach consensus on edge cases | `expert_rules` | BYPASS the model (hard overrides) |
| **Expert Scenarios** | Counterfactual judgments | `population_priors` | INITIALIZE the model (starting coefficients) |
| **Real Sessions** | User pre/post forms | `sessions` + `pre_session_data` + `post_session_data` | TRAIN the model (observed outcomes) |

**Critical**: Rules bypass. Scenarios initialize. Sessions train. These are fundamentally different purposes.

---

## Part 1: Database Schema

### 1.1 Expert Capture Tables

#### `synthetic_scenarios`
AI-generated edge cases for expert review.

```sql
CREATE TABLE synthetic_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baseline_snapshot JSONB NOT NULL,           -- Climber profile
    pre_session_snapshot JSONB NOT NULL,        -- Current conditions
    scenario_description TEXT,
    edge_case_tags TEXT[] DEFAULT '{}',         -- e.g., ['anxiety_stress', 'injury_combination']
    difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard', 'expert')),
    ai_recommendation JSONB,                    -- Claude's initial suggestion
    ai_reasoning TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'consensus_reached', 'disputed', 'needs_discussion', 'archived')),
    assigned_reviewers UUID[] DEFAULT '{}',
    consensus_recommendation JSONB,
    converted_to_rule_id UUID REFERENCES expert_rules(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generation_batch TEXT,
    reviewed_at TIMESTAMPTZ,
    review_session_id UUID REFERENCES rule_review_sessions(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_synthetic_scenarios_status ON synthetic_scenarios(status);
CREATE INDEX idx_synthetic_scenarios_edge_case_tags ON synthetic_scenarios USING GIN(edge_case_tags);
CREATE INDEX idx_synthetic_scenarios_review_session ON synthetic_scenarios(review_session_id);
```

#### `expert_scenario_responses`
Individual expert judgments on scenarios.

```sql
CREATE TABLE expert_scenario_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID NOT NULL REFERENCES synthetic_scenarios(id) ON DELETE CASCADE,
    expert_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Outcome predictions (CRITICAL for prior extraction)
    predicted_quality_optimal DECIMAL(3,1) CHECK (predicted_quality_optimal BETWEEN 1 AND 10),
    predicted_quality_baseline DECIMAL(3,1) CHECK (predicted_quality_baseline BETWEEN 1 AND 10),
    prediction_confidence TEXT CHECK (prediction_confidence IN ('high', 'medium', 'low')),
    
    -- Session recommendations
    recommended_session_type TEXT,
    session_type_confidence TEXT CHECK (session_type_confidence IN ('high', 'medium', 'low')),
    
    -- Treatment recommendations (structured)
    treatment_recommendations JSONB,
    /*
    Example structure:
    {
        "caffeine_mg": {"value": 200, "importance": "helpful"},
        "warmup_duration_min": {"value": 20, "importance": "critical"},
        "session_intensity": {"value": "moderate", "importance": "helpful"}
    }
    */
    
    -- Counterfactuals (GOLD for coefficient extraction)
    counterfactuals JSONB,
    /*
    Example structure:
    [
        {
            "variable": "sleep_hours",
            "actual_value": 5,
            "counterfactual_value": 7,
            "new_predicted_quality": 7.0,
            "would_change_session_type": false
        }
    ]
    */
    
    -- Key drivers (validates coefficient directions)
    key_drivers JSONB,
    /*
    Example structure:
    [
        {"rank": 1, "variable": "sleep_hours", "direction": "negative"},
        {"rank": 2, "variable": "stress_level", "direction": "negative"},
        {"rank": 3, "variable": "days_since_hard_session", "direction": "positive"}
    ]
    */
    
    -- Interaction effects
    interaction_effects JSONB,
    /*
    Example structure:
    [
        {
            "factor_a": "caffeine_mg",
            "factor_b": "performance_anxiety",
            "description": "High caffeine counterproductive with high anxiety",
            "recommendation_without_interaction": "200mg",
            "recommendation_with_interaction": "skip"
        }
    ]
    */
    
    -- Session structure (optional detailed workout plan)
    session_structure JSONB,
    
    -- Metadata
    reasoning TEXT,
    agrees_with_ai BOOLEAN,
    response_duration_sec INTEGER,
    is_complete BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(scenario_id, expert_id)
);

CREATE INDEX idx_expert_responses_scenario ON expert_scenario_responses(scenario_id);
CREATE INDEX idx_expert_responses_expert ON expert_scenario_responses(expert_id);
CREATE INDEX idx_expert_responses_complete ON expert_scenario_responses(is_complete);
```

#### `scenario_consensus`
Aggregated consensus with extracted coefficient signals.

```sql
CREATE TABLE scenario_consensus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID UNIQUE NOT NULL REFERENCES synthetic_scenarios(id) ON DELETE CASCADE,
    
    -- Consensus predictions
    consensus_quality_optimal DECIMAL(3,1),
    consensus_quality_baseline DECIMAL(3,1),
    consensus_session_type TEXT,
    consensus_treatments JSONB,
    
    -- Extracted coefficient signals (KEY OUTPUT)
    coefficient_signals JSONB,
    /*
    Example structure:
    {
        "sleep_hours": {
            "implied_effect": 0.85,
            "n_experts": 3,
            "std_dev": 0.15,
            "confidence": "high"
        },
        "caffeine_mg": {
            "implied_effect": 0.002,
            "n_experts": 3,
            "std_dev": 0.001,
            "confidence": "medium",
            "interaction_note": "Reversed for high-anxiety climbers"
        }
    }
    */
    
    -- Agreement metrics
    expert_agreement_score DECIMAL(3,2) CHECK (expert_agreement_score BETWEEN 0 AND 1),
    n_experts INTEGER,
    disputed_factors TEXT[] DEFAULT '{}',
    
    -- Processing status
    processed_into_priors BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scenario_consensus_processed ON scenario_consensus(processed_into_priors);
```

#### `expert_rules`
Hard override rules derived from expert consensus.

```sql
CREATE TABLE expert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    
    -- Rule logic
    conditions JSONB NOT NULL,
    /*
    Example structure:
    {
        "ALL": [
            {"field": "baseline.performance_anxiety", "op": ">=", "value": 7},
            {"field": "pre_session.stress_level", "op": ">=", "value": 4}
        ]
    }
    */
    
    actions JSONB NOT NULL,
    /*
    Example structure:
    [
        {"type": "override", "recommendation": "rest_day", "message": "High anxiety + stress requires rest"},
        {"type": "suppress", "target": "caffeine_recommendation"},
        {"type": "modify_coefficient", "target": "caffeine_mg", "multiplier": 0.5}
    ]
    */
    
    condition_fields TEXT[] DEFAULT '{}',  -- For indexing: ['baseline.performance_anxiety', 'pre_session.stress_level']
    
    -- Metadata
    rule_category TEXT CHECK (rule_category IN ('safety', 'interaction', 'edge_case', 'conservative', 'performance')),
    priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),  -- Higher = fires first
    confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Provenance
    source TEXT CHECK (source IN ('literature', 'coach_consensus', 'ai_suggested', 'safety_protocol', 'manual')),
    evidence TEXT,
    contributors UUID[] DEFAULT '{}',
    source_scenario_id UUID REFERENCES synthetic_scenarios(id),
    review_session_id UUID REFERENCES rule_review_sessions(id),
    
    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ,
    superseded_by UUID REFERENCES expert_rules(id)
);

CREATE INDEX idx_expert_rules_conditions ON expert_rules USING GIN(conditions);
CREATE INDEX idx_expert_rules_condition_fields ON expert_rules USING GIN(condition_fields);
CREATE INDEX idx_expert_rules_category ON expert_rules(rule_category);
CREATE INDEX idx_expert_rules_active_priority ON expert_rules(is_active, priority DESC);
```

#### `rule_review_sessions`
Audit trail for expert review sessions.

```sql
CREATE TABLE rule_review_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_date DATE NOT NULL,
    session_name TEXT,
    participants UUID[] DEFAULT '{}',
    scenarios_reviewed INTEGER DEFAULT 0,
    rules_created INTEGER DEFAULT 0,
    rules_modified INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

#### `rule_audit_log`
Tracks all rule changes.

```sql
CREATE TABLE rule_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES expert_rules(id),
    action TEXT NOT NULL CHECK (action IN ('created', 'modified', 'activated', 'deactivated', 'superseded')),
    changed_by UUID REFERENCES auth.users(id),
    previous_state JSONB,
    new_state JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rule_audit_log_rule ON rule_audit_log(rule_id);
```

### 1.2 User Data Tables

#### `baseline_assessments`
User baseline profiles with INDIVIDUAL COLUMNS (not JSONB).

```sql
CREATE TABLE baseline_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Demographics
    age INTEGER,
    sex TEXT CHECK (sex IN ('male', 'female', 'other', 'prefer_not_to_say')),
    height_cm DECIMAL(5,1),
    weight_kg DECIMAL(5,1),
    arm_span_cm DECIMAL(5,1),
    
    -- Climbing background
    years_climbing DECIMAL(3,1),
    current_boulder_grade TEXT,
    current_route_grade TEXT,
    peak_boulder_grade TEXT,
    peak_route_grade TEXT,
    primary_discipline TEXT CHECK (primary_discipline IN ('boulder', 'sport', 'trad', 'mixed')),
    sessions_per_week DECIMAL(3,1),
    
    -- Physical metrics
    max_hang_weight_kg DECIMAL(5,1),
    max_hang_edge_mm INTEGER,
    max_pullups INTEGER,
    
    -- Psychological profile
    performance_anxiety INTEGER CHECK (performance_anxiety BETWEEN 1 AND 10),
    competition_orientation INTEGER CHECK (competition_orientation BETWEEN 1 AND 10),
    process_vs_outcome INTEGER CHECK (process_vs_outcome BETWEEN 1 AND 10),  -- 1=outcome, 10=process
    
    -- Recovery profile
    typical_recovery_days DECIMAL(3,1),
    sleep_quality_typical INTEGER CHECK (sleep_quality_typical BETWEEN 1 AND 5),
    injury_history JSONB,  -- Exception: complex nested structure
    
    -- Training context
    has_coach BOOLEAN DEFAULT FALSE,
    has_hangboard BOOLEAN DEFAULT FALSE,
    has_home_wall BOOLEAN DEFAULT FALSE,
    gym_access TEXT CHECK (gym_access IN ('daily', 'several_times_week', 'weekly', 'limited')),
    
    is_current BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_baseline_user_current ON baseline_assessments(user_id, is_current);
```

#### `sessions`
Session records linking pre and post data.

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    session_date DATE NOT NULL,
    
    -- Timing
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_min INTEGER,
    
    -- Location
    gym_id UUID,  -- Optional FK to gyms table
    location_type TEXT CHECK (location_type IN ('indoor_gym', 'home_wall', 'outdoor')),
    
    -- Status
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_date ON sessions(user_id, session_date DESC);
```

#### `pre_session_data`
Pre-session form data with INDIVIDUAL COLUMNS.

```sql
CREATE TABLE pre_session_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Sleep
    sleep_hours DECIMAL(3,1),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
    sleep_notes TEXT,
    
    -- Energy & Recovery
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
    soreness_level INTEGER CHECK (soreness_level BETWEEN 1 AND 5),
    days_since_last_session INTEGER,
    days_since_hard_session INTEGER,
    
    -- Mental state
    stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 5),
    motivation_level INTEGER CHECK (motivation_level BETWEEN 1 AND 5),
    
    -- Current issues
    current_niggles JSONB,  -- Exception: array of {location, severity, notes}
    
    -- Planned treatments (what user INTENDS to do)
    planned_caffeine_mg INTEGER DEFAULT 0,
    planned_warmup_min INTEGER,
    planned_session_type TEXT,
    planned_intensity TEXT CHECK (planned_intensity IN ('max', 'high', 'moderate', 'low')),
    
    -- Session goals
    session_goal TEXT,
    specific_objectives TEXT[],
    
    -- Context
    time_of_day TEXT CHECK (time_of_day IN ('morning', 'midday', 'afternoon', 'evening')),
    time_available_min INTEGER,
    
    -- Recommendations received
    recommendations_shown JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `post_session_data`
Post-session form data with INDIVIDUAL COLUMNS including deviation tracking.

```sql
CREATE TABLE post_session_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Core outcome (THE KEY DEPENDENT VARIABLE)
    session_quality INTEGER CHECK (session_quality BETWEEN 1 AND 10),
    
    -- Secondary outcomes
    energy_post INTEGER CHECK (energy_post BETWEEN 1 AND 5),
    skin_condition INTEGER CHECK (skin_condition BETWEEN 1 AND 5),
    psyched_level INTEGER CHECK (psyched_level BETWEEN 1 AND 5),
    
    -- Accomplishments
    sends TEXT[],
    attempts_on_projects INTEGER,
    new_grades_tried BOOLEAN DEFAULT FALSE,
    
    -- DEVIATION TRACKING (Critical for accurate model training)
    deviated_from_plan BOOLEAN DEFAULT FALSE,
    actual_caffeine_mg INTEGER,           -- NULL if no deviation
    actual_session_type TEXT,             -- NULL if no deviation
    actual_duration_min INTEGER,          -- NULL if no deviation
    actual_warmup_min INTEGER,            -- NULL if no deviation
    actual_intensity TEXT,                -- NULL if no deviation
    deviation_reason TEXT,
    deviation_details JSONB,              -- Flexible for other changes
    
    -- Subjective notes
    what_went_well TEXT,
    what_could_improve TEXT,
    notes TEXT,
    
    -- Injury tracking
    new_niggles JSONB,  -- Any new issues that arose
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.3 Model Tables

#### `population_priors`
Blended literature + expert priors (starting coefficients).

```sql
CREATE TABLE population_priors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Coefficient name
    variable_name TEXT NOT NULL,
    
    -- Blended prior values
    population_mean DECIMAL(10,6) NOT NULL,
    population_std DECIMAL(10,6) NOT NULL,
    individual_variance DECIMAL(10,6),  -- Expected between-person variance
    
    -- Optimal ranges (for recommendations)
    optimal_min DECIMAL(10,2),
    optimal_max DECIMAL(10,2),
    
    -- Source tracking
    literature_mean DECIMAL(10,6),
    literature_std DECIMAL(10,6),
    literature_sources TEXT[],
    
    expert_mean DECIMAL(10,6),
    expert_std DECIMAL(10,6),
    expert_n_scenarios INTEGER,
    
    blend_weights JSONB,  -- {"literature": 0.4, "expert": 0.6}
    
    -- Metadata
    is_current BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(variable_name, is_current) -- Only one current prior per variable
);

CREATE INDEX idx_population_priors_current ON population_priors(is_current) WHERE is_current = TRUE;
```

#### `model_outputs`
Per-user trained coefficients.

```sql
CREATE TABLE model_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
    
    -- Trained coefficients
    coefficients JSONB NOT NULL,
    /*
    Example structure:
    {
        "intercept": 5.8,
        "sleep_hours": 0.42,
        "sleep_quality": 0.25,
        "stress_level": -0.35,
        "caffeine_mg": 0.005,
        "days_since_hard_session": 0.20,
        "warmup_duration_min": 0.02
    }
    */
    
    -- Confidence intervals (95%)
    confidence_intervals JSONB,
    /*
    Example structure:
    {
        "sleep_hours": [0.22, 0.62],
        "caffeine_mg": [0.002, 0.008]
    }
    */
    
    -- Model metadata
    sessions_included INTEGER NOT NULL DEFAULT 0,
    phase TEXT CHECK (phase IN ('cold_start', 'learning', 'personalized')),
    shrinkage_factor DECIMAL(4,3),  -- How much toward population (0=population, 1=personal)
    
    -- Training metadata
    last_trained_at TIMESTAMPTZ,
    model_version TEXT,
    training_duration_sec DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Part 2: Backend Services (FastAPI)

### 2.1 Required API Routers

Verify these routers exist in `app/api/v1/`:

```
app/api/v1/
├── expert_capture/
│   ├── __init__.py
│   ├── router.py           # Main router aggregating sub-routers
│   ├── scenarios.py        # Scenario generation and retrieval
│   ├── responses.py        # Expert response submission
│   ├── consensus.py        # Consensus calculation
│   ├── rules.py            # Rule CRUD operations
│   └── priors.py           # Prior extraction and management
├── recommendations/
│   ├── __init__.py
│   ├── router.py           # Main recommendation endpoints
│   ├── serving.py          # Real-time recommendation serving
│   └── streaming.py        # SSE streaming logic
├── sessions/
│   ├── __init__.py
│   ├── router.py
│   ├── pre_session.py      # Pre-session form handling
│   └── post_session.py     # Post-session form handling
└── users/
    ├── __init__.py
    ├── router.py
    └── baseline.py         # Baseline assessment handling
```

### 2.2 Recommendation Serving Endpoint

The critical endpoint that combines rules + model + NLG:

```python
# app/api/v1/recommendations/serving.py

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from typing import AsyncIterator
import json

router = APIRouter()

@router.post("/pre-session")
async def get_pre_session_recommendations(
    request: PreSessionRequest,
    supabase: Client = Depends(get_supabase),
    claude: Anthropic = Depends(get_claude)
) -> StreamingResponse:
    """
    Main recommendation endpoint with SSE streaming.
    
    Flow:
    1. Load user context (coefficients, baseline, history, population stats)
    2. Check expert rules (fire BEFORE model)
    3. If no rule override: compute model prediction + counterfactuals
    4. Compute statistical context (z-scores, percentiles, personal comparisons)
    5. Stream NLG explanations via Claude
    """
    
    async def event_stream() -> AsyncIterator[str]:
        # Phase 1: Load context (instant)
        context = await load_user_context(request.user_id, supabase)
        
        # Phase 2: Rule check (instant)
        rule_override = await check_rules(
            build_user_state(context, request.current_conditions),
            supabase
        )
        
        if rule_override:
            yield sse_event("rule_override", rule_override.dict())
            yield sse_event("done", {})
            return
        
        # Phase 3: Model prediction (instant)
        prediction = predict_quality(
            context.coefficients,
            request.current_conditions
        )
        
        yield sse_event("prediction", {
            "expected_quality": prediction.quality,
            "confidence_interval": prediction.ci_95
        })
        
        # Phase 4: Generate counterfactuals (instant)
        counterfactuals = generate_counterfactuals(
            context.coefficients,
            request.current_conditions,
            prediction.quality
        )
        
        yield sse_event("recommendations", {
            "items": [cf.dict() for cf in counterfactuals[:3]]
        })
        
        # Phase 5: Statistical context (instant)
        stats = compute_statistical_context(
            request.current_conditions,
            context.history,
            context.population_stats,
            context.coefficients
        )
        
        yield sse_event("stats", stats.dict())
        
        # Phase 6: Stream NLG (1-2 seconds)
        for i, rec in enumerate(counterfactuals[:3]):
            yield sse_event("nlg_start", {"index": i})
            
            async for chunk in generate_recommendation_nlg(
                rec, stats, context.profile, claude
            ):
                yield sse_event("nlg_chunk", {"index": i, "text": chunk})
            
            yield sse_event("nlg_complete", {"index": i})
        
        yield sse_event("done", {})
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )


def sse_event(event: str, data: dict) -> str:
    """Format as Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
```

### 2.3 Rule Engine

```python
# app/services/rule_engine.py

from typing import Dict, List, Optional
from app.models.rules import Rule, RuleOverride

class RuleEngine:
    """
    Evaluates expert rules against user state.
    Rules fire BEFORE the statistical model.
    """
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self._rules_cache = None
        self._cache_time = None
        self.cache_ttl = 300  # 5 minutes
    
    async def get_active_rules(self) -> List[Rule]:
        """Load active rules, sorted by priority (highest first)."""
        if self._should_refresh_cache():
            result = await self.supabase.table("expert_rules") \
                .select("*") \
                .eq("is_active", True) \
                .order("priority", desc=True) \
                .execute()
            self._rules_cache = [Rule(**r) for r in result.data]
            self._cache_time = time.time()
        return self._rules_cache
    
    async def check_rules(self, user_state: Dict) -> Optional[RuleOverride]:
        """
        Check all rules against user state.
        Returns first matching rule override, or None.
        """
        rules = await self.get_active_rules()
        
        for rule in rules:
            if self._evaluate_conditions(rule.conditions, user_state):
                return RuleOverride(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    actions=rule.actions,
                    message=self._build_message(rule, user_state),
                    source="expert_rule"
                )
        
        return None
    
    def _evaluate_conditions(self, conditions: Dict, state: Dict) -> bool:
        """
        Evaluate rule conditions against state.
        
        Supports:
        - "ALL": [...] - All conditions must match
        - "ANY": [...] - At least one must match
        - {"field": "...", "op": "...", "value": ...}
        """
        if "ALL" in conditions:
            return all(
                self._evaluate_single(c, state) 
                for c in conditions["ALL"]
            )
        elif "ANY" in conditions:
            return any(
                self._evaluate_single(c, state) 
                for c in conditions["ANY"]
            )
        else:
            return self._evaluate_single(conditions, state)
    
    def _evaluate_single(self, condition: Dict, state: Dict) -> bool:
        """Evaluate a single condition."""
        field = condition["field"]
        op = condition["op"]
        value = condition["value"]
        
        # Navigate nested fields (e.g., "baseline.performance_anxiety")
        actual = self._get_nested_value(state, field)
        if actual is None:
            return False
        
        if op == ">=":
            return actual >= value
        elif op == "<=":
            return actual <= value
        elif op == ">":
            return actual > value
        elif op == "<":
            return actual < value
        elif op == "==":
            return actual == value
        elif op == "!=":
            return actual != value
        elif op == "in":
            return actual in value
        elif op == "contains":
            return value in actual
        else:
            raise ValueError(f"Unknown operator: {op}")
```

### 2.4 Prior Extraction Pipeline

```python
# app/services/prior_extraction.py

from typing import Dict, List
import numpy as np
from scipy import stats

class PriorExtractor:
    """
    Extracts coefficient priors from expert scenario responses.
    """
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.confidence_weights = {
            "high": 1.0,
            "medium": 0.7,
            "low": 0.4
        }
    
    async def extract_coefficient_signals(self, scenario_id: str) -> Dict:
        """
        Extract implied coefficients from expert counterfactual judgments.
        
        For each counterfactual:
            quality_change = new_predicted - baseline_predicted
            value_change = counterfactual_value - actual_value
            implied_effect = quality_change / value_change
        """
        # Load all expert responses for this scenario
        responses = await self.supabase.table("expert_scenario_responses") \
            .select("*") \
            .eq("scenario_id", scenario_id) \
            .eq("is_complete", True) \
            .execute()
        
        coefficient_signals = {}
        
        for response in responses.data:
            baseline_quality = response["predicted_quality_baseline"]
            confidence = response["prediction_confidence"]
            weight = self.confidence_weights.get(confidence, 0.5)
            
            for cf in response.get("counterfactuals", []):
                variable = cf["variable"]
                actual = cf["actual_value"]
                counterfactual = cf["counterfactual_value"]
                new_quality = cf["new_predicted_quality"]
                
                # Calculate implied effect
                quality_change = new_quality - baseline_quality
                value_change = counterfactual - actual
                
                if value_change != 0:
                    implied_effect = quality_change / value_change
                    
                    if variable not in coefficient_signals:
                        coefficient_signals[variable] = []
                    
                    coefficient_signals[variable].append({
                        "effect": implied_effect,
                        "weight": weight,
                        "expert_id": response["expert_id"]
                    })
        
        # Aggregate per variable
        aggregated = {}
        for variable, signals in coefficient_signals.items():
            effects = np.array([s["effect"] for s in signals])
            weights = np.array([s["weight"] for s in signals])
            
            weighted_mean = np.average(effects, weights=weights)
            weighted_var = np.average((effects - weighted_mean) ** 2, weights=weights)
            weighted_std = np.sqrt(weighted_var)
            
            aggregated[variable] = {
                "implied_effect": float(weighted_mean),
                "std_dev": float(weighted_std),
                "n_experts": len(set(s["expert_id"] for s in signals)),
                "confidence": self._determine_confidence(len(signals), weighted_std)
            }
        
        return aggregated
    
    async def build_expert_derived_priors(self) -> Dict:
        """
        Aggregate coefficient signals across all scenarios using
        inverse-variance weighted meta-analysis.
        """
        # Get all unprocessed consensus records
        consensus_records = await self.supabase.table("scenario_consensus") \
            .select("*") \
            .eq("processed_into_priors", False) \
            .execute()
        
        # Collect all signals by variable
        all_signals = {}
        for record in consensus_records.data:
            for variable, signal in record.get("coefficient_signals", {}).items():
                if variable not in all_signals:
                    all_signals[variable] = []
                all_signals[variable].append(signal)
        
        # Meta-analysis per variable
        expert_priors = {}
        for variable, signals in all_signals.items():
            effects = np.array([s["implied_effect"] for s in signals])
            variances = np.array([s["std_dev"] ** 2 for s in signals])
            
            # Inverse-variance weighting
            weights = 1 / variances
            pooled_mean = np.sum(weights * effects) / np.sum(weights)
            pooled_var = 1 / np.sum(weights)
            pooled_std = np.sqrt(pooled_var)
            
            # Estimate between-scenario heterogeneity (for individual variance)
            heterogeneity = np.var(effects)
            
            expert_priors[variable] = {
                "population_mean": float(pooled_mean),
                "population_std": float(pooled_std),
                "individual_variance": float(heterogeneity),
                "n_scenarios": len(signals),
                "n_experts": sum(s["n_experts"] for s in signals)
            }
        
        return expert_priors
    
    async def create_blended_priors(
        self,
        literature_priors: Dict,
        expert_priors: Dict
    ) -> Dict:
        """
        Blend literature and expert priors using inverse-variance weighting.
        """
        blended = {}
        all_variables = set(literature_priors.keys()) | set(expert_priors.keys())
        
        for variable in all_variables:
            lit = literature_priors.get(variable)
            exp = expert_priors.get(variable)
            
            if lit and exp:
                # Inverse-variance weighted combination
                lit_weight = 1 / (lit["population_std"] ** 2)
                exp_weight = 1 / (exp["population_std"] ** 2)
                total_weight = lit_weight + exp_weight
                
                blended_mean = (
                    lit["population_mean"] * lit_weight +
                    exp["population_mean"] * exp_weight
                ) / total_weight
                
                blended_std = np.sqrt(1 / total_weight)
                
                # Conservative individual variance
                individual_var = max(
                    lit.get("individual_variance", 0.1),
                    exp.get("individual_variance", 0.1)
                )
                
                blended[variable] = {
                    "population_mean": float(blended_mean),
                    "population_std": float(blended_std),
                    "individual_variance": float(individual_var),
                    "blend_weights": {
                        "literature": lit_weight / total_weight,
                        "expert": exp_weight / total_weight
                    },
                    "literature_mean": lit["population_mean"],
                    "expert_mean": exp["population_mean"]
                }
            
            elif lit:
                # Literature only
                blended[variable] = {
                    **lit,
                    "blend_weights": {"literature": 1.0, "expert": 0.0}
                }
            
            elif exp:
                # Expert only - widen uncertainty
                blended[variable] = {
                    "population_mean": exp["population_mean"],
                    "population_std": exp["population_std"] * 1.5,  # Widen
                    "individual_variance": exp["individual_variance"],
                    "blend_weights": {"literature": 0.0, "expert": 1.0}
                }
        
        return blended
```

### 2.5 Statistical Context Computation

```python
# app/services/statistical_context.py

from typing import Dict, List
from scipy import stats
import numpy as np

def compute_statistical_context(
    current_conditions: Dict,
    user_history: List[Dict],
    population_stats: Dict,
    user_coefficients: Dict
) -> StatisticalContext:
    """
    Compute comparison metrics for recommendations.
    
    Returns:
    - Population comparisons (z-scores, percentiles)
    - Personal history comparisons
    - Coefficient comparisons
    """
    context = {}
    
    # --- POPULATION COMPARISONS ---
    for variable in ["sleep_hours", "stress_level", "energy_level"]:
        if variable in current_conditions and variable in population_stats:
            pop = population_stats[variable]
            user_value = current_conditions[variable]
            
            z_score = (user_value - pop["mean"]) / pop["std"]
            percentile = stats.norm.cdf(z_score) * 100
            
            context[f"{variable}_population"] = {
                "user_value": user_value,
                "pop_mean": pop["mean"],
                "pop_std": pop["std"],
                "z_score": float(z_score),
                "percentile": float(percentile),
                "descriptor": get_descriptor(z_score)
            }
    
    # --- COEFFICIENT COMPARISONS ---
    for coef_name in ["caffeine_mg", "sleep_hours", "stress_level"]:
        if coef_name in user_coefficients and coef_name in population_stats:
            user_coef = user_coefficients[coef_name]
            pop_coef = population_stats[f"{coef_name}_coefficient"]
            
            z_score = (user_coef - pop_coef["mean"]) / pop_coef["std"]
            percentile = stats.norm.cdf(z_score) * 100
            
            context[f"{coef_name}_response"] = {
                "user_coefficient": user_coef,
                "pop_mean": pop_coef["mean"],
                "percentile": float(percentile),
                "descriptor": f"You respond {'more' if z_score > 0 else 'less'} strongly than average"
            }
    
    # --- PERSONAL HISTORY COMPARISONS ---
    if user_history:
        # High stress sessions
        high_stress_sessions = [
            s for s in user_history 
            if s.get("pre_session_data", {}).get("stress_level", 0) >= 4
        ]
        
        if high_stress_sessions:
            project_sessions = [
                s for s in high_stress_sessions
                if s.get("pre_session_data", {}).get("planned_session_type") == "project"
            ]
            volume_sessions = [
                s for s in high_stress_sessions
                if s.get("pre_session_data", {}).get("planned_session_type") == "volume"
            ]
            
            context["personal_high_stress"] = {
                "n_sessions": len(high_stress_sessions),
                "avg_quality_project": np.mean([
                    s["post_session_data"]["session_quality"] 
                    for s in project_sessions
                ]) if project_sessions else None,
                "avg_quality_volume": np.mean([
                    s["post_session_data"]["session_quality"] 
                    for s in volume_sessions
                ]) if volume_sessions else None,
                "n_project": len(project_sessions),
                "n_volume": len(volume_sessions)
            }
        
        # Caffeine comparison
        high_caffeine = [
            s for s in user_history
            if s.get("pre_session_data", {}).get("planned_caffeine_mg", 0) >= 200
        ]
        low_caffeine = [
            s for s in user_history
            if s.get("pre_session_data", {}).get("planned_caffeine_mg", 0) < 50
        ]
        
        if high_caffeine and low_caffeine:
            context["personal_caffeine"] = {
                "high_caffeine_avg": np.mean([
                    s["post_session_data"]["session_quality"]
                    for s in high_caffeine
                ]),
                "low_caffeine_avg": np.mean([
                    s["post_session_data"]["session_quality"]
                    for s in low_caffeine
                ]),
                "n_high": len(high_caffeine),
                "n_low": len(low_caffeine)
            }
    
    return StatisticalContext(**context)


def get_descriptor(z_score: float) -> str:
    """Convert z-score to human-readable descriptor."""
    if z_score >= 2.0:
        return "very high"
    elif z_score >= 1.0:
        return "above average"
    elif z_score >= -1.0:
        return "typical"
    elif z_score >= -2.0:
        return "below average"
    else:
        return "very low"
```

---

## Part 3: Dagster Pipeline

### 3.1 Required Assets

```python
# dagster/assets/expert_capture.py

from dagster import asset, AssetExecutionContext
import pandas as pd

@asset(group_name="expert_capture")
def extracted_coefficient_signals(
    context: AssetExecutionContext,
    supabase: SupabaseResource
) -> pd.DataFrame:
    """
    Process unprocessed consensus records and extract coefficient signals.
    """
    extractor = PriorExtractor(supabase.client)
    
    # Get unprocessed consensus records
    unprocessed = supabase.client.table("scenario_consensus") \
        .select("id, scenario_id") \
        .eq("processed_into_priors", False) \
        .execute()
    
    all_signals = []
    for record in unprocessed.data:
        signals = extractor.extract_coefficient_signals(record["scenario_id"])
        
        # Update consensus record with signals
        supabase.client.table("scenario_consensus") \
            .update({"coefficient_signals": signals}) \
            .eq("id", record["id"]) \
            .execute()
        
        for variable, signal in signals.items():
            all_signals.append({
                "scenario_id": record["scenario_id"],
                "variable": variable,
                **signal
            })
    
    context.log.info(f"Extracted signals from {len(unprocessed.data)} scenarios")
    return pd.DataFrame(all_signals)


@asset(group_name="expert_capture", deps=["extracted_coefficient_signals"])
def expert_derived_priors(
    context: AssetExecutionContext,
    supabase: SupabaseResource
) -> dict:
    """
    Aggregate coefficient signals using inverse-variance weighted meta-analysis.
    """
    extractor = PriorExtractor(supabase.client)
    priors = extractor.build_expert_derived_priors()
    
    context.log.info(f"Derived priors for {len(priors)} variables")
    return priors


@asset(group_name="expert_capture", deps=["expert_derived_priors"])
def blended_population_priors(
    context: AssetExecutionContext,
    expert_derived_priors: dict,
    supabase: SupabaseResource
) -> dict:
    """
    Combine expert and literature priors, write to population_priors table.
    """
    extractor = PriorExtractor(supabase.client)
    
    # Load literature priors from config
    from app.config.literature_priors import LITERATURE_PRIORS
    
    blended = extractor.create_blended_priors(LITERATURE_PRIORS, expert_derived_priors)
    
    # Mark old priors as not current
    supabase.client.table("population_priors") \
        .update({"is_current": False}) \
        .eq("is_current", True) \
        .execute()
    
    # Insert new priors
    for variable, prior in blended.items():
        supabase.client.table("population_priors").insert({
            "variable_name": variable,
            "population_mean": prior["population_mean"],
            "population_std": prior["population_std"],
            "individual_variance": prior.get("individual_variance"),
            "literature_mean": prior.get("literature_mean"),
            "expert_mean": prior.get("expert_mean"),
            "blend_weights": prior.get("blend_weights"),
            "is_current": True
        }).execute()
    
    # Mark consensus records as processed
    supabase.client.table("scenario_consensus") \
        .update({"processed_into_priors": True, "processed_at": "now()"}) \
        .eq("processed_into_priors", False) \
        .execute()
    
    context.log.info(f"Wrote {len(blended)} blended priors to database")
    return blended
```

### 3.2 Nightly Training Job

```python
# dagster/assets/model_training.py

from dagster import asset, AssetExecutionContext
import pymc as pm
import numpy as np

@asset(group_name="model_training")
def training_data(
    context: AssetExecutionContext,
    supabase: SupabaseResource
) -> pd.DataFrame:
    """
    Load all sessions with pre/post data for training.
    Uses ACTUAL values when deviations are reported.
    """
    result = supabase.client.table("sessions") \
        .select("""
            id, user_id,
            pre_session_data(*),
            post_session_data(*)
        """) \
        .eq("status", "completed") \
        .not_.is_("post_session_data", "null") \
        .execute()
    
    rows = []
    for session in result.data:
        pre = session["pre_session_data"]
        post = session["post_session_data"]
        
        if not post or not post.get("session_quality"):
            continue
        
        # Use ACTUAL values when deviations reported
        caffeine = (
            post.get("actual_caffeine_mg") 
            if post.get("deviated_from_plan") and post.get("actual_caffeine_mg") is not None
            else pre.get("planned_caffeine_mg", 0)
        )
        
        session_type = (
            post.get("actual_session_type")
            if post.get("deviated_from_plan") and post.get("actual_session_type")
            else pre.get("planned_session_type")
        )
        
        rows.append({
            "session_id": session["id"],
            "user_id": session["user_id"],
            "session_quality": post["session_quality"],
            "sleep_hours": pre.get("sleep_hours"),
            "sleep_quality": pre.get("sleep_quality"),
            "stress_level": pre.get("stress_level"),
            "energy_level": pre.get("energy_level"),
            "days_since_hard_session": pre.get("days_since_hard_session"),
            "caffeine_mg": caffeine,
            "warmup_duration_min": pre.get("planned_warmup_min"),
            "session_type": session_type,
            "deviated": post.get("deviated_from_plan", False)
        })
    
    df = pd.DataFrame(rows)
    context.log.info(f"Loaded {len(df)} sessions for training")
    return df


@asset(group_name="model_training", deps=["training_data", "blended_population_priors"])
def trained_model(
    context: AssetExecutionContext,
    training_data: pd.DataFrame,
    supabase: SupabaseResource
) -> dict:
    """
    Train hierarchical Bayesian model using PyMC.
    
    Prior (from expert scenarios) × Likelihood (from real sessions) = Posterior
    """
    # Load current priors
    priors_result = supabase.client.table("population_priors") \
        .select("*") \
        .eq("is_current", True) \
        .execute()
    
    priors = {p["variable_name"]: p for p in priors_result.data}
    
    # Prepare data
    df = training_data.dropna(subset=["session_quality"])
    
    user_ids = df["user_id"].unique()
    user_idx = pd.Categorical(df["user_id"]).codes
    n_users = len(user_ids)
    
    # Treatment columns
    treatment_cols = [
        "sleep_hours", "sleep_quality", "stress_level", 
        "energy_level", "caffeine_mg", "days_since_hard_session"
    ]
    
    treatments = df[treatment_cols].fillna(0).values
    outcomes = df["session_quality"].values
    
    with pm.Model() as model:
        # Population-level priors (FROM EXPERT SCENARIOS)
        beta_pop = []
        sigma_user = []
        
        for i, col in enumerate(treatment_cols):
            prior = priors.get(col, {"population_mean": 0, "population_std": 0.5, "individual_variance": 0.2})
            
            beta_pop.append(pm.Normal(
                f"beta_pop_{col}",
                mu=prior["population_mean"],
                sigma=prior["population_std"]
            ))
            
            sigma_user.append(pm.HalfNormal(
                f"sigma_user_{col}",
                sigma=prior.get("individual_variance", 0.2)
            ))
        
        beta_pop = pm.math.stack(beta_pop)
        sigma_user = pm.math.stack(sigma_user)
        
        # User-level random effects (partial pooling)
        user_offset = pm.Normal(
            "user_offset",
            mu=0,
            sigma=sigma_user,
            shape=(n_users, len(treatment_cols))
        )
        
        # Each user's coefficient = population + personal offset
        user_beta = beta_pop + user_offset[user_idx]
        
        # Intercept
        intercept = pm.Normal("intercept", mu=5.0, sigma=1.0)
        
        # Linear predictor
        mu = intercept + (user_beta * treatments).sum(axis=1)
        
        # Observation noise
        sigma_obs = pm.HalfNormal("sigma_obs", sigma=1.0)
        
        # Likelihood (FROM REAL SESSIONS)
        y = pm.Normal("y", mu=mu, sigma=sigma_obs, observed=outcomes)
        
        # Sample
        trace = pm.sample(1000, cores=4, return_inferencedata=True)
    
    # Extract posteriors and save to model_outputs
    for i, user_id in enumerate(user_ids):
        user_beta_samples = (
            trace.posterior["beta_pop"].values + 
            trace.posterior["user_offset"].values[:, :, i, :]
        )
        
        coefficients = {}
        confidence_intervals = {}
        
        for j, col in enumerate(treatment_cols):
            samples = user_beta_samples[:, :, j].flatten()
            coefficients[col] = float(np.mean(samples))
            confidence_intervals[col] = [
                float(np.percentile(samples, 2.5)),
                float(np.percentile(samples, 97.5))
            ]
        
        # Add intercept
        intercept_samples = trace.posterior["intercept"].values.flatten()
        coefficients["intercept"] = float(np.mean(intercept_samples))
        
        n_sessions = len(df[df["user_id"] == user_id])
        phase = (
            "cold_start" if n_sessions < 10
            else "learning" if n_sessions < 30
            else "personalized"
        )
        
        # Calculate shrinkage factor
        user_var = np.var(user_beta_samples)
        pop_var = np.var(trace.posterior["beta_pop"].values)
        shrinkage = user_var / (user_var + pop_var) if (user_var + pop_var) > 0 else 0.5
        
        supabase.client.table("model_outputs").upsert({
            "user_id": user_id,
            "coefficients": coefficients,
            "confidence_intervals": confidence_intervals,
            "sessions_included": n_sessions,
            "phase": phase,
            "shrinkage_factor": float(shrinkage),
            "last_trained_at": "now()",
            "model_version": "hierarchical_v1"
        }).execute()
    
    context.log.info(f"Trained model for {n_users} users")
    return {"n_users": n_users, "n_sessions": len(df)}
```

### 3.3 Sensors

```python
# dagster/sensors.py

from dagster import sensor, RunRequest, SkipReason

@sensor(job=prior_extraction_job, minimum_interval_seconds=3600)
def new_consensus_sensor(context, supabase: SupabaseResource):
    """
    Trigger prior extraction when 5+ new consensus records exist.
    """
    result = supabase.client.table("scenario_consensus") \
        .select("id", count="exact") \
        .eq("processed_into_priors", False) \
        .execute()
    
    unprocessed_count = result.count
    
    if unprocessed_count >= 5:
        return RunRequest(
            run_key=f"prior_extraction_{datetime.now().isoformat()}"
        )
    else:
        return SkipReason(f"Only {unprocessed_count} unprocessed consensus records")


@sensor(job=nightly_training_job)
def nightly_training_sensor(context):
    """
    Trigger training job at 2 AM daily.
    """
    now = datetime.now()
    if now.hour == 2 and now.minute < 15:
        return RunRequest(
            run_key=f"nightly_training_{now.date().isoformat()}"
        )
    return SkipReason("Not training time")
```

---

## Part 4: Configuration Files

### 4.1 Literature Priors

```python
# app/config/literature_priors.py

LITERATURE_PRIORS = {
    "sleep_hours": {
        "population_mean": 0.15,
        "population_std": 0.08,
        "individual_variance": 0.10,
        "optimal_range": [7, 9],
        "sources": ["Walker 2017", "Simpson 2017"]
    },
    "sleep_quality": {
        "population_mean": 0.40,
        "population_std": 0.15,
        "individual_variance": 0.15,
        "sources": ["Vitale 2019"]
    },
    "days_since_hard_session": {
        "population_mean": 0.30,
        "population_std": 0.12,
        "individual_variance": 0.20,
        "optimal_range": [2, 4],
        "sources": ["Levernier 2020"]
    },
    "caffeine_mg": {
        "population_mean": 0.003,
        "population_std": 0.002,
        "individual_variance": 0.004,
        "optimal_range": [100, 300],
        "sources": ["Grgic 2020"]
    },
    "stress_level": {
        "population_mean": -0.35,
        "population_std": 0.15,
        "individual_variance": 0.20,
        "sources": ["Nieuwenhuys 2012"]
    },
    "energy_level": {
        "population_mean": 0.45,
        "population_std": 0.20,
        "individual_variance": 0.25,
        "sources": ["Estimated"]
    },
    "warmup_duration_min": {
        "population_mean": 0.025,
        "population_std": 0.015,
        "individual_variance": 0.02,
        "optimal_range": [15, 30],
        "sources": ["España-Romero 2009"]
    },
    "soreness_level": {
        "population_mean": -0.20,
        "population_std": 0.10,
        "individual_variance": 0.15,
        "sources": ["Estimated"]
    }
}
```

### 4.2 Edge Case Dimensions

```python
# app/config/edge_cases.py

EDGE_CASE_DIMENSIONS = {
    "anxiety_stress": [
        {"performance_anxiety": 9, "stress_level": 5},
        {"performance_anxiety": 8, "stress_level": 4, "sleep_hours": 4},
        {"performance_anxiety": 7, "motivation_level": 5, "session_goal": "project"}
    ],
    "injury_combinations": [
        {"current_niggles": [{"location": "finger", "severity": 2}], "days_since_hard_session": 1},
        {"current_niggles": [{"location": "shoulder", "severity": 1}], "session_goal": "steep_project"},
        {"current_niggles": [{"location": "elbow", "severity": 3}], "planned_session_type": "hangboard"}
    ],
    "recovery_extremes": [
        {"days_since_hard_session": 0, "sleep_hours": 9},
        {"days_since_hard_session": 7, "sleep_hours": 5},
        {"days_since_hard_session": 1, "soreness_level": 4}
    ],
    "demographic_edge_cases": [
        {"age": 55, "years_climbing": 2, "days_since_hard_session": 2},
        {"age": 18, "years_climbing": 10, "performance_anxiety": 8},
        {"age": 45, "sessions_per_week": 5, "sleep_hours": 5}
    ],
    "contradictory_signals": [
        {"sleep_hours": 9, "sleep_quality": 1},
        {"stress_level": 5, "motivation_level": 5},
        {"caffeine_mg": 400, "performance_anxiety": 9},
        {"energy_level": 5, "soreness_level": 4}
    ],
    "time_constraints": [
        {"time_available_min": 45, "session_goal": "project"},
        {"time_available_min": 30, "planned_warmup_min": 25}
    ]
}
```

---

## Part 5: Audit Checklist

Use this checklist to verify your codebase implements the architecture:

### Database

- [ ] All tables from Part 1 exist with correct columns
- [ ] Indexes are created for frequently queried columns
- [ ] RLS policies are enabled and configured
- [ ] Foreign key relationships are correct
- [ ] `deviated_from_plan` and `actual_*` columns exist in `post_session_data`

### Backend Services

- [ ] `RuleEngine` class exists and caches rules
- [ ] `RuleEngine.check_rules()` evaluates conditions correctly
- [ ] `PriorExtractor` class exists with all three methods
- [ ] `compute_statistical_context()` computes z-scores and personal comparisons
- [ ] Recommendation endpoint streams via SSE
- [ ] Rules are checked BEFORE model prediction
- [ ] Deviation values are used when training (actual vs planned)

### Dagster Pipeline

- [ ] `extracted_coefficient_signals` asset exists
- [ ] `expert_derived_priors` asset exists
- [ ] `blended_population_priors` asset writes to `population_priors`
- [ ] `training_data` asset uses actual values when deviations reported
- [ ] `trained_model` asset implements hierarchical Bayesian model
- [ ] Sensors trigger appropriately

### Configuration

- [ ] `LITERATURE_PRIORS` dictionary exists with all variables
- [ ] `EDGE_CASE_DIMENSIONS` dictionary exists for scenario generation
- [ ] Confidence weights defined: `{"high": 1.0, "medium": 0.7, "low": 0.4}`

### API Endpoints

- [ ] `POST /api/v1/recommendations/pre-session` — Main recommendation endpoint
- [ ] `POST /api/v1/expert-capture/scenarios/generate` — Generate synthetic scenarios
- [ ] `POST /api/v1/expert-capture/responses` — Submit expert response
- [ ] `POST /api/v1/expert-capture/scenarios/{id}/consensus` — Calculate consensus
- [ ] `POST /api/v1/expert-capture/rules` — Create rule
- [ ] `GET /api/v1/expert-capture/priors/current` — Get current blended priors

---

## Part 6: Common Issues to Check

### 1. Rules Not Firing Before Model
```python
# WRONG: Model runs first
prediction = predict_quality(...)
rules = check_rules(...)  # Too late!

# CORRECT: Rules first
rule_override = await check_rules(user_state, supabase)
if rule_override:
    return rule_override  # Skip model entirely
prediction = predict_quality(...)
```

### 2. Using Planned Instead of Actual Values
```python
# WRONG: Always uses planned
caffeine = pre_session_data["planned_caffeine_mg"]

# CORRECT: Uses actual if deviated
caffeine = (
    post_session_data.get("actual_caffeine_mg")
    if post_session_data.get("deviated_from_plan") 
       and post_session_data.get("actual_caffeine_mg") is not None
    else pre_session_data.get("planned_caffeine_mg", 0)
)
```

### 3. Missing Coefficient Signal Extraction
```python
# Counterfactual provides coefficient estimate
quality_change = new_predicted - baseline_predicted
value_change = counterfactual_value - actual_value
implied_effect = quality_change / value_change  # THIS IS THE COEFFICIENT
```

### 4. Not Using Priors in Model
```python
# WRONG: Uninformative priors
beta = pm.Normal("beta", mu=0, sigma=10)

# CORRECT: Expert-derived priors
prior = priors.get(variable)
beta = pm.Normal("beta", 
    mu=prior["population_mean"],    # From expert scenarios
    sigma=prior["population_std"]   # From expert uncertainty
)
```

### 5. Missing Partial Pooling
```python
# WRONG: Completely independent users
user_beta = pm.Normal("user_beta", mu=0, sigma=1, shape=n_users)

# CORRECT: Hierarchical with partial pooling
beta_pop = pm.Normal("beta_pop", mu=prior_mean, sigma=prior_std)
sigma_user = pm.HalfNormal("sigma_user", sigma=individual_variance)
user_offset = pm.Normal("user_offset", mu=0, sigma=sigma_user, shape=n_users)
user_beta = beta_pop + user_offset  # Population + personal deviation
```

---

## Summary: The Key Equations

### Prior Extraction (from expert counterfactuals)
```
implied_coefficient = (quality_if_changed - quality_baseline) / (value_changed - value_original)
```

### Prior Blending (literature + expert)
```
blended_mean = (lit_mean/lit_var + exp_mean/exp_var) / (1/lit_var + 1/exp_var)
blended_std = sqrt(1 / (1/lit_var + 1/exp_var))
```

### Bayesian Update (priors + real data)
```
Prior(from experts) × Likelihood(from sessions) = Posterior(personalized coefficients)
```

### User Phase Determination
```
cold_start:    sessions < 10  → heavy reliance on population priors
learning:      10 ≤ sessions < 30 → partial pooling, coefficients shifting
personalized:  sessions ≥ 30 → individual effects dominate
```

---

**Use this document to audit your codebase, identify gaps, and implement missing components. Every component described should exist and function as specified.**
