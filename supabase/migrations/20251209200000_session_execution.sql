-- Migration: Session Execution State Machine
-- Layer 4: Session Execution - Tracks in-session progress and enables branching
-- Implements pain > 3 -> rehab swap and mid-session adjustments

-- ============================================================================
-- 1. SESSION EXECUTION STATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_execution_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES climbing_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Current position in session
    current_phase TEXT NOT NULL DEFAULT 'warmup'
        CHECK (current_phase IN ('warmup', 'main', 'cooldown', 'hangboard', 'antagonist', 'completed', 'aborted')),
    current_block_index INT DEFAULT 0,
    phase_start_time TIMESTAMPTZ,

    -- Time tracking
    warmup_completed_at TIMESTAMPTZ,
    main_completed_at TIMESTAMPTZ,
    cooldown_completed_at TIMESTAMPTZ,

    -- Mid-session signals (updated via checkpoints)
    pain_level INT CHECK (pain_level IS NULL OR (pain_level >= 0 AND pain_level <= 10)),
    pain_location TEXT,
    energy_update INT CHECK (energy_update IS NULL OR (energy_update >= 1 AND energy_update <= 10)),
    perceived_intensity INT CHECK (perceived_intensity IS NULL OR (perceived_intensity >= 1 AND perceived_intensity <= 10)),

    -- Branch history
    branches_taken JSONB DEFAULT '[]'::JSONB,
    /*
    Format:
    [
        {
            "trigger": "pain_threshold",
            "from_phase": "main",
            "to_phase": "rehab",
            "pain_level": 5,
            "pain_location": "fingers",
            "reason": "Pain level 5 at fingers",
            "timestamp": "2024-12-09T10:30:00Z"
        }
    ]
    */

    -- Plan versioning
    original_plan JSONB NOT NULL,           -- The plan at session start
    current_plan JSONB NOT NULL,            -- The plan after any modifications
    plan_version INT DEFAULT 1,             -- Incremented on each modification

    -- Adjustment log
    adjustments JSONB DEFAULT '[]'::JSONB,
    /*
    Format:
    [
        {
            "type": "intensity_reduction",
            "trigger": "energy_update",
            "old_value": {"intensity": 8},
            "new_value": {"intensity": 6},
            "reason": "Energy dropped to 4",
            "timestamp": "..."
        }
    ]
    */

    -- Session completion info
    completion_status TEXT DEFAULT 'in_progress'
        CHECK (completion_status IN ('in_progress', 'completed_normal', 'completed_early', 'aborted_pain', 'aborted_fatigue', 'aborted_other')),
    completion_reason TEXT,
    completion_notes TEXT,

    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One execution state per session
    UNIQUE(session_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_execution_session ON session_execution_state(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_user ON session_execution_state(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_status ON session_execution_state(completion_status);
CREATE INDEX IF NOT EXISTS idx_execution_phase ON session_execution_state(current_phase);

-- ============================================================================
-- 2. SESSION CHECKPOINTS TABLE
-- ============================================================================
-- Log of all checkpoint interactions during a session

CREATE TABLE IF NOT EXISTS session_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES climbing_sessions(id) ON DELETE CASCADE,
    execution_state_id UUID NOT NULL REFERENCES session_execution_state(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- When and where in session
    checkpoint_time TIMESTAMPTZ DEFAULT NOW(),
    phase_at_checkpoint TEXT NOT NULL,
    block_index_at_checkpoint INT,
    minutes_into_session INT,

    -- User-reported data
    pain_level INT CHECK (pain_level IS NULL OR (pain_level >= 0 AND pain_level <= 10)),
    pain_location TEXT,
    energy_level INT CHECK (energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 10)),
    perceived_intensity INT CHECK (perceived_intensity IS NULL OR (perceived_intensity >= 1 AND perceived_intensity <= 10)),
    notes TEXT,

    -- System response
    action_taken TEXT CHECK (action_taken IN ('continue', 'branch_rehab', 'adjust_intensity', 'adjust_duration', 'abort', 'warn')),
    action_reason TEXT,
    new_plan_snapshot JSONB,  -- If plan was modified

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON session_checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_time ON session_checkpoints(checkpoint_time);

-- ============================================================================
-- 3. REHAB PROTOCOLS TABLE
-- ============================================================================
-- Pre-defined rehabilitation protocols to swap to when pain is detected

CREATE TABLE IF NOT EXISTS rehab_protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_name TEXT NOT NULL UNIQUE,

    -- When to use this protocol
    pain_location TEXT NOT NULL,  -- 'fingers', 'shoulder', 'elbow', 'wrist', 'general'
    min_pain_level INT DEFAULT 3,
    max_pain_level INT DEFAULT 7,  -- Above this, recommend stopping entirely

    -- The rehab session structure
    protocol_structure JSONB NOT NULL,
    /*
    Format:
    {
        "description": "Finger pain protocol",
        "estimated_duration_min": 20,
        "phases": [
            {
                "name": "assessment",
                "duration": 5,
                "exercises": [
                    {"name": "Pain localization", "notes": "Identify exact pain location and type"}
                ]
            },
            {
                "name": "gentle_movement",
                "duration": 10,
                "exercises": [
                    {"name": "Finger extensions", "sets": 2, "reps": 10, "notes": "Gentle, stop if pain"}
                ]
            },
            {
                "name": "cooldown",
                "duration": 5,
                "exercises": [
                    {"name": "Ice if needed", "duration": "5 min"}
                ]
            }
        ]
    }
    */

    -- Messaging
    user_message TEXT NOT NULL,  -- What to tell the user
    follow_up_recommendation TEXT,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. SEED REHAB PROTOCOLS
-- ============================================================================

INSERT INTO rehab_protocols (
    protocol_name, pain_location, min_pain_level, max_pain_level,
    protocol_structure, user_message, follow_up_recommendation
) VALUES
(
    'finger_pain_mild',
    'fingers',
    3, 5,
    '{
        "description": "Mild finger pain protocol - assess and continue cautiously",
        "estimated_duration_min": 15,
        "phases": [
            {
                "name": "assessment",
                "duration": 3,
                "exercises": [
                    {"name": "Pain assessment", "notes": "Which finger? Which joint? Is it pulley, joint, or muscle?"},
                    {"name": "Range of motion check", "notes": "Can you fully extend and flex without sharp pain?"}
                ]
            },
            {
                "name": "gentle_activation",
                "duration": 7,
                "intensity": "RPE 1-2",
                "exercises": [
                    {"name": "Finger extensions", "sets": 2, "reps": 15, "notes": "Rubber band or fingers spread"},
                    {"name": "Gentle fist opens", "sets": 2, "reps": 10, "notes": "Slow and controlled"}
                ]
            },
            {
                "name": "modified_climbing",
                "duration": 5,
                "intensity": "RPE 3-4",
                "exercises": [
                    {"name": "Large hold only climbing", "notes": "Avoid crimps entirely. Open-hand grip only."}
                ]
            }
        ]
    }',
    'Finger pain detected. Switching to modified protocol. We will avoid crimps and reduce intensity. If pain increases, please stop.',
    'Consider icing after session. If pain persists beyond 48 hours or is sharp, consult a sports medicine professional.'
),
(
    'finger_pain_moderate',
    'fingers',
    5, 7,
    '{
        "description": "Moderate finger pain - minimal climbing, focus on assessment",
        "estimated_duration_min": 10,
        "phases": [
            {
                "name": "assessment",
                "duration": 3,
                "exercises": [
                    {"name": "Pain assessment", "notes": "Document location, type (sharp/dull), and when it hurts"},
                    {"name": "Comparison test", "notes": "Compare to other hand - any swelling or warmth?"}
                ]
            },
            {
                "name": "gentle_movement",
                "duration": 5,
                "intensity": "RPE 1",
                "exercises": [
                    {"name": "Non-loaded finger movements", "notes": "Gentle movements without any climbing or loading"},
                    {"name": "Wrist circles", "sets": 1, "reps": 10}
                ]
            },
            {
                "name": "end_session",
                "duration": 2,
                "exercises": [
                    {"name": "Decision point", "notes": "Consider ending session or switching to lower body work"}
                ]
            }
        ]
    }',
    'Moderate finger pain detected. This level of pain suggests we should not continue climbing. Transitioning to assessment only.',
    'Strongly recommend rest for 48-72 hours. Ice 15 min 3x daily. If no improvement or pain worsens, see a doctor.'
),
(
    'shoulder_pain_mild',
    'shoulder',
    3, 5,
    '{
        "description": "Mild shoulder pain - mobility focus",
        "estimated_duration_min": 20,
        "phases": [
            {
                "name": "assessment",
                "duration": 3,
                "exercises": [
                    {"name": "Range of motion assessment", "notes": "Can you raise arm overhead? Any clicking?"}
                ]
            },
            {
                "name": "mobility_work",
                "duration": 12,
                "intensity": "RPE 2",
                "exercises": [
                    {"name": "Shoulder circles", "sets": 2, "reps": 10},
                    {"name": "Wall slides", "sets": 2, "reps": 10},
                    {"name": "Band pull-aparts", "sets": 2, "reps": 15, "notes": "Light resistance only"}
                ]
            },
            {
                "name": "modified_climbing",
                "duration": 5,
                "intensity": "RPE 4",
                "exercises": [
                    {"name": "Below-shoulder climbing only", "notes": "Avoid moves requiring overhead reach"}
                ]
            }
        ]
    }',
    'Shoulder discomfort detected. Switching to modified protocol with mobility focus. Avoiding overhead movements.',
    'Focus on rotator cuff exercises in coming days. If pain persists, consider a shoulder assessment.'
),
(
    'elbow_pain_mild',
    'elbow',
    3, 5,
    '{
        "description": "Mild elbow pain - often climbers elbow. Gentle protocol.",
        "estimated_duration_min": 15,
        "phases": [
            {
                "name": "assessment",
                "duration": 3,
                "exercises": [
                    {"name": "Pain localization", "notes": "Inside (golfers) or outside (tennis) elbow?"},
                    {"name": "Grip test", "notes": "Does gripping increase pain?"}
                ]
            },
            {
                "name": "eccentric_work",
                "duration": 7,
                "intensity": "RPE 2-3",
                "exercises": [
                    {"name": "Wrist curls eccentric", "sets": 2, "reps": 15, "notes": "Light weight, slow lowering"},
                    {"name": "Reverse wrist curls", "sets": 2, "reps": 15}
                ]
            },
            {
                "name": "modified_climbing",
                "duration": 5,
                "intensity": "RPE 4",
                "exercises": [
                    {"name": "Open-hand only climbing", "notes": "Avoid crimps and aggressive pulls"}
                ]
            }
        ]
    }',
    'Elbow discomfort detected. This is common in climbers. Switching to protocol with eccentric exercises.',
    'Eccentric exercises are key for tendon health. Do wrist curls daily. Ice after climbing.'
),
(
    'general_pain_high',
    'general',
    7, 10,
    '{
        "description": "High pain level - session should end",
        "estimated_duration_min": 5,
        "phases": [
            {
                "name": "end_session",
                "duration": 5,
                "exercises": [
                    {"name": "Gentle cooldown", "notes": "Easy movement if possible, then stop"},
                    {"name": "Ice application", "notes": "Apply ice to affected area"}
                ]
            }
        ]
    }',
    'Pain level is high. For your safety, we recommend ending this session. Pain this significant needs attention.',
    'Rest is required. If pain is severe or doesnt improve within 24 hours, please seek medical attention.'
);

-- ============================================================================
-- 5. FUNCTIONS FOR SESSION EXECUTION
-- ============================================================================

-- Function to start session execution tracking
CREATE OR REPLACE FUNCTION start_session_execution(
    p_session_id UUID,
    p_user_id UUID,
    p_plan JSONB
)
RETURNS UUID AS $$
DECLARE
    v_execution_id UUID;
BEGIN
    INSERT INTO session_execution_state (
        session_id, user_id, original_plan, current_plan, phase_start_time
    ) VALUES (
        p_session_id, p_user_id, p_plan, p_plan, NOW()
    )
    RETURNING id INTO v_execution_id;

    RETURN v_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process a checkpoint and determine action
CREATE OR REPLACE FUNCTION process_checkpoint(
    p_session_id UUID,
    p_pain_level INT DEFAULT NULL,
    p_pain_location TEXT DEFAULT NULL,
    p_energy_level INT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
    action TEXT,
    reason TEXT,
    new_plan JSONB,
    rehab_protocol JSONB,
    user_message TEXT
) AS $$
DECLARE
    v_execution session_execution_state;
    v_rehab rehab_protocols;
    v_checkpoint_id UUID;
    v_new_plan JSONB;
    v_action TEXT := 'continue';
    v_reason TEXT := NULL;
    v_user_message TEXT := NULL;
BEGIN
    -- Get current execution state
    SELECT * INTO v_execution
    FROM session_execution_state
    WHERE session_id = p_session_id;

    IF v_execution IS NULL THEN
        RAISE EXCEPTION 'No execution state found for session %', p_session_id;
    END IF;

    v_new_plan := v_execution.current_plan;

    -- Check pain threshold for branching
    IF p_pain_level IS NOT NULL AND p_pain_level > 3 THEN
        -- Find appropriate rehab protocol
        SELECT * INTO v_rehab
        FROM rehab_protocols
        WHERE pain_location = COALESCE(p_pain_location, 'general')
          AND is_active = TRUE
          AND p_pain_level >= min_pain_level
          AND p_pain_level <= max_pain_level
        ORDER BY min_pain_level DESC
        LIMIT 1;

        -- Fallback to general if no specific protocol
        IF v_rehab IS NULL THEN
            SELECT * INTO v_rehab
            FROM rehab_protocols
            WHERE pain_location = 'general'
              AND is_active = TRUE
              AND p_pain_level >= min_pain_level
            ORDER BY min_pain_level DESC
            LIMIT 1;
        END IF;

        IF v_rehab IS NOT NULL THEN
            IF p_pain_level >= 7 THEN
                v_action := 'abort';
                v_reason := format('Pain level %s at %s - session should end', p_pain_level, COALESCE(p_pain_location, 'unspecified'));
            ELSE
                v_action := 'branch_rehab';
                v_reason := format('Pain level %s at %s - switching to rehab protocol', p_pain_level, COALESCE(p_pain_location, 'unspecified'));
            END IF;
            v_new_plan := v_rehab.protocol_structure;
            v_user_message := v_rehab.user_message;

            -- Record branch
            UPDATE session_execution_state
            SET
                branches_taken = branches_taken || jsonb_build_object(
                    'trigger', 'pain_threshold',
                    'from_phase', current_phase,
                    'to_phase', CASE WHEN v_action = 'abort' THEN 'aborted' ELSE 'rehab' END,
                    'pain_level', p_pain_level,
                    'pain_location', p_pain_location,
                    'reason', v_reason,
                    'timestamp', NOW()
                ),
                current_plan = v_new_plan,
                plan_version = plan_version + 1,
                pain_level = p_pain_level,
                pain_location = p_pain_location,
                updated_at = NOW()
            WHERE session_id = p_session_id;
        END IF;

    -- Check energy for adjustments
    ELSIF p_energy_level IS NOT NULL AND p_energy_level < 4 THEN
        v_action := 'adjust_intensity';
        v_reason := format('Energy dropped to %s - reducing remaining intensity', p_energy_level);

        -- Scale down intensity in remaining phases
        -- (In practice, this would modify v_new_plan structure)

        UPDATE session_execution_state
        SET
            adjustments = adjustments || jsonb_build_object(
                'type', 'intensity_reduction',
                'trigger', 'energy_update',
                'energy_level', p_energy_level,
                'reason', v_reason,
                'timestamp', NOW()
            ),
            energy_update = p_energy_level,
            updated_at = NOW()
        WHERE session_id = p_session_id;
    END IF;

    -- Record checkpoint
    INSERT INTO session_checkpoints (
        session_id, execution_state_id, user_id,
        phase_at_checkpoint, block_index_at_checkpoint,
        pain_level, pain_location, energy_level, notes,
        action_taken, action_reason, new_plan_snapshot
    ) VALUES (
        p_session_id, v_execution.id, v_execution.user_id,
        v_execution.current_phase, v_execution.current_block_index,
        p_pain_level, p_pain_location, p_energy_level, p_notes,
        v_action, v_reason, CASE WHEN v_action != 'continue' THEN v_new_plan ELSE NULL END
    );

    RETURN QUERY
    SELECT
        v_action,
        v_reason,
        v_new_plan,
        v_rehab.protocol_structure,
        v_user_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to advance to next phase
CREATE OR REPLACE FUNCTION advance_session_phase(
    p_session_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_current_phase TEXT;
    v_next_phase TEXT;
BEGIN
    SELECT current_phase INTO v_current_phase
    FROM session_execution_state
    WHERE session_id = p_session_id;

    v_next_phase := CASE v_current_phase
        WHEN 'warmup' THEN 'main'
        WHEN 'main' THEN 'cooldown'
        WHEN 'cooldown' THEN 'completed'
        ELSE v_current_phase
    END;

    UPDATE session_execution_state
    SET
        current_phase = v_next_phase,
        current_block_index = 0,
        phase_start_time = NOW(),
        warmup_completed_at = CASE WHEN v_current_phase = 'warmup' THEN NOW() ELSE warmup_completed_at END,
        main_completed_at = CASE WHEN v_current_phase = 'main' THEN NOW() ELSE main_completed_at END,
        cooldown_completed_at = CASE WHEN v_current_phase = 'cooldown' THEN NOW() ELSE cooldown_completed_at END,
        completion_status = CASE WHEN v_next_phase = 'completed' THEN 'completed_normal' ELSE completion_status END,
        completed_at = CASE WHEN v_next_phase = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE session_id = p_session_id;

    RETURN v_next_phase;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end session with status
CREATE OR REPLACE FUNCTION end_session_execution(
    p_session_id UUID,
    p_status TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE session_execution_state
    SET
        current_phase = CASE WHEN p_status LIKE 'abort%' THEN 'aborted' ELSE 'completed' END,
        completion_status = p_status,
        completion_reason = p_reason,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

ALTER TABLE session_execution_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_protocols ENABLE ROW LEVEL SECURITY;

-- Execution state policies
CREATE POLICY "Users can view own execution state"
ON session_execution_state FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own execution state"
ON session_execution_state FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Checkpoint policies
CREATE POLICY "Users can view own checkpoints"
ON session_checkpoints FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own checkpoints"
ON session_checkpoints FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Rehab protocols readable by all
CREATE POLICY "Rehab protocols readable by all"
ON rehab_protocols FOR SELECT
TO authenticated
USING (is_active = TRUE);

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE session_execution_state IS 'Tracks in-session state including current phase, pain levels, and plan modifications. Enables branching logic.';
COMMENT ON TABLE session_checkpoints IS 'Log of all checkpoint interactions during a session with user-reported data and system responses.';
COMMENT ON TABLE rehab_protocols IS 'Pre-defined rehabilitation protocols to swap to when pain is detected during session.';
COMMENT ON FUNCTION process_checkpoint(UUID, INT, TEXT, INT, TEXT) IS 'Processes a mid-session checkpoint, determines if branching/adjustment is needed, and returns action to take.';
COMMENT ON FUNCTION advance_session_phase(UUID) IS 'Advances session to next phase (warmup -> main -> cooldown -> completed).';
