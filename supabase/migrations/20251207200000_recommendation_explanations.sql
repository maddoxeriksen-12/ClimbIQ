-- Migration: Create recommendation_explanations table for "Why?" feature
-- This table stores explanation templates that can be matched to recommendations
-- Templates are extracted from expert reasoning and can be augmented by LLM

-- Main explanations table
CREATE TABLE IF NOT EXISTS recommendation_explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What this explains
    recommendation_type TEXT NOT NULL,  -- 'warmup', 'session_structure', 'rest', 'intensity', 'avoid', 'include'
    target_element TEXT,                -- Specific element being explained (e.g., 'extended_warmup', 'long_rests')

    -- Condition pattern - when to use this explanation
    -- Format: {"variable": "sleep_quality", "op": "<=", "value": 4}
    -- Or complex: {"ALL": [{"variable": "x", "op": "<=", "value": 4}, {"variable": "y", "op": ">=", "value": 7}]}
    condition_pattern JSONB NOT NULL,

    -- The explanation content
    explanation_template TEXT NOT NULL,  -- Can include placeholders like {sleep_quality}, {stress_level}
    short_explanation TEXT,              -- One-liner version
    factors_explained TEXT[] NOT NULL DEFAULT '{}',  -- Which variables this explains

    -- Scientific backing
    literature_reference TEXT,           -- Citation if from research
    mechanism TEXT,                      -- Physiological/psychological mechanism

    -- Training source
    source_type TEXT NOT NULL DEFAULT 'manual',  -- 'expert', 'literature', 'ai_generated', 'manual'
    expert_scenario_ids UUID[] DEFAULT '{}',     -- Links to source expert scenarios
    extraction_confidence FLOAT,                  -- How confident the extraction was (0-1)

    -- Quality metrics
    confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
    usage_count INT DEFAULT 0,
    positive_feedback_count INT DEFAULT 0,
    negative_feedback_count INT DEFAULT 0,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 50,  -- Higher priority explanations are preferred (0-100)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Index for efficient lookup
CREATE INDEX idx_explanations_type ON recommendation_explanations(recommendation_type);
CREATE INDEX idx_explanations_active ON recommendation_explanations(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_explanations_conditions ON recommendation_explanations USING GIN (condition_pattern);
CREATE INDEX idx_explanations_factors ON recommendation_explanations USING GIN (factors_explained);

-- Table to cache LLM-generated explanations for reuse
CREATE TABLE IF NOT EXISTS explanation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Cache key (hash of input)
    cache_key TEXT UNIQUE NOT NULL,

    -- The generated explanation
    explanation JSONB NOT NULL,  -- Full explanation object with summary, factors, etc.

    -- Input that generated this
    recommendation_type TEXT NOT NULL,
    key_factors JSONB NOT NULL,
    user_state_hash TEXT,  -- Hash of relevant user state values

    -- Quality tracking
    was_helpful BOOLEAN,
    feedback_text TEXT,

    -- Cache management
    hit_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX idx_cache_key ON explanation_cache(cache_key);
CREATE INDEX idx_cache_expires ON explanation_cache(expires_at);

-- Table to track user feedback on explanations
CREATE TABLE IF NOT EXISTS explanation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),

    -- What was explained
    recommendation_type TEXT NOT NULL,
    explanation_id UUID REFERENCES recommendation_explanations(id),
    cache_id UUID REFERENCES explanation_cache(id),

    -- The explanation shown
    explanation_shown JSONB NOT NULL,

    -- User feedback
    was_helpful BOOLEAN NOT NULL,
    clarity_rating INT CHECK (clarity_rating BETWEEN 1 AND 5),
    feedback_text TEXT,

    -- Context
    session_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_user ON explanation_feedback(user_id);
CREATE INDEX idx_feedback_type ON explanation_feedback(recommendation_type);

-- Seed some initial explanation templates based on literature
INSERT INTO recommendation_explanations (
    recommendation_type, target_element, condition_pattern,
    explanation_template, short_explanation, factors_explained,
    literature_reference, mechanism, source_type, confidence, priority
) VALUES
-- Sleep-related explanations
(
    'warmup', 'extended_warmup',
    '{"variable": "sleep_quality", "op": "<=", "value": 4}',
    'Your sleep quality was rated {sleep_quality}/10, which is below optimal. Poor sleep reduces neuromuscular coordination and reaction time. An extended warmup helps activate neural pathways that may be sluggish due to sleep debt, improving movement quality and reducing injury risk.',
    'Low sleep quality requires longer warmup to activate sluggish neural pathways.',
    ARRAY['sleep_quality'],
    'Fullagar et al. (2015) - Sleep and athletic performance',
    'Sleep deprivation impairs motor cortex excitability and reduces neuromuscular efficiency',
    'literature', 'high', 90
),
(
    'intensity', 'reduce_intensity',
    '{"variable": "sleep_quality", "op": "<=", "value": 3}',
    'With only {sleep_quality}/10 sleep quality, your cognitive function and pain perception are impaired. Research shows that poor sleep increases injury risk by up to 1.7x. Today, prioritize technique over intensity - your body cannot safely handle high loads in this state.',
    'Very poor sleep significantly increases injury risk - reduce intensity today.',
    ARRAY['sleep_quality'],
    'Milewski et al. (2014) - Chronic lack of sleep and injury rates',
    'Sleep deprivation increases inflammatory markers and impairs proprioception',
    'literature', 'high', 95
),

-- Stress-related explanations
(
    'warmup', 'breathing_exercises',
    '{"variable": "stress_level", "op": ">=", "value": 7}',
    'Your stress level is elevated at {stress_level}/10. High cortisol levels from stress create muscle tension, particularly in shoulders and forearms - critical areas for climbing. Box breathing (4-4-4-4 pattern) activates your parasympathetic nervous system, reducing tension and improving blood flow to working muscles.',
    'High stress creates muscle tension - breathing exercises help release it.',
    ARRAY['stress_level'],
    'Ma et al. (2017) - Effect of diaphragmatic breathing on cortisol',
    'Diaphragmatic breathing stimulates vagal tone, reducing cortisol and muscle tension',
    'literature', 'high', 85
),
(
    'session_structure', 'mindful_approach',
    '{"variable": "stress_level", "op": ">=", "value": 8}',
    'With stress at {stress_level}/10, your fight-or-flight response may be partially activated. This can lead to rushed movement, poor decision-making, and grip over-tensioning. Focus on deliberate, mindful climbing today - pause before each move, breathe, and climb with intention rather than urgency.',
    'Very high stress activates fight-or-flight - climb mindfully to counteract.',
    ARRAY['stress_level'],
    'Nieuwenhuys & Oudejans (2012) - Anxiety and perceptual-motor performance',
    'Anxiety narrows attention and increases muscle co-contraction',
    'literature', 'high', 80
),

-- Energy/Recovery explanations
(
    'warmup', 'gentle_activation',
    '{"ALL": [{"variable": "energy_level", "op": "<=", "value": 4}, {"variable": "muscle_soreness", "op": ">=", "value": 6}]}',
    'Your energy ({energy_level}/10) is low and muscle soreness ({muscle_soreness}/10) is elevated. This combination suggests incomplete recovery from previous training. A gentle warmup with extended mobility work helps increase blood flow to sore muscles, accelerating recovery while preparing you for a lighter session.',
    'Low energy + high soreness indicates incomplete recovery - gentle warmup helps.',
    ARRAY['energy_level', 'muscle_soreness'],
    'Dupuy et al. (2018) - Recovery strategies in sport',
    'Active recovery increases blood flow, clearing metabolic byproducts from muscles',
    'literature', 'high', 85
),

-- Finger health explanations
(
    'warmup', 'finger_emphasis',
    '{"variable": "finger_tendon_health", "op": "<=", "value": 5}',
    'Your finger/tendon health is at {finger_tendon_health}/10. Tendons have poor blood supply and take longer to warm up than muscles. Extended finger-specific warmup (rice bucket, finger curls, progressive loading) increases tendon temperature and viscoelasticity, reducing strain during climbing.',
    'Compromised finger health needs extra warmup - tendons warm slower than muscles.',
    ARRAY['finger_tendon_health'],
    'Schweizer (2001) - Lumbrical injuries in rock climbers',
    'Tendon viscoelasticity is temperature-dependent; warm tendons handle load better',
    'literature', 'high', 95
),
(
    'avoid', 'crimping',
    '{"variable": "finger_tendon_health", "op": "<=", "value": 4}',
    'With finger health at only {finger_tendon_health}/10, closed-crimp grips put dangerous strain on your A2 pulley. Research shows closed crimps create 3x more force on pulleys than open-hand grips. Today, consciously choose open-hand and half-crimp positions, even if it means downgrading problems.',
    'Low finger health + crimping = high pulley strain. Use open-hand grips today.',
    ARRAY['finger_tendon_health'],
    'Schweizer & Hudek (2011) - Kinetics of crimp and slope grip',
    'Closed crimp creates 36kg force on A2 pulley vs 12kg for open hand',
    'literature', 'high', 100
),

-- Motivation explanations
(
    'session_structure', 'fun_focus',
    '{"variable": "motivation", "op": "<=", "value": 3}',
    'Your motivation is low today ({motivation}/10). Forcing high-intensity training when motivation is lacking often leads to poor technique habits and negative associations with climbing. Instead, focus on fun - climb with friends, try new movement styles, or work on problems just for enjoyment. Consistency matters more than any single session.',
    'Low motivation day - prioritize fun to maintain long-term consistency.',
    ARRAY['motivation'],
    'Deci & Ryan (2000) - Self-determination theory',
    'Intrinsic motivation is sustained by autonomy, competence, and enjoyment',
    'literature', 'medium', 70
),

-- Rest/Recovery explanations
(
    'session_structure', 'long_rests',
    '{"ALL": [{"variable": "primary_goal", "op": "==", "value": "limit_bouldering"}, {"variable": "energy_level", "op": ">=", "value": 7}]}',
    'For limit bouldering with good energy ({energy_level}/10), take full 3-5 minute rests between attempts. Your phosphocreatine system (primary power source for <10 second efforts) takes 3+ minutes to fully replenish. Shorter rests mean you are not testing your true max - you are testing your fatigue.',
    'Limit bouldering needs 3-5 min rests for phosphocreatine recovery.',
    ARRAY['primary_goal', 'energy_level'],
    'Baker et al. (2010) - Rest interval effects on strength performance',
    'Phosphocreatine resynthesis is 95% complete at 3 minutes, 100% at 5 minutes',
    'literature', 'high', 85
),

-- Hydration explanations
(
    'include', 'hydrate',
    '{"variable": "hydration_status", "op": "<=", "value": 4}',
    'Your hydration is suboptimal. Even 2% dehydration impairs cognitive function and grip strength. Drink 500ml of water now and continue sipping throughout your session. For sessions over 90 minutes, consider adding electrolytes.',
    'Dehydration impairs both mental and physical performance - drink now.',
    ARRAY['hydration_status'],
    'Judelson et al. (2007) - Hydration and muscular performance',
    'Dehydration reduces blood volume, impairing nutrient delivery and waste removal',
    'literature', 'high', 80
),

-- Generic warmup explanation (fallback when no specific condition triggers)
(
    'warmup', NULL,
    '{}',  -- Empty condition matches all cases
    'A proper warmup is essential before every climbing session. It gradually increases heart rate, body temperature, and blood flow to muscles and tendons. For climbing specifically, warmup primes your neuromuscular system for precise movements, increases synovial fluid in joints, and prepares tendons for load - which is critical since tendons have poor blood supply and take longer to warm than muscles.',
    'Warmup prepares muscles, tendons, and nervous system for climbing demands.',
    ARRAY[]::TEXT[],
    'Bishop (2003) - Warm up I: potential mechanisms and the effects of passive warm up',
    'Warming up increases muscle temperature, improving enzymatic reactions and nerve conduction velocity',
    'literature', 'high', 40
);

-- Enable RLS
ALTER TABLE recommendation_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE explanation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE explanation_feedback ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Explanations readable by all authenticated users"
ON recommendation_explanations FOR SELECT
TO authenticated
USING (is_active = TRUE);

CREATE POLICY "Explanations manageable by coaches"
ON recommendation_explanations FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_coach = TRUE
    )
);

CREATE POLICY "Cache readable by authenticated users"
ON explanation_cache FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "Cache writable by authenticated users"
ON explanation_cache FOR INSERT
TO authenticated
WITH CHECK (TRUE);

CREATE POLICY "Feedback manageable by owner"
ON explanation_feedback FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Function to update explanation usage stats
CREATE OR REPLACE FUNCTION increment_explanation_usage(explanation_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE recommendation_explanations
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = explanation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_explanation_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM explanation_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment positive feedback count
CREATE OR REPLACE FUNCTION increment_positive_feedback(explanation_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE recommendation_explanations
    SET positive_feedback_count = positive_feedback_count + 1,
        updated_at = NOW()
    WHERE id = explanation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment negative feedback count
CREATE OR REPLACE FUNCTION increment_negative_feedback(explanation_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE recommendation_explanations
    SET negative_feedback_count = negative_feedback_count + 1,
        updated_at = NOW()
    WHERE id = explanation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE recommendation_explanations IS 'Stores explanation templates for recommendation "Why?" feature. Templates can be matched by condition patterns and filled with user-specific values.';
COMMENT ON TABLE explanation_cache IS 'Caches LLM-generated explanations to avoid redundant API calls for similar situations.';
COMMENT ON TABLE explanation_feedback IS 'Tracks user feedback on explanations to improve quality over time.';
