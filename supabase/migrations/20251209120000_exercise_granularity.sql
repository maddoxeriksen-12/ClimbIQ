-- Migration: Exercise Granularity Injection
-- Layer 2: Logic Core - Maps generic exercises to specific variants
-- Enables expert-derived exercise personalization based on user state

-- ============================================================================
-- 1. EXERCISE VARIANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS exercise_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What generic exercise this is a variant of
    generic_exercise TEXT NOT NULL,  -- 'warmup_cardio', 'finger_prep', 'main_climbing'

    -- The specific variant name
    specific_exercise TEXT NOT NULL,  -- 'jump_rope', 'rice_bucket', 'moonboard_projecting'

    -- When to select this variant
    condition_pattern JSONB NOT NULL,  -- Same format as modifiers

    -- Full exercise specification
    exercise_spec JSONB NOT NULL,
    /*
    Format:
    {
        "name": "Progressive Hangboard",
        "sets": 3,
        "reps": "10s hangs",
        "rest": "2 min",
        "duration": null,
        "intensity": "RPE 6-7",
        "notes": "20mm edge, body weight to start",
        "video_url": null,
        "equipment_required": ["hangboard"],
        "muscle_focus": ["finger_flexors"],
        "contraindications": ["acute_finger_injury"]
    }
    */

    -- Source tracking
    expert_scenario_ids UUID[],
    n_recommendations INT DEFAULT 0,       -- How many times experts recommended this
    avg_effectiveness_rating FLOAT,        -- Avg rating from post-session feedback

    -- Priority (higher = preferred when multiple match)
    priority INT DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),

    -- Metadata
    source_type TEXT DEFAULT 'scaffold' CHECK (source_type IN ('expert', 'literature', 'scaffold')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique variant names per generic exercise
    UNIQUE(generic_exercise, specific_exercise)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_variants_generic ON exercise_variants(generic_exercise);
CREATE INDEX IF NOT EXISTS idx_variants_active ON exercise_variants(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_variants_conditions ON exercise_variants USING GIN (condition_pattern);
CREATE INDEX IF NOT EXISTS idx_variants_priority ON exercise_variants(priority DESC);

-- ============================================================================
-- 2. SEED EXERCISE VARIANTS (Expert-Derived Granularity)
-- ============================================================================

INSERT INTO exercise_variants (
    generic_exercise, specific_exercise, condition_pattern, exercise_spec,
    priority, source_type, n_recommendations
) VALUES

-- ============================================================================
-- WARMUP CARDIO VARIANTS
-- ============================================================================
(
    'warmup_cardio', 'jump_rope',
    '{}',  -- Default/fallback
    '{"name": "Jump Rope", "duration": "3-5 min", "intensity": "RPE 3-4", "notes": "Light and rhythmic, focus on coordination", "equipment_required": ["jump_rope"]}',
    40,
    'scaffold',
    0
),
(
    'warmup_cardio', 'rowing_machine',
    '{"variable": "gym_crowdedness", "op": "<=", "value": 5}',
    '{"name": "Rowing Machine", "duration": "5 min", "intensity": "RPE 3-4", "notes": "Full body activation, moderate pace", "equipment_required": ["rowing_machine"]}',
    50,
    'scaffold',
    0
),
(
    'warmup_cardio', 'easy_traverse',
    '{"variable": "gym_crowdedness", "op": ">=", "value": 7}',
    '{"name": "Easy Wall Traverse", "duration": "5 min", "intensity": "RPE 3", "notes": "Stay on biggest holds, climbing-specific warmup"}',
    60,
    'scaffold',
    0
),
(
    'warmup_cardio', 'light_jogging_stairs',
    '{"variable": "time_of_day", "op": "==", "value": "morning"}',
    '{"name": "Light Jog + Stair Climbs", "duration": "5 min", "intensity": "RPE 3-4", "notes": "Morning sessions need more cardio to raise core temp"}',
    55,
    'scaffold',
    0
),

-- ============================================================================
-- FINGER PREP VARIANTS
-- ============================================================================
(
    'finger_prep', 'gentle_rice_bucket',
    '{"variable": "finger_tendon_health", "op": "<=", "value": 4}',
    '{"name": "Gentle Rice Bucket", "duration": "3 min", "intensity": "RPE 1-2", "notes": "Submerge hands, gentle open/close, finger extensions", "equipment_required": ["rice_bucket"], "muscle_focus": ["finger_extensors", "finger_flexors"], "contraindications": []}',
    90,
    'expert',
    5
),
(
    'finger_prep', 'progressive_hangs',
    '{"variable": "finger_tendon_health", "op": ">=", "value": 7}',
    '{"name": "Progressive Hangboard Hangs", "sets": 3, "reps": "10s hangs", "rest": "1 min", "intensity": "RPE 5-6", "notes": "20mm edge, add weight if easy. Build to working intensity.", "equipment_required": ["hangboard"], "muscle_focus": ["finger_flexors"]}',
    80,
    'expert',
    8
),
(
    'finger_prep', 'moderate_finger_warmup',
    '{"ALL": [{"variable": "finger_tendon_health", "op": ">", "value": 4}, {"variable": "finger_tendon_health", "op": "<", "value": 7}]}',
    '{"name": "Moderate Finger Warmup", "sets": 2, "reps": "15s hangs", "rest": "45s", "intensity": "RPE 3-4", "notes": "Large edge (25mm+), body weight only, focus on blood flow", "equipment_required": ["hangboard"]}',
    75,
    'scaffold',
    0
),
(
    'finger_prep', 'finger_rolls_and_stretches',
    '{"ANY": [{"variable": "finger_tendon_health", "op": "<=", "value": 5}, {"variable": "previous_injury", "op": "==", "value": "finger"}]}',
    '{"name": "Finger Rolls & Stretches", "duration": "5 min", "intensity": "RPE 1-2", "notes": "Rubber band extensions, wrist circles, gentle stretches. No loading."}',
    85,
    'expert',
    3
),

-- ============================================================================
-- MAIN CLIMBING VARIANTS
-- ============================================================================
(
    'main_climbing', 'moonboard_projecting',
    '{"ALL": [{"variable": "primary_goal", "op": "==", "value": "project"}, {"variable": "energy_level", "op": ">=", "value": 7}]}',
    '{"name": "Moonboard Projecting", "sets": "5-7", "rest": "4-5 min", "intensity": "RPE 9-10", "notes": "Work limit-level problems with full rest between attempts", "equipment_required": ["moonboard"]}',
    85,
    'expert',
    12
),
(
    'main_climbing', 'technique_drills',
    '{"ANY": [{"variable": "primary_goal", "op": "==", "value": "technique"}, {"variable": "energy_level", "op": "<=", "value": 5}]}',
    '{"name": "Technique Drill Circuits", "duration": "30 min", "intensity": "RPE 5-6", "notes": "2-3 grades below max, focus on perfect execution. Silent feet, precise hand placement."}',
    75,
    'expert',
    7
),
(
    'main_climbing', 'spray_wall_creativity',
    '{"ALL": [{"variable": "motivation", "op": ">=", "value": 8}, {"variable": "energy_level", "op": ">=", "value": 6}]}',
    '{"name": "Spray Wall Creative Session", "duration": "40 min", "intensity": "RPE 6-8", "notes": "Set your own problems, try new movements, have fun", "equipment_required": ["spray_wall"]}',
    70,
    'scaffold',
    0
),
(
    'main_climbing', 'volume_pyramids',
    '{"variable": "primary_goal", "op": "==", "value": "endurance"}',
    '{"name": "Volume Pyramids", "duration": "35 min", "intensity": "RPE 6-7", "notes": "Climb up in difficulty then back down. Minimize rest between problems."}',
    75,
    'literature',
    0
),
(
    'main_climbing', 'strength_focused_problems',
    '{"ALL": [{"variable": "primary_goal", "op": "==", "value": "strength"}, {"variable": "finger_tendon_health", "op": ">=", "value": 6}]}',
    '{"name": "Strength-Focused Problems", "sets": 4, "reps": "2-3 attempts", "rest": "4 min", "intensity": "RPE 8-9", "notes": "Select problems with powerful moves. Quality over quantity."}',
    80,
    'expert',
    6
),
(
    'main_climbing', 'recovery_climbing',
    '{"ANY": [{"variable": "energy_level", "op": "<=", "value": 3}, {"variable": "muscle_soreness", "op": ">=", "value": 8}]}',
    '{"name": "Recovery Climbing", "duration": "25 min", "intensity": "RPE 3-4", "notes": "Stay on big holds, focus on enjoying movement. This is active recovery."}',
    90,
    'expert',
    4
),

-- ============================================================================
-- LIMIT ATTEMPTS VARIANTS
-- ============================================================================
(
    'limit_attempts', 'standard_limit_protocol',
    '{}',
    '{"name": "Standard Limit Bouldering", "sets": 5, "reps": "2-3 quality attempts", "rest": "4-5 min", "intensity": "RPE 9-10", "notes": "Full effort on hard problems. Rest completely between attempts."}',
    50,
    'scaffold',
    0
),
(
    'limit_attempts', 'time_pressured_limits',
    '{"variable": "available_time", "op": "<=", "value": 60}',
    '{"name": "Focused Limit Attempts", "sets": 3, "reps": "2 attempts each", "rest": "3 min", "intensity": "RPE 9-10", "notes": "Limited time - focus on your #1 project only"}',
    70,
    'scaffold',
    0
),
(
    'limit_attempts', 'crowd_adjusted_limits',
    '{"variable": "gym_crowdedness", "op": ">=", "value": 7}',
    '{"name": "Opportunistic Limit Attempts", "sets": 4, "rest": "as available", "intensity": "RPE 9", "notes": "Jump on problems when open. Be ready to pivot if crowded."}',
    65,
    'scaffold',
    0
),

-- ============================================================================
-- TECHNIQUE DRILLS VARIANTS
-- ============================================================================
(
    'technique_drills', 'silent_feet',
    '{"variable": "technique_focus", "op": "==", "value": "footwork"}',
    '{"name": "Silent Feet Drills", "duration": "10 min", "intensity": "RPE 4", "notes": "No noise on foot placements. Develop precision and control."}',
    80,
    'expert',
    4
),
(
    'technique_drills', 'hover_hands',
    '{"variable": "technique_focus", "op": "==", "value": "efficiency"}',
    '{"name": "Hover Hands Drill", "duration": "10 min", "intensity": "RPE 4-5", "notes": "Pause hand 1 inch from hold before grabbing. Develops intentional movement."}',
    80,
    'expert',
    3
),
(
    'technique_drills', 'movement_vocab_expansion',
    '{}',
    '{"name": "Movement Vocabulary Expansion", "duration": "15 min", "intensity": "RPE 5", "notes": "Practice specific moves: heel hooks, drop knees, flags, gastons. 5 min per technique."}',
    60,
    'scaffold',
    0
),

-- ============================================================================
-- COOLDOWN VARIANTS
-- ============================================================================
(
    'cooldown_active', 'easy_jug_traverse',
    '{}',
    '{"name": "Easy Jug Traverse", "duration": "5 min", "intensity": "RPE 2", "notes": "Biggest holds, keep moving to flush lactic acid from forearms"}',
    50,
    'scaffold',
    0
),
(
    'cooldown_active', 'top_rope_burnout',
    '{"variable": "session_type", "op": "==", "value": "endurance"}',
    '{"name": "Top Rope Easy Mileage", "duration": "10 min", "intensity": "RPE 3", "notes": "Easy routes to flush and add volume. Stop if pumped."}',
    60,
    'scaffold',
    0
),

(
    'cooldown_stretch', 'full_body_stretch',
    '{}',
    '{"name": "Full Body Stretch Routine", "duration": "7-10 min", "intensity": "RPE 1", "notes": "Hold each stretch 45-60 seconds. Forearms, shoulders, hips, hamstrings."}',
    50,
    'scaffold',
    0
),
(
    'cooldown_stretch', 'forearm_focused_stretch',
    '{"ANY": [{"variable": "session_type", "op": "==", "value": "project"}, {"variable": "session_type", "op": "==", "value": "strength"}]}',
    '{"name": "Forearm-Focused Recovery", "duration": "10 min", "intensity": "RPE 1", "notes": "Extended forearm stretches, self-massage, wrist circles. Add ice if needed."}',
    70,
    'expert',
    5
),

-- ============================================================================
-- BREATHING EXERCISE VARIANTS
-- ============================================================================
(
    'breathing_exercises', 'box_breathing',
    '{"variable": "stress_level", "op": ">=", "value": 6}',
    '{"name": "Box Breathing", "duration": "5 min", "intensity": "RPE 1", "notes": "Inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat 6-8 cycles."}',
    80,
    'literature',
    0
),
(
    'breathing_exercises', 'physiological_sigh',
    '{"variable": "stress_level", "op": ">=", "value": 8}',
    '{"name": "Physiological Sighs", "duration": "3 min", "intensity": "RPE 1", "notes": "Double inhale through nose, long exhale through mouth. Most effective stress reset."}',
    90,
    'literature',
    0
),

-- ============================================================================
-- HANGBOARD VARIANTS
-- ============================================================================
(
    'hangboard_max', 'repeaters_protocol',
    '{"variable": "primary_goal", "op": "==", "value": "endurance"}',
    '{"name": "Repeaters Protocol", "sets": 6, "reps": "7s on / 3s off x 6", "rest": "3 min", "intensity": "RPE 7", "notes": "Medium edge, build local endurance. Stop if form breaks."}',
    75,
    'literature',
    0
),
(
    'hangboard_max', 'max_hangs_protocol',
    '{"ALL": [{"variable": "primary_goal", "op": "==", "value": "strength"}, {"variable": "finger_tendon_health", "op": ">=", "value": 7}]}',
    '{"name": "Max Hangs Protocol", "sets": 5, "reps": "10s hang", "rest": "3 min", "intensity": "RPE 9", "notes": "20mm edge, add weight to reach RPE 9. Full recovery between sets."}',
    85,
    'literature',
    0
),
(
    'hangboard_max', 'density_hangs',
    '{"variable": "available_time", "op": "<=", "value": 45}',
    '{"name": "Density Hangs (Short Session)", "sets": 4, "reps": "max hang time", "rest": "1 min", "intensity": "RPE 8", "notes": "Time efficient protocol. Hang to near failure each set."}',
    70,
    'scaffold',
    0
),

-- ============================================================================
-- ANTAGONIST EXERCISE VARIANTS
-- ============================================================================
(
    'antagonist_exercises', 'push_pull_balance',
    '{}',
    '{"name": "Push-Pull Balance", "sets": 3, "reps": "10-15", "rest": "30s", "intensity": "RPE 5-6", "notes": "Push-ups, reverse wrist curls, external rotation. Prevents imbalances."}',
    50,
    'literature',
    0
),
(
    'antagonist_exercises', 'finger_extensor_focus',
    '{"variable": "finger_tendon_health", "op": "<=", "value": 6}',
    '{"name": "Finger Extensor Emphasis", "sets": 3, "reps": "20 extensions", "intensity": "RPE 4", "notes": "Rubber band finger extensions, rice bucket. Balance flexor dominance."}',
    75,
    'expert',
    4
);

-- ============================================================================
-- 3. FUNCTIONS FOR EXERCISE SELECTION
-- ============================================================================

-- Function to get the best exercise variant for a generic exercise
CREATE OR REPLACE FUNCTION get_exercise_variant(
    p_generic_exercise TEXT,
    p_user_state JSONB
)
RETURNS TABLE (
    variant_id UUID,
    specific_exercise TEXT,
    exercise_spec JSONB,
    source_type TEXT,
    priority INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ev.id AS variant_id,
        ev.specific_exercise,
        ev.exercise_spec,
        ev.source_type,
        ev.priority
    FROM exercise_variants ev
    WHERE ev.generic_exercise = p_generic_exercise
      AND ev.is_active = TRUE
      AND (
          ev.condition_pattern = '{}'::JSONB  -- Empty = fallback
          OR evaluate_condition(ev.condition_pattern, p_user_state)
      )
    ORDER BY
        CASE WHEN ev.condition_pattern = '{}'::JSONB THEN 0 ELSE 1 END DESC,  -- Specific matches first
        ev.priority DESC,
        ev.n_recommendations DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all matching variants (for exploration/debugging)
CREATE OR REPLACE FUNCTION get_all_exercise_variants(
    p_generic_exercise TEXT,
    p_user_state JSONB
)
RETURNS TABLE (
    variant_id UUID,
    specific_exercise TEXT,
    exercise_spec JSONB,
    source_type TEXT,
    priority INT,
    matches_condition BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ev.id AS variant_id,
        ev.specific_exercise,
        ev.exercise_spec,
        ev.source_type,
        ev.priority,
        (ev.condition_pattern = '{}'::JSONB OR evaluate_condition(ev.condition_pattern, p_user_state)) AS matches_condition
    FROM exercise_variants ev
    WHERE ev.generic_exercise = p_generic_exercise
      AND ev.is_active = TRUE
    ORDER BY ev.priority DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record exercise variant usage and feedback
CREATE OR REPLACE FUNCTION record_exercise_feedback(
    p_variant_id UUID,
    p_effectiveness_rating FLOAT
)
RETURNS void AS $$
BEGIN
    UPDATE exercise_variants
    SET
        n_recommendations = n_recommendations + 1,
        avg_effectiveness_rating = CASE
            WHEN avg_effectiveness_rating IS NULL THEN p_effectiveness_rating
            ELSE (avg_effectiveness_rating * n_recommendations + p_effectiveness_rating) / (n_recommendations + 1)
        END,
        updated_at = NOW()
    WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE exercise_variants ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read variants
CREATE POLICY "Variants readable by authenticated users"
ON exercise_variants FOR SELECT
TO authenticated
USING (is_active = TRUE);

-- Coaches can manage variants
CREATE POLICY "Coaches can manage variants"
ON exercise_variants FOR ALL
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

COMMENT ON TABLE exercise_variants IS 'Maps generic exercise names to specific exercise variants based on user state. Enables expert-derived exercise personalization.';
COMMENT ON COLUMN exercise_variants.generic_exercise IS 'The generic exercise name from session templates (e.g., warmup_cardio, finger_prep, main_climbing).';
COMMENT ON COLUMN exercise_variants.specific_exercise IS 'The specific variant name (e.g., jump_rope, rice_bucket, moonboard_projecting).';
COMMENT ON COLUMN exercise_variants.exercise_spec IS 'Full specification: name, sets, reps, rest, duration, intensity, notes, equipment_required, muscle_focus, contraindications.';
COMMENT ON FUNCTION get_exercise_variant(TEXT, JSONB) IS 'Returns the best matching exercise variant for a generic exercise given user state.';
