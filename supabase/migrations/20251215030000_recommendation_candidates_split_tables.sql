-- Migration: Split tables for planned_workout/dose_features/rationale/predicted_outcomes
-- Purpose:
--   Implement production logging architecture for Top-K candidate plans with a
--   reranker and full counterfactual audit, using normalized tables.
--
-- Notes:
--   - We keep legacy JSONB columns on session_recommendation_runs for now
--     (dual-write window), but add FK references as the source of truth.
--   - BetaLab tables remain separate; optional backfill can dedupe by action_id.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================================
-- 1) Normalized artifacts
-- =====================================================================================

CREATE TABLE IF NOT EXISTS planned_workout (
  planned_workout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  action_id TEXT NOT NULL UNIQUE,
  schema_version TEXT NOT NULL DEFAULT '1.0',

  -- Canonical PlannedWorkout JSON (schema validated in backend)
  planned_workout_json JSONB NOT NULL,

  -- Exact object used to compute action_id (after stripping non-semantic fields)
  normalized_hash_input_json JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planned_workout_action_id ON planned_workout(action_id);

CREATE TABLE IF NOT EXISTS dose_features (
  dose_features_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  planned_workout_id UUID NOT NULL REFERENCES planned_workout(planned_workout_id) ON DELETE CASCADE,

  version TEXT NOT NULL DEFAULT '1.0',
  features_json JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dose_features_planned_workout ON dose_features(planned_workout_id);

CREATE TABLE IF NOT EXISTS rationale (
  rationale_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tags_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  signals_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  risks_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS predicted_outcomes (
  predicted_outcomes_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  version TEXT NOT NULL DEFAULT '1.0',
  outcomes_json JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================================
-- 2) Recommendation run linkage (final selection references)
-- =====================================================================================

ALTER TABLE session_recommendation_runs
  ADD COLUMN IF NOT EXISTS final_action_id TEXT,
  ADD COLUMN IF NOT EXISTS final_planned_workout_id UUID REFERENCES planned_workout(planned_workout_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_dose_features_id UUID REFERENCES dose_features(dose_features_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_predicted_outcomes_id UUID REFERENCES predicted_outcomes(predicted_outcomes_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_rationale_id UUID REFERENCES rationale(rationale_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_runs_final_action_id ON session_recommendation_runs(final_action_id)
  WHERE final_action_id IS NOT NULL;

-- =====================================================================================
-- 3) Candidate set table (counterfactuals)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS session_recommendation_candidates (
  candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  run_id UUID NOT NULL REFERENCES session_recommendation_runs(run_id) ON DELETE CASCADE,
  rank INT NOT NULL CHECK (rank >= 1 AND rank <= 50),

  action_id TEXT,

  planned_workout_id UUID REFERENCES planned_workout(planned_workout_id) ON DELETE SET NULL,
  dose_features_id UUID REFERENCES dose_features(dose_features_id) ON DELETE SET NULL,
  predicted_outcomes_id UUID REFERENCES predicted_outcomes(predicted_outcomes_id) ON DELETE SET NULL,
  rationale_id UUID REFERENCES rationale(rationale_id) ON DELETE SET NULL,

  score_total DOUBLE PRECISION,
  score_components JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (run_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_candidates_run_rank ON session_recommendation_candidates(run_id, rank);
CREATE INDEX IF NOT EXISTS idx_candidates_action_id ON session_recommendation_candidates(action_id)
  WHERE action_id IS NOT NULL;

-- =====================================================================================
-- 4) RLS (optional; service role writes, users can read own runs/candidates)
-- =====================================================================================

ALTER TABLE planned_workout ENABLE ROW LEVEL SECURITY;
ALTER TABLE dose_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE rationale ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicted_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recommendation_candidates ENABLE ROW LEVEL SECURITY;

-- Only service role manages artifacts (since they can contain model internals)
DROP POLICY IF EXISTS "Service role manages planned_workout" ON planned_workout;
CREATE POLICY "Service role manages planned_workout"
ON planned_workout FOR ALL
TO authenticated
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages dose_features" ON dose_features;
CREATE POLICY "Service role manages dose_features"
ON dose_features FOR ALL
TO authenticated
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages rationale" ON rationale;
CREATE POLICY "Service role manages rationale"
ON rationale FOR ALL
TO authenticated
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages predicted_outcomes" ON predicted_outcomes;
CREATE POLICY "Service role manages predicted_outcomes"
ON predicted_outcomes FOR ALL
TO authenticated
USING (auth.role() = 'service_role');

-- Users can read candidates for their own runs (via join constraint)
DROP POLICY IF EXISTS "Users view candidates for own runs" ON session_recommendation_candidates;
CREATE POLICY "Users view candidates for own runs"
ON session_recommendation_candidates FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM session_recommendation_runs r
    WHERE r.run_id = session_recommendation_candidates.run_id
      AND r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role manages candidates" ON session_recommendation_candidates;
CREATE POLICY "Service role manages candidates"
ON session_recommendation_candidates FOR ALL
TO authenticated
USING (auth.role() = 'service_role');

