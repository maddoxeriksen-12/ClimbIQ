-- ============================================================================
-- EXPAND CLIMBING_SESSIONS TABLE WITH ALL PRE/POST SESSION FIELDS
-- ============================================================================
-- This migration adds dedicated columns for all the data collected in the
-- PreSessionForm and PostSessionForm for better querying and analysis.
-- ============================================================================

-- ============================================================================
-- PRE-SESSION COLUMNS
-- ============================================================================

-- Physical Readiness
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS sleep_hours DECIMAL;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS hours_since_meal TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS hydration TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS days_since_last_session INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS days_since_rest_day INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS muscle_soreness TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS soreness_locations TEXT[];

-- Substances
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS had_caffeine BOOLEAN DEFAULT false;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS caffeine_amount TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS had_alcohol BOOLEAN DEFAULT false;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS alcohol_amount TEXT;

-- Session Intent
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS primary_goal TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS session_focus TEXT;

-- Indoor-specific
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS gym_name TEXT;

-- Outdoor-specific
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS crag_name TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS rock_type TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS conditions_rating INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS temperature TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS humidity TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS recent_precipitation BOOLEAN;

-- Project-specific
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS is_project_session BOOLEAN DEFAULT false;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS project_session_number INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS current_high_point TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS project_goal TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS section_focus TEXT;

-- Training-specific
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS training_focus TEXT[];
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS planned_exercises TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS target_training_time INTEGER;

-- Bouldering/Lead specific
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS belay_type TEXT;

-- ============================================================================
-- POST-SESSION COLUMNS
-- ============================================================================

-- Core Outcomes
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS actual_vs_planned TEXT; -- early/on_time/longer
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS end_energy INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS skin_condition TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS felt_pumped_out BOOLEAN;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS could_have_done_more TEXT;

-- Behavioral Proxies
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS skipped_planned_climbs BOOLEAN;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS attempted_harder BOOLEAN;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS one_more_try_count INTEGER;

-- Goal Progress
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS moved_toward_goal TEXT; -- yes/somewhat/no/not_applicable

-- Project Session Outcomes
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS total_attempts INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS highest_point_reached TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS matched_high_point BOOLEAN;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS linked_more_moves BOOLEAN;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS sent_project BOOLEAN;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS send_attempts INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS fall_location TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS same_crux BOOLEAN;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS crux_type TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS limiting_factors TEXT[];
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS beta_changes TEXT;

-- Lead Session Outcomes
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS routes_attempted INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS total_pitches INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS onsight_rate DECIMAL;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS falls_count INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS fall_types TEXT[];
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS longest_route TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS rest_time_between_routes INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS head_game_falls INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS backed_off_due_to_fear BOOLEAN;

-- Outdoor Session Outcomes
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS conditions_vs_expected TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS skin_lasted BOOLEAN;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS conditions_affected_performance TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS rock_quality TEXT;

-- Recreational Session
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS had_fun BOOLEAN;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS standout_moments TEXT;

-- Training Session Outcomes
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS exercises_completed JSONB;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS training_quality INTEGER;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS progressed_or_regressed TEXT;
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS prs_achieved TEXT[];

-- Live Climb Tracking
ALTER TABLE climbing_sessions ADD COLUMN IF NOT EXISTS climbs_log JSONB DEFAULT '[]';
-- climbs_log stores array of: { grade, type, sent, flashed, attempts, notes }

-- ============================================================================
-- INDEXES FOR NEW COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sessions_primary_goal ON climbing_sessions(primary_goal);
CREATE INDEX IF NOT EXISTS idx_sessions_is_project ON climbing_sessions(is_project_session);
CREATE INDEX IF NOT EXISTS idx_sessions_gym_name ON climbing_sessions(gym_name);
CREATE INDEX IF NOT EXISTS idx_sessions_crag_name ON climbing_sessions(crag_name);
CREATE INDEX IF NOT EXISTS idx_sessions_days_since_session ON climbing_sessions(days_since_last_session);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN climbing_sessions.sleep_hours IS 'Hours of sleep the night before';
COMMENT ON COLUMN climbing_sessions.hours_since_meal IS 'Time since last meal (0-1hr, 1-2hr, 2-4hr, 4+hr)';
COMMENT ON COLUMN climbing_sessions.hydration IS 'Self-assessed hydration level';
COMMENT ON COLUMN climbing_sessions.days_since_last_session IS 'Days since previous climbing session';
COMMENT ON COLUMN climbing_sessions.days_since_rest_day IS 'Consecutive days without full rest';
COMMENT ON COLUMN climbing_sessions.primary_goal IS 'Main intention for the session';
COMMENT ON COLUMN climbing_sessions.climbs_log IS 'Array of climbs tracked during session with grade, type, sent, flashed, attempts';

