-- Migration: Session Base Templates
-- Layer 2: Logic Core - Database-driven templates with versioning
-- Provides the foundation for parametric session compilation

-- ============================================================================
-- 1. SESSION BASE TEMPLATES TABLE
-- ============================================================================
-- Robust templates that can be selected based on session type and user state

CREATE TABLE IF NOT EXISTS session_base_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    version INT DEFAULT 1,

    -- Template structure with detailed phases
    base_structure JSONB NOT NULL,
    /*
    Structure format:
    {
        "warmup": {
            "duration_min": 20,
            "intensity_target": 4,
            "description": "Progressive activation",
            "phases": [
                {
                    "name": "cardio_activation",
                    "generic_exercise": "warmup_cardio",
                    "duration": 5,
                    "intensity": "RPE 2-3",
                    "notes": "Light cardio to raise HR"
                },
                ...
            ]
        },
        "main": {...},
        "cooldown": {...}
    }
    */

    -- When to use this template
    applicable_session_types TEXT[] NOT NULL,  -- ['project', 'performance']
    energy_range INT4RANGE,                     -- [6, 10] = requires energy 6-10
    soreness_max INT,                           -- Max soreness level for this template

    -- Template metadata
    description TEXT,
    target_outcome TEXT,                        -- What this template optimizes for
    typical_duration_min INT,
    intensity_profile TEXT CHECK (intensity_profile IN ('low', 'moderate', 'high', 'variable')),

    -- Source tracking
    source TEXT DEFAULT 'scaffold' CHECK (source IN ('expert', 'literature', 'scaffold', 'hybrid')),
    n_expert_validations INT DEFAULT 0,
    expert_scenario_ids UUID[],
    literature_references TEXT[],

    -- Quality metrics
    avg_effectiveness_rating FLOAT,
    times_used INT DEFAULT 0,
    positive_feedback_count INT DEFAULT 0,
    negative_feedback_count INT DEFAULT 0,

    -- Versioning
    is_active BOOLEAN DEFAULT TRUE,
    superseded_by UUID REFERENCES session_base_templates(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique template names per version
    UNIQUE(template_name, version)
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_templates_name ON session_base_templates(template_name);
CREATE INDEX IF NOT EXISTS idx_templates_session_types ON session_base_templates USING GIN (applicable_session_types);
CREATE INDEX IF NOT EXISTS idx_templates_active ON session_base_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_templates_source ON session_base_templates(source);

-- ============================================================================
-- 2. SEED ROBUST BASE TEMPLATES
-- ============================================================================

INSERT INTO session_base_templates (
    template_name, applicable_session_types, energy_range, soreness_max,
    description, target_outcome, typical_duration_min, intensity_profile,
    source, base_structure
) VALUES

-- Limit Bouldering Template (High Energy Required)
(
    'limit_bouldering',
    ARRAY['project', 'performance'],
    '[7,10]'::INT4RANGE,
    5,
    'Maximum effort bouldering focused on limit-level problems. Requires optimal recovery state.',
    'Send hard projects, peak performance',
    90,
    'high',
    'literature',
    '{
        "warmup": {
            "duration_min": 20,
            "intensity_target": 4,
            "description": "Extended neural activation for high-intensity session",
            "phases": [
                {
                    "name": "cardio_activation",
                    "generic_exercise": "warmup_cardio",
                    "duration": 5,
                    "intensity": "RPE 3-4",
                    "notes": "Jump rope, light jogging, or rowing to elevate HR"
                },
                {
                    "name": "dynamic_mobility",
                    "generic_exercise": "mobility_dynamic",
                    "duration": 5,
                    "intensity": "RPE 2-3",
                    "notes": "Arm circles, hip circles, leg swings, shoulder rotations"
                },
                {
                    "name": "climbing_specific_prep",
                    "generic_exercise": "warmup_climbing",
                    "duration": 10,
                    "intensity": "RPE 3-5",
                    "sets": 3,
                    "notes": "Progressive difficulty: V0 -> V2 -> V4 or equivalent"
                }
            ]
        },
        "main": {
            "duration_min": 50,
            "intensity_target": 9,
            "description": "Limit-level attempts with full recovery between efforts",
            "phases": [
                {
                    "name": "pyramids",
                    "generic_exercise": "main_climbing",
                    "duration": 10,
                    "intensity": "RPE 6-7",
                    "notes": "Build to project-level intensity gradually"
                },
                {
                    "name": "limit_attempts",
                    "generic_exercise": "limit_attempts",
                    "sets": 5,
                    "reps": "2-3 quality attempts",
                    "rest": "4-5 min",
                    "intensity": "RPE 9-10",
                    "notes": "Full effort, full rest. Quality over quantity."
                },
                {
                    "name": "backup_projects",
                    "generic_exercise": "main_climbing",
                    "sets": 3,
                    "reps": "1-2 attempts",
                    "rest": "3 min",
                    "intensity": "RPE 8-9",
                    "notes": "Slightly easier problems to maintain quality when fatigued"
                }
            ]
        },
        "cooldown": {
            "duration_min": 15,
            "intensity_target": 2,
            "description": "Extended recovery protocol for high-intensity session",
            "phases": [
                {
                    "name": "flush_arms",
                    "generic_exercise": "cooldown_active",
                    "duration": 5,
                    "intensity": "RPE 2",
                    "notes": "Very easy jugs to flush lactic acid"
                },
                {
                    "name": "forearm_care",
                    "generic_exercise": "cooldown_mobility",
                    "duration": 3,
                    "notes": "Self-massage or foam roll forearms"
                },
                {
                    "name": "stretching",
                    "generic_exercise": "cooldown_stretch",
                    "duration": 7,
                    "notes": "Hold each stretch 45-60 seconds. Focus on forearms, shoulders, hips."
                }
            ]
        }
    }'
),

-- Technique Focus Template (Moderate Energy)
(
    'technique_focus',
    ARRAY['technique', 'skill_development'],
    '[4,10]'::INT4RANGE,
    7,
    'Movement quality and skill development session. Works at any energy level.',
    'Improve movement efficiency and technique',
    75,
    'moderate',
    'literature',
    '{
        "warmup": {
            "duration_min": 15,
            "intensity_target": 3,
            "description": "Standard activation with movement focus",
            "phases": [
                {
                    "name": "cardio_activation",
                    "generic_exercise": "warmup_cardio",
                    "duration": 3,
                    "intensity": "RPE 3",
                    "notes": "Light cardio to wake up the body"
                },
                {
                    "name": "dynamic_mobility",
                    "generic_exercise": "mobility_dynamic",
                    "duration": 5,
                    "notes": "Focus on hip mobility and shoulder activation"
                },
                {
                    "name": "movement_drills",
                    "generic_exercise": "technique_drills",
                    "duration": 7,
                    "intensity": "RPE 3-4",
                    "notes": "Silent feet, hover hands, precision footwork drills"
                }
            ]
        },
        "main": {
            "duration_min": 45,
            "intensity_target": 5,
            "description": "Deliberate practice 2-3 grades below limit",
            "phases": [
                {
                    "name": "movement_patterns",
                    "generic_exercise": "technique_drills",
                    "duration": 15,
                    "intensity": "RPE 4-5",
                    "notes": "Work specific weaknesses: heel hooks, drop knees, mantles, etc."
                },
                {
                    "name": "deliberate_climbing",
                    "generic_exercise": "main_climbing",
                    "duration": 25,
                    "intensity": "RPE 5-6",
                    "notes": "Problems 2-3 grades below max. Focus on perfect execution, not sends."
                },
                {
                    "name": "video_review",
                    "generic_exercise": "technique_analysis",
                    "duration": 5,
                    "notes": "Record attempts and analyze body positioning"
                }
            ]
        },
        "cooldown": {
            "duration_min": 10,
            "intensity_target": 1,
            "phases": [
                {
                    "name": "easy_traversing",
                    "generic_exercise": "cooldown_active",
                    "duration": 3,
                    "intensity": "RPE 2",
                    "notes": "Easy traverse to keep blood flowing"
                },
                {
                    "name": "stretching",
                    "generic_exercise": "cooldown_stretch",
                    "duration": 7,
                    "notes": "Full body stretch focusing on hip flexors and shoulders"
                }
            ]
        }
    }'
),

-- Volume/Endurance Template
(
    'volume_endurance',
    ARRAY['endurance', 'volume', 'fitness'],
    '[5,10]'::INT4RANGE,
    6,
    'High volume, moderate intensity session for building work capacity.',
    'Build climbing endurance and work capacity',
    90,
    'moderate',
    'literature',
    '{
        "warmup": {
            "duration_min": 15,
            "intensity_target": 4,
            "phases": [
                {
                    "name": "cardio_activation",
                    "generic_exercise": "warmup_cardio",
                    "duration": 5,
                    "intensity": "RPE 4",
                    "notes": "Slightly longer cardio to prepare for volume"
                },
                {
                    "name": "dynamic_mobility",
                    "generic_exercise": "mobility_dynamic",
                    "duration": 5
                },
                {
                    "name": "progressive_climbing",
                    "generic_exercise": "warmup_climbing",
                    "duration": 5,
                    "sets": 4,
                    "notes": "Quick progression through easier grades"
                }
            ]
        },
        "main": {
            "duration_min": 60,
            "intensity_target": 6,
            "description": "High volume climbing with moderate intensity",
            "phases": [
                {
                    "name": "volume_block_1",
                    "generic_exercise": "main_climbing",
                    "duration": 20,
                    "intensity": "RPE 5-6",
                    "notes": "Steady climbing, short rests between problems"
                },
                {
                    "name": "rest_interval",
                    "duration": 5,
                    "notes": "Hydrate and shake out"
                },
                {
                    "name": "volume_block_2",
                    "generic_exercise": "main_climbing",
                    "duration": 20,
                    "intensity": "RPE 6-7",
                    "notes": "Push slightly harder while maintaining volume"
                },
                {
                    "name": "rest_interval",
                    "duration": 5,
                    "notes": "Hydrate and shake out"
                },
                {
                    "name": "finisher_circuits",
                    "generic_exercise": "endurance_circuits",
                    "duration": 10,
                    "intensity": "RPE 7-8",
                    "notes": "4x4s or similar high-volume finisher"
                }
            ]
        },
        "cooldown": {
            "duration_min": 10,
            "intensity_target": 1,
            "phases": [
                {
                    "name": "flush",
                    "generic_exercise": "cooldown_active",
                    "duration": 3
                },
                {
                    "name": "stretching",
                    "generic_exercise": "cooldown_stretch",
                    "duration": 7,
                    "notes": "Focus on forearms given high volume"
                }
            ]
        }
    }'
),

-- Recovery/Low Energy Template
(
    'recovery_session',
    ARRAY['recovery', 'active_recovery', 'deload'],
    '[1,10]'::INT4RANGE,
    10,
    'Active recovery session for high fatigue or soreness days.',
    'Promote recovery while maintaining movement',
    60,
    'low',
    'literature',
    '{
        "warmup": {
            "duration_min": 10,
            "intensity_target": 2,
            "description": "Gentle activation, no pushing",
            "phases": [
                {
                    "name": "gentle_cardio",
                    "generic_exercise": "warmup_cardio",
                    "duration": 5,
                    "intensity": "RPE 2",
                    "notes": "Walking or very light cycling"
                },
                {
                    "name": "mobility_focus",
                    "generic_exercise": "mobility_dynamic",
                    "duration": 5,
                    "notes": "Gentle mobility work, nothing aggressive"
                }
            ]
        },
        "main": {
            "duration_min": 35,
            "intensity_target": 3,
            "description": "Very easy climbing focused on movement pleasure",
            "phases": [
                {
                    "name": "easy_traversing",
                    "generic_exercise": "main_climbing",
                    "duration": 15,
                    "intensity": "RPE 2-3",
                    "notes": "Stay on big holds, focus on fluid movement"
                },
                {
                    "name": "mobility_climbing",
                    "generic_exercise": "technique_drills",
                    "duration": 10,
                    "intensity": "RPE 3",
                    "notes": "Use climbing as active stretching"
                },
                {
                    "name": "play_exploration",
                    "generic_exercise": "main_climbing",
                    "duration": 10,
                    "intensity": "RPE 3-4",
                    "notes": "Try new movement patterns, no pressure"
                }
            ]
        },
        "cooldown": {
            "duration_min": 15,
            "intensity_target": 1,
            "description": "Extended recovery and mobility work",
            "phases": [
                {
                    "name": "extended_stretching",
                    "generic_exercise": "cooldown_stretch",
                    "duration": 10,
                    "notes": "Hold stretches for 60-90 seconds"
                },
                {
                    "name": "breathing_reset",
                    "generic_exercise": "breathing_exercises",
                    "duration": 5,
                    "notes": "Box breathing to activate parasympathetic nervous system"
                }
            ]
        }
    }'
),

-- Strength/Power Template
(
    'strength_power',
    ARRAY['strength', 'power', 'max_hangs'],
    '[6,10]'::INT4RANGE,
    5,
    'Focused strength and power development with supplemental training.',
    'Build finger strength and explosive power',
    90,
    'high',
    'literature',
    '{
        "warmup": {
            "duration_min": 20,
            "intensity_target": 4,
            "description": "Thorough warmup especially for fingers",
            "phases": [
                {
                    "name": "cardio_activation",
                    "generic_exercise": "warmup_cardio",
                    "duration": 5,
                    "intensity": "RPE 3-4"
                },
                {
                    "name": "finger_prep",
                    "generic_exercise": "finger_prep",
                    "duration": 8,
                    "notes": "Rice bucket, finger rolls, progressive loading"
                },
                {
                    "name": "climbing_activation",
                    "generic_exercise": "warmup_climbing",
                    "duration": 7,
                    "intensity": "RPE 4-5",
                    "notes": "Build to near-max holds gradually"
                }
            ]
        },
        "main": {
            "duration_min": 50,
            "intensity_target": 8,
            "description": "Structured strength protocol",
            "phases": [
                {
                    "name": "max_hangs",
                    "generic_exercise": "hangboard_max",
                    "sets": 5,
                    "reps": "7-10s hangs",
                    "rest": "3 min",
                    "intensity": "RPE 8-9",
                    "notes": "20mm edge, add weight to reach target intensity"
                },
                {
                    "name": "power_movements",
                    "generic_exercise": "main_climbing",
                    "duration": 20,
                    "intensity": "RPE 8",
                    "notes": "Campus-style moves, powerful problems, dynamic climbing"
                },
                {
                    "name": "limit_bouldering",
                    "generic_exercise": "limit_attempts",
                    "sets": 3,
                    "rest": "4 min",
                    "intensity": "RPE 9",
                    "notes": "Hard problems focusing on power application"
                }
            ]
        },
        "cooldown": {
            "duration_min": 15,
            "intensity_target": 2,
            "phases": [
                {
                    "name": "antagonist_work",
                    "generic_exercise": "antagonist_exercises",
                    "duration": 8,
                    "notes": "Push-ups, reverse wrist curls, external rotation"
                },
                {
                    "name": "stretching",
                    "generic_exercise": "cooldown_stretch",
                    "duration": 7,
                    "notes": "Focus on finger flexors and shoulders"
                }
            ]
        }
    }'
),

-- Mixed/General Session Template
(
    'general_session',
    ARRAY['mixed', 'general', 'casual'],
    '[3,10]'::INT4RANGE,
    8,
    'Balanced session for general climbing without specific goals.',
    'Enjoy climbing, maintain fitness',
    75,
    'variable',
    'scaffold',
    '{
        "warmup": {
            "duration_min": 15,
            "intensity_target": 3,
            "phases": [
                {
                    "name": "general_activation",
                    "generic_exercise": "warmup_cardio",
                    "duration": 5,
                    "intensity": "RPE 3"
                },
                {
                    "name": "dynamic_mobility",
                    "generic_exercise": "mobility_dynamic",
                    "duration": 5
                },
                {
                    "name": "progressive_climbing",
                    "generic_exercise": "warmup_climbing",
                    "duration": 5,
                    "intensity": "RPE 3-4"
                }
            ]
        },
        "main": {
            "duration_min": 45,
            "intensity_target": 6,
            "description": "Self-directed climbing based on feel",
            "phases": [
                {
                    "name": "main_climbing",
                    "generic_exercise": "main_climbing",
                    "duration": 40,
                    "intensity": "RPE 5-7",
                    "notes": "Climb what feels good, listen to your body"
                },
                {
                    "name": "optional_challenges",
                    "generic_exercise": "main_climbing",
                    "duration": 5,
                    "intensity": "RPE 7-8",
                    "notes": "Optional: push slightly if feeling good"
                }
            ]
        },
        "cooldown": {
            "duration_min": 10,
            "intensity_target": 1,
            "phases": [
                {
                    "name": "easy_movement",
                    "generic_exercise": "cooldown_active",
                    "duration": 3
                },
                {
                    "name": "stretching",
                    "generic_exercise": "cooldown_stretch",
                    "duration": 7
                }
            ]
        }
    }'
);

-- ============================================================================
-- 3. FUNCTIONS FOR TEMPLATE SELECTION
-- ============================================================================

-- Function to get the best matching template for a session type and user state
CREATE OR REPLACE FUNCTION get_matching_template(
    p_session_type TEXT,
    p_energy_level INT,
    p_soreness_level INT DEFAULT 5
)
RETURNS TABLE (
    template_id UUID,
    template_name TEXT,
    base_structure JSONB,
    source TEXT,
    match_score INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sbt.id AS template_id,
        sbt.template_name,
        sbt.base_structure,
        sbt.source,
        -- Calculate match score (higher is better)
        (
            CASE WHEN p_session_type = ANY(sbt.applicable_session_types) THEN 100 ELSE 0 END +
            CASE WHEN p_energy_level <@ sbt.energy_range THEN 50 ELSE 0 END +
            CASE WHEN p_soreness_level <= COALESCE(sbt.soreness_max, 10) THEN 25 ELSE 0 END +
            sbt.n_expert_validations * 5
        ) AS match_score
    FROM session_base_templates sbt
    WHERE sbt.is_active = TRUE
      AND (p_session_type = ANY(sbt.applicable_session_types) OR 'general' = ANY(sbt.applicable_session_types))
    ORDER BY match_score DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage(p_template_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE session_base_templates
    SET times_used = times_used + 1,
        updated_at = NOW()
    WHERE id = p_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE session_base_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read templates
CREATE POLICY "Templates readable by authenticated users"
ON session_base_templates FOR SELECT
TO authenticated
USING (is_active = TRUE);

-- Coaches can manage templates
CREATE POLICY "Coaches can manage templates"
ON session_base_templates FOR ALL
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

COMMENT ON TABLE session_base_templates IS 'Database-driven session templates with versioning. Selected based on session type and user state. Foundation for parametric compilation.';
COMMENT ON COLUMN session_base_templates.base_structure IS 'JSONB structure with warmup/main/cooldown phases. Each phase has duration_min, intensity_target, and phases array with generic_exercise references.';
COMMENT ON COLUMN session_base_templates.generic_exercise IS 'Generic exercise names (e.g., warmup_cardio, finger_prep) that map to specific exercises via exercise_variants table.';
