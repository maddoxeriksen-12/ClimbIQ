-- Migration: Update complete_session_data view to support both normalized and JSONB data
-- This allows the view to show data whether it's in the new normalized tables or the legacy JSONB columns

DROP VIEW IF EXISTS complete_session_data;

CREATE OR REPLACE VIEW complete_session_data AS
SELECT 
    cs.id AS session_id,
    cs.user_id,
    cs.goal_id,
    cs.session_type,
    cs.location,
    cs.is_outdoor,
    cs.started_at,
    cs.ended_at,
    cs.planned_duration_minutes,
    cs.actual_duration_minutes,
    cs.status,
    
    -- Pre-session data (prefer normalized table, fallback to JSONB)
    psd.id AS pre_session_id,
    COALESCE(psd.session_environment, cs.pre_session_data->>'session_environment') AS session_environment,
    COALESCE(psd.planned_duration, (cs.pre_session_data->>'planned_duration')::INTEGER) AS planned_duration,
    COALESCE(psd.partner_status, cs.pre_session_data->>'partner_status') AS partner_status,
    COALESCE(psd.crowdedness, (cs.pre_session_data->>'crowdedness')::INTEGER) AS crowdedness,
    COALESCE(psd.sleep_quality, (cs.pre_session_data->>'sleep_quality')::INTEGER) AS sleep_quality,
    COALESCE(psd.sleep_hours, (cs.pre_session_data->>'sleep_hours')::DECIMAL) AS sleep_hours,
    COALESCE(psd.stress_level, (cs.pre_session_data->>'stress_level')::INTEGER) AS stress_level,
    COALESCE(psd.fueling_status, cs.pre_session_data->>'fueling_status') AS fueling_status,
    COALESCE(psd.hydration_feel, cs.pre_session_data->>'hydration_feel') AS hydration_feel,
    COALESCE(psd.skin_condition, cs.pre_session_data->>'skin_condition') AS skin_condition_pre,
    COALESCE(psd.finger_tendon_health, (cs.pre_session_data->>'finger_tendon_health')::INTEGER) AS finger_tendon_health,
    CASE 
        WHEN psd.doms_locations IS NOT NULL THEN psd.doms_locations
        WHEN cs.pre_session_data->'doms_locations' IS NOT NULL 
            THEN (SELECT array_agg(elem) FROM jsonb_array_elements_text(cs.pre_session_data->'doms_locations') AS elem)
        ELSE NULL
    END AS doms_locations,
    COALESCE(psd.doms_severity, (cs.pre_session_data->>'doms_severity')::INTEGER) AS doms_severity_pre,
    COALESCE(psd.menstrual_phase, cs.pre_session_data->>'menstrual_phase') AS menstrual_phase,
    COALESCE(psd.motivation, (cs.pre_session_data->>'motivation')::INTEGER) AS motivation,
    COALESCE(psd.primary_goal, cs.pre_session_data->>'primary_goal') AS primary_goal,
    COALESCE(psd.warmup_rpe, cs.pre_session_data->>'warmup_rpe') AS warmup_rpe,
    COALESCE(psd.warmup_compliance, cs.pre_session_data->>'warmup_compliance') AS warmup_compliance,
    COALESCE(psd.upper_body_power, (cs.pre_session_data->>'upper_body_power')::INTEGER) AS upper_body_power,
    COALESCE(psd.shoulder_integrity, (cs.pre_session_data->>'shoulder_integrity')::INTEGER) AS shoulder_integrity,
    COALESCE(psd.leg_springiness, (cs.pre_session_data->>'leg_springiness')::INTEGER) AS leg_springiness,
    COALESCE(psd.finger_strength, (cs.pre_session_data->>'finger_strength')::INTEGER) AS finger_strength_pre,
    psd.readiness_score,
    psd.recovery_status,
    
    -- Post-session data (prefer normalized table, fallback to JSONB)
    posd.id AS post_session_id,
    COALESCE(posd.hardest_grade_sent, cs.post_session_data->>'hardest_grade_sent') AS hardest_grade_sent,
    COALESCE(posd.hardest_grade_attempted, cs.post_session_data->>'hardest_grade_attempted') AS hardest_grade_attempted,
    COALESCE(posd.volume_estimation, cs.post_session_data->>'volume_estimation') AS volume_estimation,
    COALESCE(posd.strength_metrics, cs.post_session_data->'strength_metrics') AS strength_metrics,
    COALESCE(posd.dominant_style, cs.post_session_data->>'dominant_style') AS dominant_style,
    COALESCE(posd.rpe, (cs.post_session_data->>'rpe')::INTEGER) AS rpe,
    COALESCE(posd.session_density, cs.post_session_data->>'session_density') AS session_density,
    COALESCE(posd.intra_session_fueling, cs.post_session_data->>'intra_session_fueling') AS intra_session_fueling,
    CASE 
        WHEN posd.limiting_factors IS NOT NULL THEN posd.limiting_factors
        WHEN cs.post_session_data->'limiting_factors' IS NOT NULL 
            THEN (SELECT array_agg(elem) FROM jsonb_array_elements_text(cs.post_session_data->'limiting_factors') AS elem)
        ELSE NULL
    END AS limiting_factors,
    COALESCE(posd.flash_pump, (cs.post_session_data->>'flash_pump')::BOOLEAN) AS flash_pump,
    COALESCE(posd.new_pain_location, cs.post_session_data->>'new_pain_location') AS new_pain_location,
    COALESCE(posd.new_pain_severity, (cs.post_session_data->>'new_pain_severity')::INTEGER) AS new_pain_severity,
    COALESCE(posd.fingers_stiffer_than_usual, (cs.post_session_data->>'fingers_stiffer_than_usual')::BOOLEAN) AS fingers_stiffer_than_usual,
    COALESCE(posd.skin_status_post, cs.post_session_data->>'skin_status_post') AS skin_status_post,
    COALESCE(posd.doms_severity_post, (cs.post_session_data->>'doms_severity_post')::INTEGER) AS doms_severity_post,
    COALESCE(posd.finger_power_post, (cs.post_session_data->>'finger_power_post')::INTEGER) AS finger_power_post,
    COALESCE(posd.shoulder_mobility_post, (cs.post_session_data->>'shoulder_mobility_post')::INTEGER) AS shoulder_mobility_post,
    COALESCE(posd.prediction_error, (cs.post_session_data->>'prediction_error')::INTEGER) AS prediction_error,
    posd.session_quality_score,
    posd.fatigue_delta,
    posd.performance_vs_expected,
    
    cs.created_at,
    cs.updated_at
FROM
    climbing_sessions cs
LEFT JOIN
    pre_session_data psd ON cs.id = psd.session_id
LEFT JOIN
    post_session_data posd ON cs.id = posd.session_id;

-- Add a comment explaining the view's purpose
COMMENT ON VIEW complete_session_data IS 'Combines climbing_sessions with pre_session_data and post_session_data tables, with fallback to JSONB columns for backward compatibility';

