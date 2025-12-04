-- Population Priors Table for Bayesian Recommendation Engine
-- Stores blended priors from expert judgments and literature

CREATE TABLE IF NOT EXISTS population_priors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Variable identification
    variable_name TEXT NOT NULL UNIQUE,
    
    -- Prior estimates
    population_mean DECIMAL NOT NULL,
    population_std DECIMAL NOT NULL,
    
    -- Source tracking
    source TEXT NOT NULL CHECK (source IN ('blended', 'expert_only', 'literature_only', 'manual')),
    confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
    
    -- Expert contribution metrics
    n_scenarios INTEGER DEFAULT 0,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by variable name
CREATE INDEX IF NOT EXISTS idx_population_priors_variable ON population_priors (variable_name);

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_population_priors_source ON population_priors (source);

-- Enable RLS
ALTER TABLE population_priors ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read priors
CREATE POLICY "Anyone can read population priors" ON population_priors
    FOR SELECT USING (true);

-- Only service role can modify priors (via Dagster pipeline)
CREATE POLICY "Service role can modify priors" ON population_priors
    FOR ALL USING (auth.role() = 'service_role');

-- Function to update updated_at on modification
CREATE OR REPLACE FUNCTION update_population_priors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS update_population_priors_timestamp ON population_priors;
CREATE TRIGGER update_population_priors_timestamp
    BEFORE UPDATE ON population_priors
    FOR EACH ROW
    EXECUTE FUNCTION update_population_priors_updated_at();

-- Insert default literature priors
INSERT INTO population_priors (variable_name, population_mean, population_std, source, confidence, metadata)
VALUES
    ('sleep_quality', 0.15, 0.05, 'literature_only', 'medium', '{"notes": "From sleep-performance research"}'),
    ('sleep_hours', 0.08, 0.03, 'literature_only', 'medium', '{"notes": "Optimal around 7-9 hours"}'),
    ('energy_level', 0.20, 0.06, 'literature_only', 'medium', '{"notes": "Self-reported energy correlates with performance"}'),
    ('motivation', 0.12, 0.04, 'literature_only', 'medium', '{"notes": "Intrinsic motivation effects"}'),
    ('days_since_last_session', -0.05, 0.02, 'literature_only', 'low', '{"notes": "Detraining effects"}'),
    ('days_since_rest_day', -0.03, 0.02, 'literature_only', 'low', '{"notes": "Accumulated fatigue"}'),
    ('muscle_soreness', -0.10, 0.04, 'literature_only', 'medium', '{"notes": "DOMS impact on performance"}'),
    ('stress_level', -0.15, 0.05, 'literature_only', 'medium', '{"notes": "Psychological stress effects"}'),
    ('performance_anxiety', -0.18, 0.06, 'literature_only', 'high', '{"notes": "Well-documented in sports psychology"}'),
    ('fear_of_falling', -0.08, 0.03, 'literature_only', 'medium', '{"notes": "Climbing-specific anxiety"}'),
    ('caffeine_today', 0.05, 0.03, 'literature_only', 'medium', '{"notes": "Ergogenic effects of caffeine"}'),
    ('alcohol_last_24h', -0.12, 0.05, 'literature_only', 'medium', '{"notes": "Alcohol recovery impairment"}'),
    ('injury_severity', -0.25, 0.08, 'literature_only', 'high', '{"notes": "Direct performance limitation"}'),
    ('hydration_status', 0.06, 0.03, 'literature_only', 'medium', '{"notes": "Dehydration performance effects"}')
ON CONFLICT (variable_name) DO NOTHING;

