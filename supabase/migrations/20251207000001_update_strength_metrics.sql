-- Migration: Update Strength Metrics to Array/JSONB
-- Date: 2024-12-07
-- Description: Updates objective_strength_metric to strength_metrics JSONB for multiple entries
-- Run this if you've already applied the 20251207000000_session_form_data.sql migration

-- ============================================
-- DROP DEPENDENT VIEW FIRST
-- ============================================
DROP VIEW IF EXISTS complete_session_data;

-- ============================================
-- UPDATE POST_SESSION_DATA TABLE
-- ============================================

-- Check if old column exists and migrate data
DO $$
BEGIN
    -- Check if objective_strength_metric column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_session_data' 
        AND column_name = 'objective_strength_metric'
    ) THEN
        -- Add new column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'post_session_data' 
            AND column_name = 'strength_metrics'
        ) THEN
            ALTER TABLE post_session_data 
            ADD COLUMN strength_metrics JSONB DEFAULT '[]';
        END IF;
        
        -- Migrate existing data from old column to new format
        UPDATE post_session_data 
        SET strength_metrics = CASE 
            WHEN objective_strength_metric IS NOT NULL 
                 AND objective_strength_metric != '' 
                 AND objective_strength_metric != 'N/A'
            THEN jsonb_build_array(
                jsonb_build_object(
                    'exercise', 'other',
                    'value', objective_strength_metric,
                    'unit', 'lbs'
                )
            )
            ELSE '[]'::jsonb
        END
        WHERE strength_metrics IS NULL OR strength_metrics = '[]'::jsonb;
        
        -- Drop old column (view already dropped above)
        ALTER TABLE post_session_data DROP COLUMN IF EXISTS objective_strength_metric;
        
        RAISE NOTICE 'Migrated objective_strength_metric to strength_metrics';
    ELSE
        -- Just ensure the new column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'post_session_data' 
            AND column_name = 'strength_metrics'
        ) THEN
            ALTER TABLE post_session_data 
            ADD COLUMN strength_metrics JSONB DEFAULT '[]';
            RAISE NOTICE 'Added strength_metrics column';
        ELSE
            RAISE NOTICE 'strength_metrics column already exists';
        END IF;
    END IF;
END $$;

-- ============================================
-- UPDATE VIEW
-- ============================================

-- Recreate the view with the new column
CREATE OR REPLACE VIEW complete_session_data AS
SELECT 
    cs.id AS session_id,
    cs.user_id,
    cs.started_at,
    cs.ended_at,
    cs.session_type,
    cs.location,
    cs.is_outdoor,
    cs.status,
    cs.planned_duration_minutes,
    cs.actual_duration_minutes,
    
    -- Pre-session data
    pre.session_environment,
    pre.planned_duration,
    pre.partner_status,
    pre.crowdedness,
    pre.sleep_quality,
    pre.sleep_hours,
    pre.stress_level,
    pre.fueling_status,
    pre.hydration_feel,
    pre.skin_condition AS skin_condition_pre,
    pre.finger_tendon_health,
    pre.doms_locations AS doms_locations_pre,
    pre.doms_severity AS doms_severity_pre,
    pre.menstrual_phase,
    pre.motivation,
    pre.primary_goal,
    pre.warmup_rpe,
    pre.warmup_compliance,
    pre.upper_body_power,
    pre.shoulder_integrity,
    pre.leg_springiness,
    pre.finger_strength AS finger_strength_pre,
    pre.readiness_score,
    pre.recovery_status,
    
    -- Post-session data
    post.hardest_grade_sent,
    post.hardest_grade_attempted,
    post.volume_estimation,
    post.strength_metrics,
    post.dominant_style,
    post.rpe,
    post.session_density,
    post.intra_session_fueling,
    post.limiting_factors,
    post.flash_pump,
    post.new_pain_location,
    post.new_pain_severity,
    post.fingers_stiffer_than_usual,
    post.skin_status_post,
    post.doms_severity_post,
    post.finger_power_post,
    post.shoulder_mobility_post,
    post.prediction_error,
    post.session_quality_score,
    post.fatigue_delta,
    post.performance_vs_expected

FROM climbing_sessions cs
LEFT JOIN pre_session_data pre ON cs.id = pre.session_id
LEFT JOIN post_session_data post ON cs.id = post.session_id;

-- ============================================
-- ADD INDEX FOR JSONB QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_post_session_strength_metrics ON post_session_data USING GIN (strength_metrics);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN post_session_data.strength_metrics IS 'Array of strength metric entries: [{exercise, value, unit}]. Exercises: max_hang, half_crimp_hang, open_hand_hang, weighted_pullup, one_arm_hang, campus_max, repeaters, other. Units: lbs, kg, sec, reps, mm';

