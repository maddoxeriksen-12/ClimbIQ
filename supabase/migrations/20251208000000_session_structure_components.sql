-- Migration: Create session_structure_components table for component-based session composition
-- This table stores modular session structure blocks that can be mixed/matched based on conditions
-- Implements Google's feedback: conflict_group, intensity_score, resource budgeting support

-- Main components table
CREATE TABLE IF NOT EXISTS session_structure_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What phase this component belongs to
    phase TEXT NOT NULL CHECK (phase IN ('warmup', 'main', 'cooldown', 'hangboard', 'antagonist')),

    -- Component identity
    component_name TEXT NOT NULL,  -- e.g., 'extended_warmup', 'finger_prep', 'limit_bouldering_block'

    -- When to use this component
    -- Format: {"variable": "sleep_quality", "op": "<=", "value": 4}
    -- Or complex: {"ALL": [{...}, {...}]} or {"ANY": [{...}, {...}]}
    condition_pattern JSONB NOT NULL,

    -- The component content (strict schema enforced in code)
    -- Required: title, duration_min, intensity_score (0-10), exercises[]
    -- Each exercise: {name, duration?, sets?, reps?, rest?, intensity?, notes?}
    block_content JSONB NOT NULL,

    -- How this modifies the base
    composition_mode TEXT DEFAULT 'replace' CHECK (composition_mode IN (
        'replace',      -- Replace entire phase with this block
        'prepend',      -- Add before existing phase blocks
        'append',       -- Add after existing phase blocks
        'modify'        -- Merge properties into existing block
    )),

    -- Conflict prevention (from Google's feedback)
    -- Only one component per conflict_group is allowed
    conflict_group TEXT,  -- e.g., 'warmup_base' - prevents multiple base warmups

    -- Source tracking
    source_type TEXT DEFAULT 'scaffold' CHECK (source_type IN ('expert', 'literature', 'scaffold')),
    expert_scenario_ids UUID[] DEFAULT '{}',
    n_scenarios INT DEFAULT 0,

    -- Priority & quality
    priority INT DEFAULT 50,  -- Higher priority wins conflicts (0-100)
    confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes for efficient lookup
CREATE INDEX idx_components_phase ON session_structure_components(phase);
CREATE INDEX idx_components_active ON session_structure_components(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_components_conditions ON session_structure_components USING GIN (condition_pattern);
CREATE INDEX idx_components_conflict ON session_structure_components(conflict_group) WHERE conflict_group IS NOT NULL;
CREATE INDEX idx_components_source ON session_structure_components(source_type);

-- Seed scaffold fallback components (used when no expert components match)
INSERT INTO session_structure_components (
    phase, component_name, condition_pattern, block_content,
    composition_mode, conflict_group, source_type, priority, confidence
) VALUES
-- Generic warmup scaffold (lowest priority, matches all)
(
    'warmup', 'generic_warmup',
    '{}',  -- Empty condition = always matches as fallback
    '{
        "title": "General Warmup",
        "duration_min": 15,
        "intensity_score": 3,
        "focus": "activation",
        "exercises": [
            {"name": "Light cardio", "duration": "3-5 min", "notes": "Jump rope, easy jogging, or rowing"},
            {"name": "Dynamic stretching", "duration": "5 min", "notes": "Arm circles, leg swings, hip circles"},
            {"name": "Easy climbing", "duration": "5-7 min", "intensity": "RPE 3-4", "notes": "Routes well below your limit"}
        ]
    }',
    'replace', 'warmup_base', 'scaffold', 10, 'medium'
),

-- Generic main block scaffold
(
    'main', 'generic_main',
    '{}',
    '{
        "title": "Main Climbing Block",
        "duration_min": 45,
        "intensity_score": 6,
        "focus": "climbing",
        "exercises": [
            {"name": "Progressive difficulty", "duration": "30-40 min", "intensity": "RPE 6-8", "notes": "Work toward session goal"},
            {"name": "Quality attempts", "sets": 3, "reps": "2-3 attempts", "rest": "3-5 min", "notes": "Focus on movement quality"}
        ]
    }',
    'replace', 'main_base', 'scaffold', 10, 'medium'
),

-- Generic cooldown scaffold
(
    'cooldown', 'generic_cooldown',
    '{}',
    '{
        "title": "Cooldown & Reset",
        "duration_min": 10,
        "intensity_score": 1,
        "focus": "recovery",
        "exercises": [
            {"name": "Easy movement", "duration": "3-5 min", "notes": "Very easy climbing or walking"},
            {"name": "Static stretching", "duration": "5-7 min", "notes": "Hold stretches 30-60 seconds"},
            {"name": "Deep breathing", "duration": "2 min", "notes": "Box breathing to activate recovery"}
        ]
    }',
    'replace', 'cooldown_base', 'scaffold', 10, 'medium'
),

-- Expert-derived: Extended warmup when sleep is poor
(
    'warmup', 'extended_warmup_low_sleep',
    '{"variable": "sleep_quality", "op": "<=", "value": 4}',
    '{
        "title": "Extended Neural Activation",
        "duration_min": 20,
        "intensity_score": 3,
        "focus": "activation",
        "exercises": [
            {"name": "Extended light cardio", "duration": "5-7 min", "notes": "Get blood flowing, wake up the system"},
            {"name": "Dynamic mobility", "duration": "5 min", "notes": "Focus on hip flexors and shoulders"},
            {"name": "Progressive easy climbing", "duration": "10-12 min", "intensity": "RPE 3-4", "notes": "Very gradual difficulty build to activate sluggish motor patterns"}
        ]
    }',
    'replace', 'warmup_base', 'expert', 80, 'high'
),

-- Expert-derived: Finger prep when tendon health is compromised
(
    'warmup', 'finger_prep_compromised',
    '{"variable": "finger_tendon_health", "op": "<=", "value": 5}',
    '{
        "title": "Finger-Specific Preparation",
        "duration_min": 8,
        "intensity_score": 2,
        "focus": "tendon",
        "exercises": [
            {"name": "Rice bucket", "duration": "2 min", "notes": "Gentle finger extensions and flexions"},
            {"name": "Finger rolls", "sets": 2, "reps": "10 each direction", "notes": "Slow, controlled movement"},
            {"name": "Large edge hangs", "sets": 3, "reps": "10s hangs", "rest": "1 min", "intensity": "RPE 2-3", "notes": "Body weight only, stop if any pain"}
        ]
    }',
    'append', NULL, 'expert', 75, 'high'
),

-- Expert-derived: Breathing exercises for high stress
(
    'warmup', 'stress_breathing',
    '{"variable": "stress_level", "op": ">=", "value": 7}',
    '{
        "title": "Stress Release Breathing",
        "duration_min": 5,
        "intensity_score": 1,
        "focus": "mental",
        "exercises": [
            {"name": "Box breathing", "sets": 4, "reps": "4-4-4-4 cycles", "notes": "Inhale 4s, hold 4s, exhale 4s, hold 4s"},
            {"name": "Progressive muscle relaxation", "duration": "2 min", "notes": "Tense and release forearms, shoulders"}
        ]
    }',
    'prepend', NULL, 'expert', 70, 'high'
),

-- Expert-derived: Gentle main block for high soreness
(
    'main', 'technique_focus_sore',
    '{"ALL": [{"variable": "muscle_soreness", "op": ">=", "value": 6}, {"variable": "energy_level", "op": "<=", "value": 5}]}',
    '{
        "title": "Technique & Movement Focus",
        "duration_min": 40,
        "intensity_score": 4,
        "focus": "technique",
        "exercises": [
            {"name": "Movement drills", "duration": "15 min", "intensity": "RPE 4-5", "notes": "Focus on body positioning, not difficulty"},
            {"name": "Deliberate practice", "duration": "20 min", "intensity": "RPE 5", "notes": "Work problems 2-3 grades below max"},
            {"name": "Video review", "duration": "5 min", "notes": "Record and analyze movement patterns"}
        ]
    }',
    'replace', 'main_base', 'expert', 85, 'high'
),

-- Expert-derived: Project session for high energy/motivation
(
    'main', 'limit_bouldering_block',
    '{"ALL": [{"variable": "energy_level", "op": ">=", "value": 7}, {"variable": "motivation", "op": ">=", "value": 7}]}',
    '{
        "title": "Limit Bouldering",
        "duration_min": 50,
        "intensity_score": 9,
        "focus": "power",
        "exercises": [
            {"name": "Warmup pyramids", "duration": "10 min", "notes": "Build up to project-level intensity"},
            {"name": "Project attempts", "sets": 5, "reps": "2-3 quality attempts", "rest": "4-5 min", "intensity": "RPE 9-10", "notes": "Full effort, full rest"},
            {"name": "Backup projects", "sets": 3, "reps": "1-2 attempts", "rest": "3 min", "notes": "Slightly easier problems to maintain quality"}
        ]
    }',
    'replace', 'main_base', 'expert', 90, 'high'
),

-- Expert-derived: Extended cooldown after intense session
(
    'cooldown', 'extended_recovery_cooldown',
    '{"variable": "session_type", "op": "==", "value": "project"}',
    '{
        "title": "Extended Recovery Protocol",
        "duration_min": 15,
        "intensity_score": 1,
        "focus": "recovery",
        "exercises": [
            {"name": "Very easy climbing", "duration": "5 min", "intensity": "RPE 2", "notes": "Flush the arms with easy jugs"},
            {"name": "Forearm massage", "duration": "3 min", "notes": "Self-massage or foam roll forearms"},
            {"name": "Full body stretching", "duration": "7 min", "notes": "Hold each stretch 45-60 seconds"}
        ]
    }',
    'replace', 'cooldown_base', 'expert', 75, 'medium'
);

-- Enable RLS
ALTER TABLE session_structure_components ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Components readable by all authenticated users"
ON session_structure_components FOR SELECT
TO authenticated
USING (is_active = TRUE);

CREATE POLICY "Components manageable by coaches"
ON session_structure_components FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.is_coach = TRUE
    )
);

-- Function to update component when new expert scenarios are added
CREATE OR REPLACE FUNCTION update_component_from_expert(
    p_component_id UUID,
    p_scenario_id UUID
)
RETURNS void AS $$
BEGIN
    UPDATE session_structure_components
    SET
        expert_scenario_ids = array_append(expert_scenario_ids, p_scenario_id),
        n_scenarios = n_scenarios + 1,
        updated_at = NOW()
    WHERE id = p_component_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE session_structure_components IS 'Modular session structure blocks that can be mixed/matched based on condition patterns. Supports conflict groups and intensity scores for safe composition.';
