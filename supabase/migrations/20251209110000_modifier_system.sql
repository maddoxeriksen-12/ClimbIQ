-- Migration: Session Modifiers System
-- Layer 2: Logic Core - All possible modifiers for session compilation
-- Modifiers adjust templates based on user state variables

-- ============================================================================
-- 1. SESSION MODIFIERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_name TEXT NOT NULL UNIQUE,

    -- What triggers this modifier
    -- Format: {"variable": "x", "op": "<=", "value": 4}
    -- Or complex: {"ALL": [...]} or {"ANY": [...]}
    condition_pattern JSONB NOT NULL,

    -- What it modifies
    modifier_type TEXT NOT NULL CHECK (modifier_type IN (
        'duration_scale',      -- Multiply phase duration (params: scale, affects[])
        'intensity_cap',       -- Cap max intensity (params: max_intensity)
        'exercise_swap',       -- Replace exercise (params: swap_from, swap_to)
        'phase_inject',        -- Add phase block (params: phase, position, block)
        'rest_scale',          -- Adjust rest periods (params: scale)
        'volume_scale',        -- Adjust sets/reps (params: scale)
        'warmup_extend',       -- Extend warmup duration (params: extend_min)
        'cooldown_extend',     -- Extend cooldown duration (params: extend_min)
        'exercise_remove',     -- Remove specific exercise (params: exercise_name)
        'intensity_reduce',    -- Reduce overall intensity (params: reduce_by)
        'add_breathing',       -- Add breathing exercises (params: duration, position)
        'add_mobility',        -- Add extra mobility work (params: duration, focus)
        'flag_warning'         -- Add warning message (params: message, severity)
    )),

    -- Modifier parameters
    modifier_params JSONB NOT NULL,

    -- What the modifier affects
    affects_phases TEXT[] DEFAULT ARRAY['warmup', 'main', 'cooldown'],

    -- Explanation for user
    reason TEXT NOT NULL,
    science_note TEXT,          -- Optional scientific backing

    -- Priority for conflict resolution (higher = applied first)
    priority INT DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),

    -- Source tracking
    source_type TEXT DEFAULT 'literature' CHECK (source_type IN ('expert', 'literature', 'scaffold')),
    expert_scenario_ids UUID[],
    literature_reference TEXT,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    times_triggered INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_modifiers_active ON session_modifiers(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_modifiers_type ON session_modifiers(modifier_type);
CREATE INDEX IF NOT EXISTS idx_modifiers_priority ON session_modifiers(priority DESC);
CREATE INDEX IF NOT EXISTS idx_modifiers_conditions ON session_modifiers USING GIN (condition_pattern);

-- ============================================================================
-- 2. SEED COMPREHENSIVE MODIFIERS (ALL VARIABLES)
-- ============================================================================

INSERT INTO session_modifiers (
    modifier_name, condition_pattern, modifier_type, modifier_params,
    affects_phases, reason, science_note, priority, source_type, literature_reference
) VALUES

-- ============================================================================
-- SLEEP-RELATED MODIFIERS
-- ============================================================================
(
    'low_sleep_warmup_extend',
    '{"variable": "sleep_quality", "op": "<=", "value": 4}',
    'warmup_extend',
    '{"extend_min": 5}',
    ARRAY['warmup'],
    'Poor sleep reduces neuromuscular coordination. Extended warmup helps activate sluggish motor patterns.',
    'Sleep deprivation impairs motor cortex excitability and reduces neuromuscular efficiency.',
    80,
    'literature',
    'Fullagar et al. (2015) - Sleep and athletic performance'
),
(
    'very_low_sleep_intensity_cap',
    '{"variable": "sleep_quality", "op": "<=", "value": 3}',
    'intensity_cap',
    '{"max_intensity": 6}',
    ARRAY['main'],
    'Very poor sleep significantly increases injury risk. Reducing intensity protects you today.',
    'Poor sleep increases injury risk by up to 1.7x due to impaired proprioception.',
    95,
    'literature',
    'Milewski et al. (2014) - Chronic lack of sleep and injury rates'
),
(
    'low_sleep_hours_volume_reduce',
    '{"variable": "sleep_hours", "op": "<", "value": 6}',
    'volume_scale',
    '{"scale": 0.8}',
    ARRAY['main'],
    'Under 6 hours of sleep impairs recovery capacity. Reducing volume prevents over-accumulation of fatigue.',
    'Sleep restriction reduces testosterone and growth hormone, impairing muscle recovery.',
    75,
    'literature',
    'Leeder et al. (2012) - Sleep in elite athletes'
),

-- ============================================================================
-- STRESS-RELATED MODIFIERS
-- ============================================================================
(
    'high_stress_breathing_inject',
    '{"variable": "stress_level", "op": ">=", "value": 7}',
    'phase_inject',
    '{"phase": "warmup", "position": "prepend", "block": {"name": "box_breathing", "generic_exercise": "breathing_exercises", "duration": 5, "notes": "4-4-4-4 pattern to activate parasympathetic nervous system"}}',
    ARRAY['warmup'],
    'High stress creates muscle tension. Breathing exercises help release it and improve blood flow.',
    'Diaphragmatic breathing stimulates vagal tone, reducing cortisol and muscle tension.',
    75,
    'literature',
    'Ma et al. (2017) - Effect of diaphragmatic breathing on cortisol'
),
(
    'very_high_stress_intensity_reduce',
    '{"variable": "stress_level", "op": ">=", "value": 8}',
    'intensity_reduce',
    '{"reduce_by": 1}',
    ARRAY['main'],
    'Very high stress activates fight-or-flight response. Lower intensity prevents rushed, injury-prone movement.',
    'Anxiety narrows attention and increases muscle co-contraction.',
    80,
    'literature',
    'Nieuwenhuys & Oudejans (2012) - Anxiety and perceptual-motor performance'
),
(
    'moderate_stress_warmup_extend',
    '{"variable": "stress_level", "op": ">=", "value": 6}',
    'warmup_extend',
    '{"extend_min": 3}',
    ARRAY['warmup'],
    'Elevated stress causes muscle tension. Extra warmup time helps release tension gradually.',
    NULL,
    60,
    'scaffold',
    NULL
),

-- ============================================================================
-- SORENESS/RECOVERY MODIFIERS
-- ============================================================================
(
    'high_soreness_volume_reduce',
    '{"variable": "muscle_soreness", "op": ">=", "value": 7}',
    'volume_scale',
    '{"scale": 0.7}',
    ARRAY['main'],
    'High muscle soreness indicates incomplete recovery. Reducing volume prevents compounding fatigue.',
    'Exercising sore muscles can increase damage if load is not reduced.',
    85,
    'literature',
    'Dupuy et al. (2018) - Recovery strategies in sport'
),
(
    'moderate_soreness_intensity_cap',
    '{"variable": "muscle_soreness", "op": ">=", "value": 6}',
    'intensity_cap',
    '{"max_intensity": 7}',
    ARRAY['main'],
    'Moderate soreness suggests residual muscle damage. Capping intensity allows adaptation without further damage.',
    NULL,
    70,
    'scaffold',
    NULL
),
(
    'soreness_and_low_energy',
    '{"ALL": [{"variable": "muscle_soreness", "op": ">=", "value": 6}, {"variable": "energy_level", "op": "<=", "value": 4}]}',
    'intensity_cap',
    '{"max_intensity": 5}',
    ARRAY['main'],
    'Combined high soreness and low energy indicates accumulated fatigue. This is a recovery session now.',
    NULL,
    90,
    'expert',
    NULL
),
(
    'high_soreness_cooldown_extend',
    '{"variable": "muscle_soreness", "op": ">=", "value": 6}',
    'cooldown_extend',
    '{"extend_min": 5}',
    ARRAY['cooldown'],
    'Extended cooldown promotes blood flow to sore muscles, aiding recovery.',
    'Active recovery increases blood flow, clearing metabolic byproducts from muscles.',
    65,
    'literature',
    'Dupuy et al. (2018) - Recovery strategies in sport'
),

-- ============================================================================
-- ENERGY-RELATED MODIFIERS
-- ============================================================================
(
    'low_energy_duration_scale',
    '{"variable": "energy_level", "op": "<=", "value": 4}',
    'duration_scale',
    '{"scale": 0.8, "affects": ["main"]}',
    ARRAY['main'],
    'Low energy limits your available resources. Shorter session prevents quality deterioration.',
    NULL,
    70,
    'scaffold',
    NULL
),
(
    'very_low_energy_intensity_cap',
    '{"variable": "energy_level", "op": "<=", "value": 3}',
    'intensity_cap',
    '{"max_intensity": 5}',
    ARRAY['main'],
    'Very low energy means your body needs recovery, not training stress. Keep it light.',
    NULL,
    85,
    'scaffold',
    NULL
),
(
    'moderate_energy_rest_scale',
    '{"ALL": [{"variable": "energy_level", "op": "<=", "value": 5}, {"variable": "energy_level", "op": ">=", "value": 3}]}',
    'rest_scale',
    '{"scale": 1.2}',
    ARRAY['main'],
    'Moderate energy requires longer rest periods to maintain quality between efforts.',
    NULL,
    55,
    'scaffold',
    NULL
),

-- ============================================================================
-- FINGER/TENDON HEALTH MODIFIERS
-- ============================================================================
(
    'compromised_fingers_warmup',
    '{"variable": "finger_tendon_health", "op": "<=", "value": 5}',
    'warmup_extend',
    '{"extend_min": 5}',
    ARRAY['warmup'],
    'Compromised finger health needs extra warmup. Tendons have poor blood supply and warm slower than muscles.',
    'Tendon viscoelasticity is temperature-dependent; warm tendons handle load better.',
    85,
    'literature',
    'Schweizer (2001) - Lumbrical injuries in rock climbers'
),
(
    'compromised_fingers_swap_crimps',
    '{"variable": "finger_tendon_health", "op": "<=", "value": 4}',
    'exercise_swap',
    '{"swap_from": "crimp", "swap_to": "open_hand"}',
    ARRAY['main'],
    'Closed crimps put dangerous strain on A2 pulley. Using open-hand grips protects healing tendons.',
    'Closed crimps create 3x more force on pulleys than open-hand grips.',
    95,
    'literature',
    'Schweizer & Hudek (2011) - Kinetics of crimp and slope grip'
),
(
    'finger_issues_intensity_cap',
    '{"variable": "finger_tendon_health", "op": "<=", "value": 4}',
    'intensity_cap',
    '{"max_intensity": 6}',
    ARRAY['main'],
    'Low finger health requires reduced intensity. High-load climbing risks further injury.',
    NULL,
    90,
    'expert',
    NULL
),
(
    'finger_health_warning',
    '{"variable": "finger_tendon_health", "op": "<=", "value": 3}',
    'flag_warning',
    '{"message": "Your finger health is very low. Consider resting or doing only light technique work.", "severity": "high"}',
    ARRAY['main'],
    'Very low finger health is a red flag. You should consider if climbing today is wise.',
    NULL,
    100,
    'expert',
    NULL
),

-- ============================================================================
-- ACWR (WORKLOAD RATIO) MODIFIERS
-- ============================================================================
(
    'high_acwr_intensity_cap',
    '{"variable": "acwr", "op": ">", "value": 1.5}',
    'intensity_cap',
    '{"max_intensity": 5}',
    ARRAY['main'],
    'Your training load has spiked recently (high ACWR). Reducing intensity protects against injury.',
    'ACWR > 1.5 associated with 21% injury probability vs 5% in optimal zone.',
    100,
    'literature',
    'Gabbett (2016) - The training-injury prevention paradox'
),
(
    'moderate_acwr_warning',
    '{"variable": "acwr", "op": ">", "value": 1.3}',
    'flag_warning',
    '{"message": "Your recent training load is elevated. Be mindful of fatigue signals.", "severity": "medium"}',
    ARRAY['main'],
    'Moderately elevated ACWR suggests caution. Pay attention to how your body feels.',
    NULL,
    80,
    'literature',
    'Gabbett (2016) - The training-injury prevention paradox'
),
(
    'undertrained_acwr_encourage',
    '{"variable": "acwr", "op": "<", "value": 0.8}',
    'flag_warning',
    '{"message": "Your recent training has been lighter than usual. Consider building volume if feeling good.", "severity": "info"}',
    ARRAY['main'],
    'Low ACWR means you may be undertrained. This can also increase injury risk when you do push hard.',
    NULL,
    50,
    'literature',
    'Gabbett (2016) - The training-injury prevention paradox'
),

-- ============================================================================
-- CONSECUTIVE DAYS MODIFIERS
-- ============================================================================
(
    'many_consecutive_days_intensity',
    '{"variable": "days_since_rest_day", "op": ">=", "value": 4}',
    'intensity_cap',
    '{"max_intensity": 6}',
    ARRAY['main'],
    'After 4+ consecutive climbing days, accumulated fatigue requires a deload. Keep intensity moderate.',
    NULL,
    80,
    'expert',
    NULL
),
(
    'consecutive_days_volume',
    '{"variable": "days_since_rest_day", "op": ">=", "value": 3}',
    'volume_scale',
    '{"scale": 0.85}',
    ARRAY['main'],
    'Multiple consecutive days accumulates micro-damage. Reducing volume allows adaptation.',
    NULL,
    65,
    'scaffold',
    NULL
),
(
    'extended_streak_warning',
    '{"variable": "days_since_rest_day", "op": ">=", "value": 5}',
    'flag_warning',
    '{"message": "You have climbed 5+ days without rest. Consider a rest day soon.", "severity": "medium"}',
    ARRAY['main'],
    'Extended climbing streaks without rest increase overuse injury risk.',
    NULL,
    85,
    'expert',
    NULL
),

-- ============================================================================
-- HYDRATION MODIFIERS
-- ============================================================================
(
    'dehydrated_rest_scale',
    '{"variable": "hydration_status", "op": "<=", "value": 4}',
    'rest_scale',
    '{"scale": 1.2}',
    ARRAY['main'],
    'Dehydration impairs thermoregulation and recovery between efforts. Take longer rests.',
    'Even 2% dehydration impairs cognitive function and grip strength.',
    70,
    'literature',
    'Judelson et al. (2007) - Hydration and muscular performance'
),
(
    'dehydrated_warning',
    '{"variable": "hydration_status", "op": "<=", "value": 3}',
    'flag_warning',
    '{"message": "You are dehydrated. Drink 500ml water now and continue sipping throughout session.", "severity": "high"}',
    ARRAY['warmup'],
    'Significant dehydration affects performance and increases injury risk.',
    NULL,
    90,
    'literature',
    'Judelson et al. (2007) - Hydration and muscular performance'
),

-- ============================================================================
-- MOTIVATION MODIFIERS
-- ============================================================================
(
    'low_motivation_fun_focus',
    '{"variable": "motivation", "op": "<=", "value": 3}',
    'intensity_reduce',
    '{"reduce_by": 2}',
    ARRAY['main'],
    'Low motivation day means forcing intensity leads to poor technique and negative associations. Focus on fun.',
    'Intrinsic motivation is sustained by autonomy, competence, and enjoyment.',
    75,
    'literature',
    'Deci & Ryan (2000) - Self-determination theory'
),
(
    'very_low_motivation_warning',
    '{"variable": "motivation", "op": "<=", "value": 2}',
    'flag_warning',
    '{"message": "Very low motivation. Consider if today is a rest day or just climb for fun with no pressure.", "severity": "info"}',
    ARRAY['main'],
    'Sometimes the best training decision is to not train hard.',
    NULL,
    60,
    'scaffold',
    NULL
),

-- ============================================================================
-- TIME OF DAY MODIFIERS
-- ============================================================================
(
    'morning_session_warmup',
    '{"ALL": [{"variable": "time_of_day", "op": "==", "value": "morning"}, {"variable": "sleep_quality", "op": "<=", "value": 6}]}',
    'warmup_extend',
    '{"extend_min": 3}',
    ARRAY['warmup'],
    'Morning sessions with suboptimal sleep need extra warmup. Body temperature is lowest in early AM.',
    'Core temperature is naturally lowest in early morning, affecting muscle performance.',
    65,
    'literature',
    'Atkinson & Reilly (1996) - Circadian variation in sports performance'
),
(
    'late_session_intensity',
    '{"variable": "time_of_day", "op": "==", "value": "late_evening"}',
    'intensity_reduce',
    '{"reduce_by": 1}',
    ARRAY['main'],
    'Late evening sessions can disrupt sleep if too intense. Keeping it moderate helps recovery.',
    'High-intensity exercise close to bedtime can delay sleep onset.',
    50,
    'literature',
    'Stutz et al. (2019) - Effects of evening exercise on sleep'
),

-- ============================================================================
-- CROWDEDNESS MODIFIERS
-- ============================================================================
(
    'crowded_gym_rest_scale',
    '{"variable": "gym_crowdedness", "op": ">=", "value": 7}',
    'rest_scale',
    '{"scale": 1.3}',
    ARRAY['main'],
    'Crowded gym means longer waits between problems. Rest periods adjust to reality.',
    NULL,
    60,
    'scaffold',
    NULL
),
(
    'very_crowded_technique_bias',
    '{"variable": "gym_crowdedness", "op": ">=", "value": 8}',
    'flag_warning',
    '{"message": "Very crowded gym. Good day for technique focus on whatever is available.", "severity": "info"}',
    ARRAY['main'],
    'Very crowded conditions make projecting difficult. Technique work is more adaptable.',
    NULL,
    55,
    'scaffold',
    NULL
),

-- ============================================================================
-- CAFFEINE MODIFIERS
-- ============================================================================
(
    'high_caffeine_rest_reduce',
    '{"variable": "caffeine_mg", "op": ">=", "value": 200}',
    'rest_scale',
    '{"scale": 0.9}',
    ARRAY['main'],
    'Caffeine enhances alertness and may reduce perceived rest needs. But dont overdo it.',
    'Caffeine reduces adenosine binding, decreasing perceived fatigue.',
    40,
    'literature',
    'Goldstein et al. (2010) - Caffeine and performance'
),
(
    'very_high_caffeine_warning',
    '{"variable": "caffeine_mg", "op": ">=", "value": 400}',
    'flag_warning',
    '{"message": "Very high caffeine intake. Be aware this may mask fatigue signals.", "severity": "info"}',
    ARRAY['main'],
    'Very high caffeine can mask genuine fatigue, potentially leading to overtraining.',
    NULL,
    50,
    'scaffold',
    NULL
),

-- ============================================================================
-- SKIN CONDITION MODIFIERS
-- ============================================================================
(
    'bad_skin_volume_reduce',
    '{"variable": "skin_condition", "op": "<=", "value": 3}',
    'volume_scale',
    '{"scale": 0.75}',
    ARRAY['main'],
    'Poor skin condition limits volume. Flappers end sessions - reducing volume protects skin.',
    NULL,
    70,
    'scaffold',
    NULL
),
(
    'skin_warning',
    '{"variable": "skin_condition", "op": "<=", "value": 2}',
    'flag_warning',
    '{"message": "Very poor skin condition. Consider taping problem areas or reducing session length.", "severity": "medium"}',
    ARRAY['main'],
    'Bad skin will limit your session regardless of other factors.',
    NULL,
    75,
    'scaffold',
    NULL
),

-- ============================================================================
-- COMBINED/COMPLEX MODIFIERS
-- ============================================================================
(
    'tired_and_stressed_recovery',
    '{"ALL": [{"variable": "energy_level", "op": "<=", "value": 4}, {"variable": "stress_level", "op": ">=", "value": 7}]}',
    'intensity_cap',
    '{"max_intensity": 4}',
    ARRAY['main'],
    'Low energy combined with high stress is a recovery day. Pushing through increases injury and burnout risk.',
    NULL,
    95,
    'expert',
    NULL
),
(
    'good_state_allow_intensity',
    '{"ALL": [{"variable": "energy_level", "op": ">=", "value": 7}, {"variable": "sleep_quality", "op": ">=", "value": 7}, {"variable": "muscle_soreness", "op": "<=", "value": 4}]}',
    'flag_warning',
    '{"message": "Great state today! Good conditions for pushing limits if thats your goal.", "severity": "positive"}',
    ARRAY['main'],
    'When all systems are go, its a good day for high-quality training.',
    NULL,
    30,
    'scaffold',
    NULL
);

-- ============================================================================
-- 3. FUNCTIONS FOR MODIFIER EVALUATION
-- ============================================================================

-- Function to evaluate a single condition
CREATE OR REPLACE FUNCTION evaluate_condition(
    p_condition JSONB,
    p_user_state JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_variable TEXT;
    v_op TEXT;
    v_threshold NUMERIC;
    v_user_value NUMERIC;
    v_result BOOLEAN;
    v_sub_condition JSONB;
    v_all_conditions JSONB;
    v_any_conditions JSONB;
BEGIN
    -- Handle ALL conditions
    IF p_condition ? 'ALL' THEN
        v_all_conditions := p_condition->'ALL';
        FOR v_sub_condition IN SELECT * FROM jsonb_array_elements(v_all_conditions)
        LOOP
            IF NOT evaluate_condition(v_sub_condition, p_user_state) THEN
                RETURN FALSE;
            END IF;
        END LOOP;
        RETURN TRUE;
    END IF;

    -- Handle ANY conditions
    IF p_condition ? 'ANY' THEN
        v_any_conditions := p_condition->'ANY';
        FOR v_sub_condition IN SELECT * FROM jsonb_array_elements(v_any_conditions)
        LOOP
            IF evaluate_condition(v_sub_condition, p_user_state) THEN
                RETURN TRUE;
            END IF;
        END LOOP;
        RETURN FALSE;
    END IF;

    -- Handle simple condition
    v_variable := p_condition->>'variable';
    v_op := p_condition->>'op';
    v_threshold := (p_condition->>'value')::NUMERIC;

    -- Get user value (handle string values for equality checks)
    IF v_op IN ('==', '!=') AND jsonb_typeof(p_user_state->v_variable) = 'string' THEN
        -- String comparison
        RETURN CASE v_op
            WHEN '==' THEN p_user_state->>v_variable = p_condition->>'value'
            WHEN '!=' THEN p_user_state->>v_variable != p_condition->>'value'
        END;
    END IF;

    v_user_value := COALESCE((p_user_state->>v_variable)::NUMERIC, 0);

    -- Evaluate comparison
    RETURN CASE v_op
        WHEN '<=' THEN v_user_value <= v_threshold
        WHEN '>=' THEN v_user_value >= v_threshold
        WHEN '<' THEN v_user_value < v_threshold
        WHEN '>' THEN v_user_value > v_threshold
        WHEN '==' THEN v_user_value = v_threshold
        WHEN '!=' THEN v_user_value != v_threshold
        ELSE FALSE
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get all matching modifiers for a user state
CREATE OR REPLACE FUNCTION get_matching_modifiers(
    p_user_state JSONB
)
RETURNS TABLE (
    modifier_id UUID,
    modifier_name TEXT,
    modifier_type TEXT,
    modifier_params JSONB,
    affects_phases TEXT[],
    reason TEXT,
    priority INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sm.id AS modifier_id,
        sm.modifier_name,
        sm.modifier_type,
        sm.modifier_params,
        sm.affects_phases,
        sm.reason,
        sm.priority
    FROM session_modifiers sm
    WHERE sm.is_active = TRUE
      AND evaluate_condition(sm.condition_pattern, p_user_state)
    ORDER BY sm.priority DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment modifier trigger count
CREATE OR REPLACE FUNCTION increment_modifier_triggered(p_modifier_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE session_modifiers
    SET times_triggered = times_triggered + 1,
        updated_at = NOW()
    WHERE id = p_modifier_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE session_modifiers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read modifiers
CREATE POLICY "Modifiers readable by authenticated users"
ON session_modifiers FOR SELECT
TO authenticated
USING (is_active = TRUE);

-- Coaches can manage modifiers
CREATE POLICY "Coaches can manage modifiers"
ON session_modifiers FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'coach'
    )
);

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE session_modifiers IS 'Session modifiers that adjust templates based on user state. Each modifier has a condition pattern and modification parameters.';
COMMENT ON COLUMN session_modifiers.condition_pattern IS 'JSONB condition pattern. Simple: {"variable": "x", "op": "<=", "value": 4}. Complex: {"ALL": [...]} or {"ANY": [...]}';
COMMENT ON COLUMN session_modifiers.modifier_type IS 'Type of modification: duration_scale, intensity_cap, exercise_swap, phase_inject, rest_scale, volume_scale, warmup_extend, cooldown_extend, exercise_remove, intensity_reduce, add_breathing, add_mobility, flag_warning';
COMMENT ON FUNCTION evaluate_condition(JSONB, JSONB) IS 'Evaluates a condition pattern against user state. Handles ALL/ANY combinators and comparison operators.';
COMMENT ON FUNCTION get_matching_modifiers(JSONB) IS 'Returns all modifiers whose conditions match the given user state, ordered by priority.';
