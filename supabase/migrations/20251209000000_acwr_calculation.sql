-- Migration: ACWR (Acute:Chronic Workload Ratio) Calculation
-- Layer 1: Context & Input - Critical for injury risk prediction
-- ACWR = 7-day workload / 28-day rolling average workload

-- Materialized view for ACWR calculation
-- Refreshed daily via Dagster pipeline
CREATE MATERIALIZED VIEW IF NOT EXISTS user_acwr AS
WITH session_loads AS (
    SELECT
        user_id,
        DATE(started_at) AS session_date,
        -- Session load = intensity (RPE) * duration (minutes)
        -- Use COALESCE to handle null values with reasonable defaults
        (COALESCE(session_rpe, 5) * COALESCE(actual_duration_minutes, 60)) AS session_load
    FROM climbing_sessions
    WHERE started_at >= NOW() - INTERVAL '28 days'
      AND status = 'completed'
),
-- Acute load: average daily load over last 7 days
acute AS (
    SELECT
        user_id,
        COALESCE(SUM(session_load) / 7.0, 0) AS acute_load,
        COUNT(*) AS sessions_7d
    FROM session_loads
    WHERE session_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY user_id
),
-- Chronic load: average daily load over last 28 days
chronic AS (
    SELECT
        user_id,
        COALESCE(SUM(session_load) / 28.0, 0) AS chronic_load,
        COUNT(*) AS sessions_28d
    FROM session_loads
    GROUP BY user_id
)
SELECT
    COALESCE(a.user_id, c.user_id) AS user_id,
    COALESCE(a.acute_load, 0) AS acute_load,
    COALESCE(c.chronic_load, 0) AS chronic_load,
    COALESCE(a.sessions_7d, 0) AS sessions_7d,
    COALESCE(c.sessions_28d, 0) AS sessions_28d,
    -- ACWR calculation with null protection
    CASE
        WHEN COALESCE(c.chronic_load, 0) > 0 THEN COALESCE(a.acute_load, 0) / c.chronic_load
        ELSE 1.0  -- Default to 1.0 (optimal) if no chronic load data
    END AS acwr,
    -- Risk zone classification based on research
    -- Gabbett (2016): ACWR "sweet spot" is 0.8-1.3
    CASE
        WHEN COALESCE(c.chronic_load, 0) = 0 THEN 'insufficient_data'
        WHEN COALESCE(a.acute_load, 0) / NULLIF(c.chronic_load, 0) > 1.5 THEN 'high_risk'
        WHEN COALESCE(a.acute_load, 0) / NULLIF(c.chronic_load, 0) > 1.3 THEN 'moderate_risk'
        WHEN COALESCE(a.acute_load, 0) / NULLIF(c.chronic_load, 0) < 0.8 THEN 'undertrained'
        ELSE 'optimal'
    END AS risk_zone,
    -- Injury probability estimation (based on Gabbett 2016 research)
    CASE
        WHEN COALESCE(c.chronic_load, 0) = 0 THEN NULL
        WHEN COALESCE(a.acute_load, 0) / NULLIF(c.chronic_load, 0) > 1.5 THEN 0.21  -- 21% injury likelihood
        WHEN COALESCE(a.acute_load, 0) / NULLIF(c.chronic_load, 0) > 1.3 THEN 0.15  -- 15% injury likelihood
        WHEN COALESCE(a.acute_load, 0) / NULLIF(c.chronic_load, 0) < 0.8 THEN 0.12  -- 12% (undertrained also risky)
        ELSE 0.05  -- 5% baseline in optimal zone
    END AS injury_probability,
    NOW() AS calculated_at
FROM acute a
FULL OUTER JOIN chronic c ON a.user_id = c.user_id;

-- Create unique index for efficient user lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_acwr_user ON user_acwr(user_id);

-- Create index on risk zone for quick filtering
CREATE INDEX IF NOT EXISTS idx_acwr_risk_zone ON user_acwr(risk_zone);

-- Function to refresh ACWR materialized view
-- Called by Dagster daily or after batch session imports
CREATE OR REPLACE FUNCTION refresh_acwr()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_acwr;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get ACWR for a specific user
-- Returns default values if no data exists
CREATE OR REPLACE FUNCTION get_user_acwr(p_user_id UUID)
RETURNS TABLE (
    acute_load FLOAT,
    chronic_load FLOAT,
    acwr FLOAT,
    risk_zone TEXT,
    injury_probability FLOAT,
    sessions_7d INT,
    sessions_28d INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ua.acute_load::FLOAT,
        ua.chronic_load::FLOAT,
        ua.acwr::FLOAT,
        ua.risk_zone::TEXT,
        ua.injury_probability::FLOAT,
        ua.sessions_7d::INT,
        ua.sessions_28d::INT
    FROM user_acwr ua
    WHERE ua.user_id = p_user_id;

    -- If no rows returned, return defaults
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            0.0::FLOAT AS acute_load,
            0.0::FLOAT AS chronic_load,
            1.0::FLOAT AS acwr,
            'insufficient_data'::TEXT AS risk_zone,
            NULL::FLOAT AS injury_probability,
            0::INT AS sessions_7d,
            0::INT AS sessions_28d;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table to store ACWR history for trend analysis
CREATE TABLE IF NOT EXISTS acwr_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Snapshot values
    acute_load FLOAT NOT NULL,
    chronic_load FLOAT NOT NULL,
    acwr FLOAT NOT NULL,
    risk_zone TEXT NOT NULL,
    injury_probability FLOAT,
    sessions_7d INT,
    sessions_28d INT,

    -- When this snapshot was taken
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate snapshots for same user/date
    UNIQUE(user_id, snapshot_date)
);

-- Index for efficient history queries
CREATE INDEX IF NOT EXISTS idx_acwr_history_user_date ON acwr_history(user_id, snapshot_date DESC);

-- Function to snapshot current ACWR to history
-- Called by Dagster daily
CREATE OR REPLACE FUNCTION snapshot_acwr_history()
RETURNS INT AS $$
DECLARE
    rows_inserted INT;
BEGIN
    INSERT INTO acwr_history (user_id, acute_load, chronic_load, acwr, risk_zone, injury_probability, sessions_7d, sessions_28d)
    SELECT
        user_id,
        acute_load,
        chronic_load,
        acwr,
        risk_zone,
        injury_probability,
        sessions_7d,
        sessions_28d
    FROM user_acwr
    WHERE risk_zone != 'insufficient_data'
    ON CONFLICT (user_id, snapshot_date)
    DO UPDATE SET
        acute_load = EXCLUDED.acute_load,
        chronic_load = EXCLUDED.chronic_load,
        acwr = EXCLUDED.acwr,
        risk_zone = EXCLUDED.risk_zone,
        injury_probability = EXCLUDED.injury_probability,
        sessions_7d = EXCLUDED.sessions_7d,
        sessions_28d = EXCLUDED.sessions_28d;

    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on history table
ALTER TABLE acwr_history ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only view their own ACWR history
CREATE POLICY "Users can view own ACWR history"
ON acwr_history FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Grant access to the materialized view
GRANT SELECT ON user_acwr TO authenticated;

-- Comments for documentation
COMMENT ON MATERIALIZED VIEW user_acwr IS 'ACWR (Acute:Chronic Workload Ratio) calculation per user. Refreshed daily via Dagster. ACWR > 1.5 = high injury risk, 0.8-1.3 = optimal training zone.';
COMMENT ON TABLE acwr_history IS 'Historical snapshots of ACWR values for trend analysis and learning loop.';
COMMENT ON FUNCTION refresh_acwr() IS 'Refreshes the user_acwr materialized view. Call after bulk session imports or daily via scheduler.';
COMMENT ON FUNCTION get_user_acwr(UUID) IS 'Returns ACWR data for a specific user with default values if no data exists.';
