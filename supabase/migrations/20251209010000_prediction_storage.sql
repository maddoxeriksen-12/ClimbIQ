-- Migration: Prediction Storage for Learning Loop
-- Layer 5: Learning - Required to close the feedback loop
-- Stores predictions with each recommendation to compare against actual outcomes

-- ============================================================================
-- 1. ADD PREDICTION SNAPSHOT TO CLIMBING_SESSIONS
-- ============================================================================
-- Store the prediction made at recommendation time

ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS prediction_snapshot JSONB;
/*
Example structure:
{
    "predicted_quality": 7.2,
    "predicted_fatigue": 4.5,
    "session_type": "project",
    "confidence": "high",
    "key_factors": [
        {"variable": "sleep_quality", "value": 8, "effect": 0.32},
        {"variable": "energy_level", "value": 7, "effect": 0.28}
    ],
    "model_version": "v1.2.0",
    "population_prior_used": true,
    "user_deviation_applied": false,
    "created_at": "2024-12-09T10:00:00Z"
}
*/

-- Add index for sessions with predictions (for learning loop queries)
CREATE INDEX IF NOT EXISTS idx_sessions_has_prediction
    ON climbing_sessions((prediction_snapshot IS NOT NULL))
    WHERE prediction_snapshot IS NOT NULL;

-- ============================================================================
-- 2. PREDICTION ACCURACY TABLE
-- ============================================================================
-- Tracks predicted vs actual for learning

CREATE TABLE IF NOT EXISTS prediction_accuracy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES climbing_sessions(id) ON DELETE CASCADE,

    -- What we predicted
    predicted_quality FLOAT NOT NULL,
    predicted_fatigue FLOAT,
    predicted_session_type TEXT,

    -- What actually happened (from post_session_data)
    actual_quality FLOAT,          -- From session_quality or rpe_accuracy
    actual_fatigue FLOAT,          -- From fatigue_level
    actual_session_type TEXT,      -- From actual_session_type if deviated

    -- Error metrics (computed columns)
    quality_error FLOAT GENERATED ALWAYS AS (actual_quality - predicted_quality) STORED,
    fatigue_error FLOAT GENERATED ALWAYS AS (
        CASE WHEN actual_fatigue IS NOT NULL AND predicted_fatigue IS NOT NULL
             THEN actual_fatigue - predicted_fatigue
             ELSE NULL
        END
    ) STORED,

    -- Absolute errors for aggregation
    quality_abs_error FLOAT GENERATED ALWAYS AS (ABS(actual_quality - predicted_quality)) STORED,
    fatigue_abs_error FLOAT GENERATED ALWAYS AS (
        CASE WHEN actual_fatigue IS NOT NULL AND predicted_fatigue IS NOT NULL
             THEN ABS(actual_fatigue - predicted_fatigue)
             ELSE NULL
        END
    ) STORED,

    -- Context for learning (what was the user's state when prediction was made)
    key_factors JSONB,
    user_state_snapshot JSONB,     -- Full pre-session state
    model_version TEXT,
    population_prior_used BOOLEAN DEFAULT TRUE,
    user_deviation_applied BOOLEAN DEFAULT FALSE,

    -- Timestamps
    prediction_made_at TIMESTAMPTZ,
    outcome_recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One accuracy record per session
    UNIQUE(session_id)
);

-- Indexes for efficient learning loop queries
CREATE INDEX IF NOT EXISTS idx_accuracy_user ON prediction_accuracy(user_id);
CREATE INDEX IF NOT EXISTS idx_accuracy_created ON prediction_accuracy(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accuracy_quality_error ON prediction_accuracy(quality_error)
    WHERE quality_error IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accuracy_user_recent ON prediction_accuracy(user_id, created_at DESC);

-- ============================================================================
-- 3. ADD RECOVERY_INDEX TO MODEL_OUTPUTS
-- ============================================================================
-- Per-user metric tracking how quickly they recover vs population average

ALTER TABLE model_outputs ADD COLUMN IF NOT EXISTS recovery_index FLOAT DEFAULT 1.0;
-- 1.0 = average recovery, >1 = recovers faster than average, <1 = recovers slower

-- Add variable-specific deviation metrics
ALTER TABLE model_outputs ADD COLUMN IF NOT EXISTS variable_deviations JSONB DEFAULT '{}';
/*
Example structure:
{
    "sleep_quality_deviation": 0.5,  -- User is less affected by low sleep than average
    "stress_deviation": -0.3,        -- User is more affected by stress than average
    "soreness_deviation": 0.2        -- User tolerates soreness better than average
}
*/

-- ============================================================================
-- 4. USER FATIGUE TRACKING TABLE
-- ============================================================================
-- Track cumulative fatigue for each user

CREATE TABLE IF NOT EXISTS user_fatigue_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Rolling fatigue metrics
    cumulative_fatigue_7d FLOAT DEFAULT 0,    -- Sum of session loads * fatigue factor (7 days)
    cumulative_fatigue_28d FLOAT DEFAULT 0,   -- Sum of session loads * fatigue factor (28 days)

    -- Recovery observations
    avg_recovery_rate FLOAT,                  -- How quickly fatigue drops between sessions
    days_to_baseline FLOAT,                   -- Estimated days to return to baseline after session

    -- Derived metrics
    recovery_index FLOAT DEFAULT 1.0,         -- >1 = recovers faster than population
    fatigue_sensitivity FLOAT DEFAULT 1.0,   -- How much sessions impact this user's fatigue

    -- Last session info
    last_session_id UUID REFERENCES climbing_sessions(id),
    last_session_load FLOAT,
    last_session_date DATE,

    -- Timestamps
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One tracking record per user
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_fatigue_tracking_user ON user_fatigue_tracking(user_id);

-- ============================================================================
-- 5. FUNCTION TO RECORD PREDICTION
-- ============================================================================
-- Called by recommendation engine when generating a recommendation

CREATE OR REPLACE FUNCTION record_prediction(
    p_session_id UUID,
    p_predicted_quality FLOAT,
    p_predicted_fatigue FLOAT DEFAULT NULL,
    p_session_type TEXT DEFAULT NULL,
    p_confidence TEXT DEFAULT 'medium',
    p_key_factors JSONB DEFAULT '[]',
    p_model_version TEXT DEFAULT 'v1.0.0',
    p_population_prior_used BOOLEAN DEFAULT TRUE,
    p_user_deviation_applied BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
BEGIN
    UPDATE climbing_sessions
    SET prediction_snapshot = jsonb_build_object(
        'predicted_quality', p_predicted_quality,
        'predicted_fatigue', p_predicted_fatigue,
        'session_type', p_session_type,
        'confidence', p_confidence,
        'key_factors', p_key_factors,
        'model_version', p_model_version,
        'population_prior_used', p_population_prior_used,
        'user_deviation_applied', p_user_deviation_applied,
        'created_at', NOW()
    )
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. FUNCTION TO RECORD ACCURACY (CLOSE THE LOOP)
-- ============================================================================
-- Called after post-session data is submitted

CREATE OR REPLACE FUNCTION record_prediction_accuracy(
    p_session_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_session RECORD;
    v_accuracy_id UUID;
BEGIN
    -- Get session data with prediction and post-session info
    SELECT
        cs.id,
        cs.user_id,
        cs.prediction_snapshot,
        cs.pre_session_data,
        cs.post_session_data,
        cs.session_rpe,
        cs.actual_session_type
    INTO v_session
    FROM climbing_sessions cs
    WHERE cs.id = p_session_id
      AND cs.prediction_snapshot IS NOT NULL;

    -- Exit if no prediction was made for this session
    IF v_session IS NULL THEN
        RETURN NULL;
    END IF;

    -- Insert accuracy record
    INSERT INTO prediction_accuracy (
        user_id,
        session_id,
        predicted_quality,
        predicted_fatigue,
        predicted_session_type,
        actual_quality,
        actual_fatigue,
        actual_session_type,
        key_factors,
        user_state_snapshot,
        model_version,
        population_prior_used,
        user_deviation_applied,
        prediction_made_at
    ) VALUES (
        v_session.user_id,
        v_session.id,
        (v_session.prediction_snapshot->>'predicted_quality')::FLOAT,
        (v_session.prediction_snapshot->>'predicted_fatigue')::FLOAT,
        v_session.prediction_snapshot->>'session_type',
        -- Actual quality from post-session data or session_rpe
        COALESCE(
            (v_session.post_session_data->>'session_quality')::FLOAT,
            v_session.session_rpe::FLOAT
        ),
        (v_session.post_session_data->>'fatigue_level')::FLOAT,
        COALESCE(v_session.actual_session_type, v_session.prediction_snapshot->>'session_type'),
        v_session.prediction_snapshot->'key_factors',
        v_session.pre_session_data,
        v_session.prediction_snapshot->>'model_version',
        (v_session.prediction_snapshot->>'population_prior_used')::BOOLEAN,
        (v_session.prediction_snapshot->>'user_deviation_applied')::BOOLEAN,
        (v_session.prediction_snapshot->>'created_at')::TIMESTAMPTZ
    )
    ON CONFLICT (session_id)
    DO UPDATE SET
        actual_quality = EXCLUDED.actual_quality,
        actual_fatigue = EXCLUDED.actual_fatigue,
        actual_session_type = EXCLUDED.actual_session_type,
        outcome_recorded_at = NOW()
    RETURNING id INTO v_accuracy_id;

    RETURN v_accuracy_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. FUNCTION TO GET USER'S PREDICTION ACCURACY STATS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_prediction_stats(
    p_user_id UUID,
    p_days INT DEFAULT 30
)
RETURNS TABLE (
    total_predictions INT,
    avg_quality_error FLOAT,
    avg_abs_quality_error FLOAT,
    bias_direction TEXT,           -- 'under' (we underpredicted) or 'over' (we overpredicted)
    accuracy_trend TEXT,           -- 'improving', 'stable', 'declining'
    recovery_index FLOAT
) AS $$
DECLARE
    v_recent_error FLOAT;
    v_older_error FLOAT;
BEGIN
    -- Get recent error (last 7 days)
    SELECT AVG(pa.quality_error)
    INTO v_recent_error
    FROM prediction_accuracy pa
    WHERE pa.user_id = p_user_id
      AND pa.created_at >= NOW() - INTERVAL '7 days'
      AND pa.actual_quality IS NOT NULL;

    -- Get older error (8-30 days ago)
    SELECT AVG(pa.quality_error)
    INTO v_older_error
    FROM prediction_accuracy pa
    WHERE pa.user_id = p_user_id
      AND pa.created_at >= NOW() - INTERVAL '30 days'
      AND pa.created_at < NOW() - INTERVAL '7 days'
      AND pa.actual_quality IS NOT NULL;

    RETURN QUERY
    SELECT
        COUNT(*)::INT AS total_predictions,
        AVG(pa.quality_error)::FLOAT AS avg_quality_error,
        AVG(pa.quality_abs_error)::FLOAT AS avg_abs_quality_error,
        CASE
            WHEN AVG(pa.quality_error) > 0.3 THEN 'under'
            WHEN AVG(pa.quality_error) < -0.3 THEN 'over'
            ELSE 'accurate'
        END AS bias_direction,
        CASE
            WHEN v_recent_error IS NULL OR v_older_error IS NULL THEN 'insufficient_data'
            WHEN ABS(v_recent_error) < ABS(v_older_error) - 0.2 THEN 'improving'
            WHEN ABS(v_recent_error) > ABS(v_older_error) + 0.2 THEN 'declining'
            ELSE 'stable'
        END AS accuracy_trend,
        COALESCE(mo.recovery_index, 1.0)::FLOAT AS recovery_index
    FROM prediction_accuracy pa
    LEFT JOIN model_outputs mo ON mo.user_id = p_user_id
    WHERE pa.user_id = p_user_id
      AND pa.created_at >= NOW() - (p_days || ' days')::INTERVAL
      AND pa.actual_quality IS NOT NULL
    GROUP BY mo.recovery_index;

    -- Return default if no data
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            0::INT,
            0.0::FLOAT,
            0.0::FLOAT,
            'insufficient_data'::TEXT,
            'insufficient_data'::TEXT,
            1.0::FLOAT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. TRIGGER TO AUTO-RECORD ACCURACY ON POST-SESSION SUBMISSION
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_record_accuracy()
RETURNS TRIGGER AS $$
BEGIN
    -- When post_session_data is updated, record accuracy
    IF NEW.post_session_data IS DISTINCT FROM OLD.post_session_data
       AND NEW.post_session_data IS NOT NULL
       AND NEW.prediction_snapshot IS NOT NULL THEN
        PERFORM record_prediction_accuracy(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_accuracy_on_post_session ON climbing_sessions;

-- Create trigger
CREATE TRIGGER trigger_accuracy_on_post_session
    AFTER UPDATE OF post_session_data ON climbing_sessions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_record_accuracy();

-- ============================================================================
-- 9. RLS POLICIES
-- ============================================================================

ALTER TABLE prediction_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_fatigue_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view their own prediction accuracy
CREATE POLICY "Users can view own prediction accuracy"
ON prediction_accuracy FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role can manage all
CREATE POLICY "Service role manages prediction accuracy"
ON prediction_accuracy FOR ALL
TO authenticated
USING (auth.role() = 'service_role');

-- Users can view their own fatigue tracking
CREATE POLICY "Users can view own fatigue tracking"
ON user_fatigue_tracking FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role can manage fatigue tracking
CREATE POLICY "Service role manages fatigue tracking"
ON user_fatigue_tracking FOR ALL
TO authenticated
USING (auth.role() = 'service_role');

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE prediction_accuracy IS 'Stores predicted vs actual session outcomes for learning loop. Used by Dagster to update user deviation metrics.';
COMMENT ON TABLE user_fatigue_tracking IS 'Tracks cumulative fatigue per user for recovery modeling and ACWR enhancement.';
COMMENT ON COLUMN model_outputs.recovery_index IS 'User-specific recovery rate vs population. >1 = recovers faster, <1 = recovers slower. Updated by learning loop.';
COMMENT ON FUNCTION record_prediction(UUID, FLOAT, FLOAT, TEXT, TEXT, JSONB, TEXT, BOOLEAN, BOOLEAN) IS 'Records prediction snapshot when recommendation is generated. Called by recommendation engine.';
COMMENT ON FUNCTION record_prediction_accuracy(UUID) IS 'Creates prediction accuracy record after post-session data submitted. Auto-triggered or called by API.';
