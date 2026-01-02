-- Migration: Action IDs + audit logging + execution/outcomes scaffolding
-- Purpose:
--   1) Add first-class action_id + planned/executed workout fields for attribution.
--   2) Add audit tables to store candidate plans + evidence bundles (counterfactual set).
--   3) Add real execution/outcomes tables (no sim contamination).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================================
-- 1) Session execution attribution (Layer 4)
-- =====================================================================================

ALTER TABLE session_execution_state
  ADD COLUMN IF NOT EXISTS planned_action_id TEXT,
  ADD COLUMN IF NOT EXISTS planned_workout JSONB,
  ADD COLUMN IF NOT EXISTS executed_workout JSONB;

CREATE INDEX IF NOT EXISTS idx_session_exec_planned_action_id
  ON session_execution_state(planned_action_id)
  WHERE planned_action_id IS NOT NULL;

-- =====================================================================================
-- 2) Real session execution (separate physical table)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS real_session_execution (
  real_session_execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES climbing_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  planned_action_id TEXT,

  executed_workout JSONB NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'real_user' CHECK (source_type = 'real_user'),
  trust_weight NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (trust_weight >= 0 AND trust_weight <= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_real_exec_user_time ON real_session_execution(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_real_exec_action_id ON real_session_execution(planned_action_id) WHERE planned_action_id IS NOT NULL;

-- =====================================================================================
-- 3) Outcomes (decomposed reward)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS session_outcomes (
  session_outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES climbing_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  reward_progress DOUBLE PRECISION,
  reward_adherence DOUBLE PRECISION,
  risk_penalty DOUBLE PRECISION,
  enjoyment DOUBLE PRECISION,
  total_reward DOUBLE PRECISION,

  details JSONB NOT NULL DEFAULT '{}'::JSONB,

  source_type TEXT NOT NULL DEFAULT 'real_user' CHECK (source_type = 'real_user'),
  trust_weight NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (trust_weight >= 0 AND trust_weight <= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_outcomes_user_time ON session_outcomes(user_id, created_at DESC);

-- =====================================================================================
-- 4) Audit logging for recommendation runs + candidate plans (counterfactual set)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS session_recommendation_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES climbing_sessions(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Inputs
  user_state JSONB NOT NULL,
  goal_context JSONB,

  -- Outputs
  action_id TEXT,
  planned_workout JSONB,
  planned_dose_features JSONB,

  -- Evidence bundle (structured refs for models; snippets for UI only)
  evidence_bundle JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Candidate set for counterfactual eval
  candidate_plans JSONB NOT NULL DEFAULT '[]'::JSONB,
  candidate_scores JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Provenance
  model_versions JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_runs_user_time ON session_recommendation_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_action_id ON session_recommendation_runs(action_id) WHERE action_id IS NOT NULL;

-- =====================================================================================
-- 5) RLS (optional)
-- =====================================================================================

ALTER TABLE real_session_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recommendation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own real execution" ON real_session_execution;
CREATE POLICY "Users view own real execution"
ON real_session_execution FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own real execution" ON real_session_execution;
CREATE POLICY "Users manage own real execution"
ON real_session_execution FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own outcomes" ON session_outcomes;
CREATE POLICY "Users view own outcomes"
ON session_outcomes FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages outcomes" ON session_outcomes;
CREATE POLICY "Service role manages outcomes"
ON session_outcomes FOR ALL
TO authenticated
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users view own recommendation runs" ON session_recommendation_runs;
CREATE POLICY "Users view own recommendation runs"
ON session_recommendation_runs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages recommendation runs" ON session_recommendation_runs;
CREATE POLICY "Service role manages recommendation runs"
ON session_recommendation_runs FOR ALL
TO authenticated
USING (auth.role() = 'service_role');
