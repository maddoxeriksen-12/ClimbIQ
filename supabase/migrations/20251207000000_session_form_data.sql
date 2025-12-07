-- Migration: Complete Pre-Session and Post-Session Form Data Storage
-- Date: 2024-12-07
-- Description: Creates tables to store all data from PreSessionForm and PostSessionForm

-- ============================================
-- PRE-SESSION DATA TABLE
-- ============================================
-- Stores all data collected before a climbing session begins

CREATE TABLE IF NOT EXISTS pre_session_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES climbing_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- A. Context & Environment
    session_environment TEXT, -- indoor_bouldering, indoor_rope, indoor_both, outdoor_bouldering, outdoor_rope, outdoor_both, training, gym_training
    planned_duration INTEGER, -- minutes
    partner_status TEXT, -- solo, partner_casual, partner_serious, group
    crowdedness INTEGER CHECK (crowdedness >= 1 AND crowdedness <= 5), -- 1-5 scale
    
    -- B. Systemic Recovery & Lifestyle
    sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 10), -- 1-10 scale
    sleep_hours DECIMAL(4,2), -- optional, hours slept
    stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10), -- 1-10 scale
    fueling_status TEXT, -- fasted, light_snack, full_meal_1_2hr, full_meal_3hr
    hydration_feel TEXT, -- dehydrated, neutral, well_hydrated
    skin_condition TEXT, -- fresh, pink, split, sweaty, dry, worn
    finger_tendon_health INTEGER CHECK (finger_tendon_health >= 1 AND finger_tendon_health <= 10), -- 1-10 scale
    doms_locations TEXT[], -- array: none, forearms, upper_arms_shoulders, back_lats, core, legs
    doms_severity INTEGER CHECK (doms_severity >= 1 AND doms_severity <= 10), -- 1-10 scale
    menstrual_phase TEXT, -- follicular, ovulation, luteal, menstruation (nullable for non-female users)
    
    -- C. Intent & Psych
    motivation INTEGER CHECK (motivation >= 1 AND motivation <= 10), -- 1-10 scale
    primary_goal TEXT, -- limit_bouldering, volume_mileage, aerobic_capacity, anaerobic_capacity, strength_power, technique_drills, active_recovery, social_fun, tell_me
    
    -- D. Physical Readiness (Biofeedback) - Post Warm-up
    warmup_rpe TEXT, -- easy, just_right, heavy, failed
    warmup_compliance TEXT, -- exact, skipped, modified_pain, own_routine
    upper_body_power INTEGER CHECK (upper_body_power >= 1 AND upper_body_power <= 10), -- 1-10 scale
    shoulder_integrity INTEGER CHECK (shoulder_integrity >= 1 AND shoulder_integrity <= 10), -- 1-10 scale
    leg_springiness INTEGER CHECK (leg_springiness >= 1 AND leg_springiness <= 10), -- 1-10 scale (CNS readiness)
    finger_strength INTEGER CHECK (finger_strength >= 1 AND finger_strength <= 10), -- 1-10 scale
    
    -- Computed/Derived Fields (for model training)
    readiness_score DECIMAL(5,2), -- computed overall readiness 0-100
    recovery_status TEXT, -- computed: fresh, moderate, fatigued, overtrained
    
    CONSTRAINT unique_session_pre_data UNIQUE (session_id)
);

-- ============================================
-- POST-SESSION DATA TABLE
-- ============================================
-- Stores all data collected after a climbing session ends

CREATE TABLE IF NOT EXISTS post_session_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES climbing_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- A. Objective Performance
    hardest_grade_sent TEXT, -- V-scale (VB-V15+) or YDS (5.5-5.15a+)
    hardest_grade_attempted TEXT, -- V-scale or YDS
    volume_estimation TEXT, -- low, moderate, high, very_high
    objective_strength_metric TEXT, -- free text: "+45lbs hang", "BW+70 pull-up", "N/A"
    dominant_style TEXT, -- overhang, vertical, slab, crack, mixed
    
    -- B. Subjective Experience
    rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10), -- 1-10 Rate of Perceived Exertion
    session_density TEXT, -- rushed, optimal, slow
    intra_session_fueling TEXT, -- none, water_only, simple_carbs, complex_carbs
    
    -- C. Failure Analysis
    limiting_factors TEXT[], -- array (max 2): forearm_pump, power, finger_strength, skin_pain, technique, fear, cns_fatigue, metabolic, time
    flash_pump BOOLEAN DEFAULT FALSE, -- indicates warm-up failure
    
    -- D. Health & Injury Update
    new_pain_location TEXT, -- none, fingers, hands_wrists, forearms, elbows, shoulders, back, other
    new_pain_severity INTEGER CHECK (new_pain_severity >= 0 AND new_pain_severity <= 10), -- 0 = no pain, 1-10 severity
    fingers_stiffer_than_usual BOOLEAN DEFAULT FALSE,
    skin_status_post TEXT, -- intact, worn_thin, split_bleeding
    doms_severity_post INTEGER CHECK (doms_severity_post >= 1 AND doms_severity_post <= 10), -- 1-10 scale
    finger_power_post INTEGER CHECK (finger_power_post >= 1 AND finger_power_post <= 10), -- 1-10 scale
    shoulder_mobility_post INTEGER CHECK (shoulder_mobility_post >= 1 AND shoulder_mobility_post <= 10), -- 1-10 scale
    
    -- E. The Learning Loop
    prediction_error INTEGER CHECK (prediction_error >= -5 AND prediction_error <= 5), -- -5 to +5 (worse to better than expected)
    
    -- Computed/Derived Fields (for model training)
    session_quality_score DECIMAL(5,2), -- computed overall session quality 0-100
    fatigue_delta DECIMAL(5,2), -- change in fatigue from pre to post
    performance_vs_expected TEXT, -- computed: underperformed, as_expected, overperformed
    
    CONSTRAINT unique_session_post_data UNIQUE (session_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Pre-session indexes
CREATE INDEX IF NOT EXISTS idx_pre_session_user ON pre_session_data(user_id);
CREATE INDEX IF NOT EXISTS idx_pre_session_session ON pre_session_data(session_id);
CREATE INDEX IF NOT EXISTS idx_pre_session_created ON pre_session_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pre_session_readiness ON pre_session_data(readiness_score);
CREATE INDEX IF NOT EXISTS idx_pre_session_goal ON pre_session_data(primary_goal);

-- Post-session indexes
CREATE INDEX IF NOT EXISTS idx_post_session_user ON post_session_data(user_id);
CREATE INDEX IF NOT EXISTS idx_post_session_session ON post_session_data(session_id);
CREATE INDEX IF NOT EXISTS idx_post_session_created ON post_session_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_session_grade_sent ON post_session_data(hardest_grade_sent);
CREATE INDEX IF NOT EXISTS idx_post_session_rpe ON post_session_data(rpe);
CREATE INDEX IF NOT EXISTS idx_post_session_prediction_error ON post_session_data(prediction_error);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE pre_session_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_session_data ENABLE ROW LEVEL SECURITY;

-- Pre-session policies
DROP POLICY IF EXISTS "Users can view own pre_session_data" ON pre_session_data;
CREATE POLICY "Users can view own pre_session_data" ON pre_session_data
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own pre_session_data" ON pre_session_data;
CREATE POLICY "Users can insert own pre_session_data" ON pre_session_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pre_session_data" ON pre_session_data;
CREATE POLICY "Users can update own pre_session_data" ON pre_session_data
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own pre_session_data" ON pre_session_data;
CREATE POLICY "Users can delete own pre_session_data" ON pre_session_data
    FOR DELETE USING (auth.uid() = user_id);

-- Post-session policies
DROP POLICY IF EXISTS "Users can view own post_session_data" ON post_session_data;
CREATE POLICY "Users can view own post_session_data" ON post_session_data
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own post_session_data" ON post_session_data;
CREATE POLICY "Users can insert own post_session_data" ON post_session_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own post_session_data" ON post_session_data;
CREATE POLICY "Users can update own post_session_data" ON post_session_data
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own post_session_data" ON post_session_data;
CREATE POLICY "Users can delete own post_session_data" ON post_session_data
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pre-session trigger
DROP TRIGGER IF EXISTS update_pre_session_data_updated_at ON pre_session_data;
CREATE TRIGGER update_pre_session_data_updated_at
    BEFORE UPDATE ON pre_session_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Post-session trigger
DROP TRIGGER IF EXISTS update_post_session_data_updated_at ON post_session_data;
CREATE TRIGGER update_post_session_data_updated_at
    BEFORE UPDATE ON post_session_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER VIEW: Complete Session Data
-- ============================================
-- Joins climbing_sessions with pre and post data for easy querying

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
    post.objective_strength_metric,
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
-- GRANT PERMISSIONS
-- ============================================

GRANT SELECT ON complete_session_data TO authenticated;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE pre_session_data IS 'Stores pre-session check-in data including context, recovery status, intent, and physical readiness';
COMMENT ON TABLE post_session_data IS 'Stores post-session log data including performance metrics, subjective experience, failure analysis, and health updates';
COMMENT ON VIEW complete_session_data IS 'Unified view joining climbing sessions with all pre and post session data for analysis and model training';

COMMENT ON COLUMN pre_session_data.readiness_score IS 'Computed score (0-100) based on sleep, stress, recovery, and physical readiness indicators';
COMMENT ON COLUMN pre_session_data.recovery_status IS 'Computed category: fresh, moderate, fatigued, or overtrained';
COMMENT ON COLUMN post_session_data.prediction_error IS 'User-reported difference between expected and actual performance (-5 worse to +5 better)';
COMMENT ON COLUMN post_session_data.session_quality_score IS 'Computed score (0-100) based on performance, RPE, and limiting factors';
COMMENT ON COLUMN post_session_data.fatigue_delta IS 'Computed change in fatigue indicators from pre to post session';

