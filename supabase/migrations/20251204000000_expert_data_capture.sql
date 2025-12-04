-- Expert Coach Data Capture System
-- Creates tables for synthetic scenario review and Bayesian prior generation

-- 1.1 Rule Review Sessions Table
CREATE TABLE IF NOT EXISTS rule_review_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_date DATE NOT NULL,
    session_name TEXT,
    participants TEXT[] NOT NULL,
    scenarios_reviewed INTEGER DEFAULT 0,
    rules_created INTEGER DEFAULT 0,
    rules_modified INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 1.2 Synthetic Scenarios Table
CREATE TABLE IF NOT EXISTS synthetic_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Scenario content
    baseline_snapshot JSONB NOT NULL,
    pre_session_snapshot JSONB NOT NULL,
    scenario_description TEXT,
    edge_case_tags TEXT[],
    difficulty_level TEXT CHECK (difficulty_level IN ('common', 'edge_case', 'extreme')),
    
    -- AI suggestion
    ai_recommendation JSONB,
    ai_reasoning TEXT,
    
    -- Review status
    status TEXT DEFAULT 'pending' CHECK (status IN 
        ('pending', 'in_review', 'consensus_reached', 'disputed', 'needs_discussion', 'archived')),
    assigned_reviewers TEXT[],
    
    -- Outcome
    consensus_recommendation JSONB,
    converted_to_rule_id UUID,
    
    -- Metadata
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generation_batch TEXT,
    reviewed_at TIMESTAMPTZ,
    review_session_id UUID REFERENCES rule_review_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_scenarios_status ON synthetic_scenarios (status);
CREATE INDEX IF NOT EXISTS idx_scenarios_tags ON synthetic_scenarios USING GIN (edge_case_tags);
CREATE INDEX IF NOT EXISTS idx_scenarios_review_session ON synthetic_scenarios (review_session_id);

-- 1.3 Expert Scenario Responses Table
CREATE TABLE IF NOT EXISTS expert_scenario_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID REFERENCES synthetic_scenarios(id) NOT NULL,
    expert_id TEXT NOT NULL,
    
    -- Outcome predictions
    predicted_quality_optimal DECIMAL CHECK (predicted_quality_optimal BETWEEN 1 AND 10),
    predicted_quality_baseline DECIMAL CHECK (predicted_quality_baseline BETWEEN 1 AND 10),
    prediction_confidence TEXT CHECK (prediction_confidence IN ('high', 'medium', 'low')),
    
    -- Session recommendation
    recommended_session_type TEXT CHECK (recommended_session_type IN 
        ('project', 'limit_bouldering', 'volume', 'technique', 'training', 
         'light_session', 'rest_day', 'active_recovery')),
    session_type_confidence TEXT CHECK (session_type_confidence IN ('high', 'medium', 'low')),
    
    -- Treatment recommendations
    treatment_recommendations JSONB NOT NULL DEFAULT '{}',
    
    -- Counterfactual judgments
    counterfactuals JSONB DEFAULT '[]',
    
    -- Key drivers
    key_drivers JSONB DEFAULT '[]',
    
    -- Interaction effects
    interaction_effects JSONB DEFAULT '[]',
    
    -- Session structure
    session_structure JSONB,
    
    -- Reasoning
    reasoning TEXT,
    agrees_with_ai TEXT CHECK (agrees_with_ai IN ('yes', 'partially', 'no')),
    
    -- Metadata
    response_duration_sec INTEGER,
    is_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(scenario_id, expert_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_scenario ON expert_scenario_responses (scenario_id);
CREATE INDEX IF NOT EXISTS idx_responses_expert ON expert_scenario_responses (expert_id);
CREATE INDEX IF NOT EXISTS idx_responses_complete ON expert_scenario_responses (is_complete);

-- 1.4 Scenario Consensus Table
CREATE TABLE IF NOT EXISTS scenario_consensus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID REFERENCES synthetic_scenarios(id) UNIQUE NOT NULL,
    
    -- Consensus outcomes
    consensus_quality_optimal DECIMAL,
    consensus_quality_baseline DECIMAL,
    consensus_session_type TEXT,
    consensus_treatments JSONB,
    
    -- Extracted coefficient signals
    coefficient_signals JSONB,
    
    -- Agreement metrics
    expert_agreement_score DECIMAL CHECK (expert_agreement_score BETWEEN 0 AND 1),
    n_experts INTEGER,
    disputed_factors TEXT[],
    
    -- Processing
    processed_into_priors BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consensus_processed ON scenario_consensus (processed_into_priors);

-- 1.5 Expert Rules Table
CREATE TABLE IF NOT EXISTS expert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    
    -- Rule logic
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    
    -- Indexing helpers
    condition_fields TEXT[],
    rule_category TEXT NOT NULL CHECK (rule_category IN 
        ('safety', 'interaction', 'edge_case', 'conservative', 'performance')),
    
    -- Priority and status
    priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
    confidence TEXT CHECK (confidence IN ('high', 'medium', 'low', 'experimental')),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Provenance
    source TEXT NOT NULL CHECK (source IN 
        ('literature', 'coach_consensus', 'ai_suggested', 'safety_protocol', 'manual')),
    evidence TEXT,
    contributors TEXT[],
    source_scenario_id UUID REFERENCES synthetic_scenarios(id),
    review_session_id UUID REFERENCES rule_review_sessions(id),
    
    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    expires_at TIMESTAMPTZ,
    superseded_by UUID REFERENCES expert_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_rules_conditions ON expert_rules USING GIN (conditions);
CREATE INDEX IF NOT EXISTS idx_rules_condition_fields ON expert_rules USING GIN (condition_fields);
CREATE INDEX IF NOT EXISTS idx_rules_category ON expert_rules (rule_category);
CREATE INDEX IF NOT EXISTS idx_rules_active_priority ON expert_rules (is_active, priority DESC);

-- 1.6 Rule Audit Log Table
CREATE TABLE IF NOT EXISTS rule_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES expert_rules(id),
    action TEXT NOT NULL CHECK (action IN 
        ('created', 'modified', 'activated', 'deactivated', 'superseded')),
    changed_by TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_rule ON rule_audit_log (rule_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON rule_audit_log (action);

-- 1.7 Row Level Security
ALTER TABLE rule_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_scenario_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_consensus ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (coaches and admins)
-- View policies
CREATE POLICY "Authenticated users can view review sessions" ON rule_review_sessions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view scenarios" ON synthetic_scenarios
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view responses" ON expert_scenario_responses
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view consensus" ON scenario_consensus
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view rules" ON expert_rules
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view audit log" ON rule_audit_log
    FOR SELECT USING (auth.role() = 'authenticated');

-- Insert policies
CREATE POLICY "Authenticated users can create review sessions" ON rule_review_sessions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert scenarios" ON synthetic_scenarios
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert responses" ON expert_scenario_responses
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert consensus" ON scenario_consensus
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create rules" ON expert_rules
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert audit logs" ON rule_audit_log
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Update policies
CREATE POLICY "Authenticated users can update review sessions" ON rule_review_sessions
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update scenarios" ON synthetic_scenarios
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Experts can update own responses" ON expert_scenario_responses
    FOR UPDATE USING (expert_id = auth.uid()::text);

CREATE POLICY "Authenticated users can update consensus" ON scenario_consensus
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update rules" ON expert_rules
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_expert_scenario_responses_updated_at ON expert_scenario_responses;
CREATE TRIGGER update_expert_scenario_responses_updated_at
    BEFORE UPDATE ON expert_scenario_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expert_rules_updated_at ON expert_rules;
CREATE TRIGGER update_expert_rules_updated_at
    BEFORE UPDATE ON expert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

