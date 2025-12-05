-- ============================================================================
-- ARCHITECTURE ALIGNMENT MIGRATION
-- ============================================================================
-- This migration aligns the database with the ClimbIQ Architecture Spec.
-- Adds baseline_assessments, model_outputs, and deviation tracking.
-- ============================================================================

-- ============================================================================
-- 1. BASELINE ASSESSMENTS TABLE
-- ============================================================================
-- Stores user baseline profiles with INDIVIDUAL COLUMNS (not JSONB)

CREATE TABLE IF NOT EXISTS baseline_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
    injury_history JSONB DEFAULT '[]',  -- Complex nested structure
    
    -- Training context
    has_coach BOOLEAN DEFAULT FALSE,
    has_hangboard BOOLEAN DEFAULT FALSE,
    has_home_wall BOOLEAN DEFAULT FALSE,
    gym_access TEXT CHECK (gym_access IN ('daily', 'several_times_week', 'weekly', 'limited')),
    
    -- Status
    is_current BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_baseline_user_current ON baseline_assessments(user_id, is_current);
CREATE INDEX IF NOT EXISTS idx_baseline_user_id ON baseline_assessments(user_id);

-- RLS
ALTER TABLE baseline_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own baseline" ON baseline_assessments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own baseline" ON baseline_assessments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own baseline" ON baseline_assessments
    FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_baseline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_baseline_timestamp ON baseline_assessments;
CREATE TRIGGER update_baseline_timestamp
    BEFORE UPDATE ON baseline_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_baseline_updated_at();


-- ============================================================================
-- 2. MODEL OUTPUTS TABLE
-- ============================================================================
-- Per-user trained coefficients from hierarchical Bayesian model

CREATE TABLE IF NOT EXISTS model_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Trained coefficients
    coefficients JSONB NOT NULL DEFAULT '{}',
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
    confidence_intervals JSONB DEFAULT '{}',
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_model_outputs_user ON model_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_model_outputs_phase ON model_outputs(phase);
CREATE INDEX IF NOT EXISTS idx_model_outputs_last_trained ON model_outputs(last_trained_at);

-- RLS
ALTER TABLE model_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own model" ON model_outputs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage models" ON model_outputs
    FOR ALL USING (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_model_outputs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_model_outputs_timestamp ON model_outputs;
CREATE TRIGGER update_model_outputs_timestamp
    BEFORE UPDATE ON model_outputs
    FOR EACH ROW
    EXECUTE FUNCTION update_model_outputs_updated_at();


-- ============================================================================
-- 3. DEVIATION TRACKING COLUMNS FOR CLIMBING_SESSIONS
-- ============================================================================
-- Add columns to track when actual session differs from planned

-- Deviation tracking
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS deviated_from_plan BOOLEAN DEFAULT FALSE;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS deviation_reason TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS deviation_details JSONB;

-- Actual values (when different from planned)
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS actual_caffeine_mg INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS actual_session_type TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS actual_duration_min INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS actual_warmup_min INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS actual_intensity TEXT;

-- Session quality (THE KEY DEPENDENT VARIABLE)
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS session_quality INTEGER CHECK (session_quality BETWEEN 1 AND 10);

-- Additional pre-session columns for model training
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS days_since_hard_session INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS planned_caffeine_mg INTEGER DEFAULT 0;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS planned_warmup_min INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS planned_session_type TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS planned_intensity TEXT CHECK (planned_intensity IN ('max', 'high', 'moderate', 'low'));
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS time_of_day TEXT CHECK (time_of_day IN ('morning', 'midday', 'afternoon', 'evening'));
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS time_available_min INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS current_niggles JSONB DEFAULT '[]';

-- Post-session outcomes
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS energy_post INTEGER CHECK (energy_post BETWEEN 1 AND 5);
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS psyched_level INTEGER CHECK (psyched_level BETWEEN 1 AND 5);
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS new_niggles JSONB DEFAULT '[]';
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS what_went_well TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS what_could_improve TEXT;

-- Recommendations tracking
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS recommendations_shown JSONB;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS recommendations_followed BOOLEAN;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_sessions_session_quality ON climbing_sessions(session_quality);
CREATE INDEX IF NOT EXISTS idx_sessions_deviated ON climbing_sessions(deviated_from_plan);


-- ============================================================================
-- 4. EXPAND POPULATION_PRIORS TABLE
-- ============================================================================
-- Add columns as specified in architecture

-- Add individual_variance column
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS individual_variance DECIMAL(10,6);

-- Add optimal range columns
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS optimal_min DECIMAL(10,2);
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS optimal_max DECIMAL(10,2);

-- Add literature/expert tracking
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS literature_mean DECIMAL(10,6);
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS literature_std DECIMAL(10,6);
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS literature_sources TEXT[];

ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS expert_mean DECIMAL(10,6);
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS expert_std DECIMAL(10,6);
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS expert_n_scenarios INTEGER;

ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS blend_weights JSONB;

-- Add effect direction for recommendation engine
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS effect_direction TEXT CHECK (effect_direction IN ('positive', 'negative', 'nonlinear'));

-- Add variable category
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS variable_category TEXT;

-- Add description
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS description TEXT;

-- Add is_current flag for versioning
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT TRUE;
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS total_judgments INTEGER DEFAULT 0;

-- Index for current priors
CREATE INDEX IF NOT EXISTS idx_population_priors_current ON population_priors(is_current) WHERE is_current = TRUE;


-- ============================================================================
-- 5. UPDATE EXISTING PRIORS WITH FULL METADATA
-- ============================================================================
-- Update existing priors with proper categorization and metadata

UPDATE population_priors SET
    variable_category = 'sleep',
    effect_direction = 'positive',
    description = 'Hours of sleep affects session quality',
    optimal_min = 7,
    optimal_max = 9,
    individual_variance = 0.10,
    literature_mean = 0.15,
    literature_std = 0.08,
    literature_sources = ARRAY['Walker 2017', 'Simpson 2017']
WHERE variable_name = 'sleep_hours';

UPDATE population_priors SET
    variable_category = 'sleep',
    effect_direction = 'positive',
    description = 'Quality of sleep is more impactful than duration',
    individual_variance = 0.15,
    literature_mean = 0.40,
    literature_std = 0.15,
    literature_sources = ARRAY['Vitale 2019']
WHERE variable_name = 'sleep_quality';

UPDATE population_priors SET
    variable_category = 'recovery',
    effect_direction = 'positive',
    description = 'Days since a hard session affects readiness',
    optimal_min = 2,
    optimal_max = 4,
    individual_variance = 0.20,
    literature_mean = 0.30,
    literature_std = 0.12,
    literature_sources = ARRAY['Levernier 2020']
WHERE variable_name = 'days_since_last_session';

UPDATE population_priors SET
    variable_category = 'psychological',
    effect_direction = 'negative',
    description = 'Life stress negatively impacts climbing performance',
    individual_variance = 0.20,
    literature_mean = -0.35,
    literature_std = 0.15,
    literature_sources = ARRAY['Nieuwenhuys 2012']
WHERE variable_name = 'stress_level';

UPDATE population_priors SET
    variable_category = 'energy',
    effect_direction = 'positive',
    description = 'Self-reported energy level predicts session quality',
    individual_variance = 0.25,
    literature_mean = 0.45,
    literature_std = 0.20,
    literature_sources = ARRAY['Estimated']
WHERE variable_name = 'energy_level';

UPDATE population_priors SET
    variable_category = 'psychological',
    effect_direction = 'negative',
    description = 'Performance anxiety impairs execution, especially on projects',
    individual_variance = 0.15,
    literature_mean = -0.20,
    literature_std = 0.10,
    literature_sources = ARRAY['Hardy 1996', 'Pijpers 2003']
WHERE variable_name = 'performance_anxiety';

UPDATE population_priors SET
    variable_category = 'psychological',
    effect_direction = 'negative',
    description = 'Fear of falling affects climbing quality and risk-taking',
    individual_variance = 0.15,
    literature_mean = -0.08,
    literature_std = 0.03,
    literature_sources = ARRAY['Climbing-specific research']
WHERE variable_name = 'fear_of_falling';

UPDATE population_priors SET
    variable_category = 'substance',
    effect_direction = 'positive',
    description = 'Caffeine provides ergogenic benefits if habituated',
    optimal_min = 100,
    optimal_max = 300,
    individual_variance = 0.20,
    literature_mean = 0.05,
    literature_std = 0.03,
    literature_sources = ARRAY['Grgic 2020']
WHERE variable_name = 'caffeine_today';

UPDATE population_priors SET
    variable_category = 'recovery',
    effect_direction = 'negative',
    description = 'Muscle soreness indicates incomplete recovery',
    individual_variance = 0.15,
    literature_mean = -0.20,
    literature_std = 0.10,
    literature_sources = ARRAY['Estimated']
WHERE variable_name = 'muscle_soreness';

UPDATE population_priors SET
    variable_category = 'substance',
    effect_direction = 'negative',
    description = 'Alcohol consumption impairs recovery',
    individual_variance = 0.10,
    literature_mean = -0.12,
    literature_std = 0.05,
    literature_sources = ARRAY['Barnes 2010']
WHERE variable_name = 'alcohol_last_24h';

UPDATE population_priors SET
    variable_category = 'injury',
    effect_direction = 'negative',
    description = 'Active injuries directly limit performance capacity',
    individual_variance = 0.25,
    literature_mean = -0.25,
    literature_std = 0.08,
    literature_sources = ARRAY['Direct limitation']
WHERE variable_name = 'injury_severity';

UPDATE population_priors SET
    variable_category = 'energy',
    effect_direction = 'positive',
    description = 'Hydration status affects grip and cognitive function',
    individual_variance = 0.10,
    literature_mean = 0.06,
    literature_std = 0.03,
    literature_sources = ARRAY['Hydration research']
WHERE variable_name = 'hydration_status';


-- ============================================================================
-- 6. INSERT ADDITIONAL PRIORS
-- ============================================================================
-- Add more priors as specified in the architecture spec

INSERT INTO population_priors (
    variable_name, population_mean, population_std, source, confidence,
    variable_category, effect_direction, description,
    optimal_min, optimal_max, individual_variance,
    literature_mean, literature_std, literature_sources
)
VALUES
    (
        'days_since_hard_session', 0.30, 0.12, 'literature_only', 'medium',
        'recovery', 'positive', 'Optimal recovery time before high-intensity sessions',
        2, 4, 0.20,
        0.30, 0.12, ARRAY['Levernier 2020']
    ),
    (
        'warmup_duration_min', 0.025, 0.015, 'literature_only', 'medium',
        'preparation', 'positive', 'Adequate warmup improves performance',
        15, 30, 0.02,
        0.025, 0.015, ARRAY['España-Romero 2009']
    ),
    (
        'caffeine_mg', 0.003, 0.002, 'literature_only', 'medium',
        'substance', 'positive', 'Per-mg caffeine effect (recommend 100-300mg)',
        100, 300, 0.004,
        0.003, 0.002, ARRAY['Grgic 2020']
    ),
    (
        'soreness_level', -0.20, 0.10, 'literature_only', 'medium',
        'recovery', 'negative', 'Soreness indicates incomplete recovery',
        NULL, NULL, 0.15,
        -0.20, 0.10, ARRAY['Estimated']
    ),
    (
        'motivation_level', 0.35, 0.15, 'literature_only', 'medium',
        'psychological', 'positive', 'High motivation correlates with better performance',
        NULL, NULL, 0.20,
        0.35, 0.15, ARRAY['Sports psychology literature']
    )
ON CONFLICT (variable_name) DO NOTHING;


-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE baseline_assessments IS 'User baseline profiles for personalized recommendations';
COMMENT ON TABLE model_outputs IS 'Per-user trained coefficients from hierarchical Bayesian model';
COMMENT ON COLUMN climbing_sessions.session_quality IS 'The key dependent variable (1-10 scale)';
COMMENT ON COLUMN climbing_sessions.deviated_from_plan IS 'True if actual session differed from recommendations';
COMMENT ON COLUMN model_outputs.shrinkage_factor IS 'How much toward population (0=population, 1=personal)';
COMMENT ON COLUMN model_outputs.phase IS 'cold_start (<10 sessions), learning (10-30), personalized (>30)';


