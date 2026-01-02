-- Migration: BetaLab sim core (Expert Game + Expert Library)
-- Purpose:
--   Add SIM-ONLY tables for deterministic expert-game episodes and a two-layer
--   expert library (raw vs curated) with rubric gating.
--
-- Hard rule:
--   These tables are physically separate from real-user tables.
--   SIM outcomes never update real-user priors/posteriors.

-- =====================================================================================
-- 0) Extensions
-- =====================================================================================

-- gen_random_uuid() is used across the schema; ensure pgcrypto exists.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================================
-- 1) Transition model parameters (versioned, reproducible)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS transition_param_sets (
  transition_param_set_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (name, version)
);

CREATE TABLE IF NOT EXISTS transition_params (
  transition_param_set_id UUID NOT NULL REFERENCES transition_param_sets(transition_param_set_id) ON DELETE CASCADE,
  param_key TEXT NOT NULL,
  value_num DOUBLE PRECISION,
  value_json JSONB,
  units TEXT,
  notes TEXT,
  PRIMARY KEY (transition_param_set_id, param_key),
  CHECK (
    (value_num IS NOT NULL AND value_json IS NULL)
    OR (value_num IS NULL AND value_json IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_transition_param_sets_active ON transition_param_sets(is_active) WHERE is_active = TRUE;

-- Seed a default active parameter set + recommended keys.
WITH inserted AS (
  INSERT INTO transition_param_sets (name, version, description, is_active)
  VALUES (
    'rules_v1_default',
    '1.0.0',
    'Default BetaLab transition/readiness/event/dose parameters.',
    TRUE
  )
  ON CONFLICT (name, version) DO UPDATE SET
    description = EXCLUDED.description
  RETURNING transition_param_set_id
)
INSERT INTO transition_params (transition_param_set_id, param_key, value_num, value_json, units, notes)
SELECT
  inserted.transition_param_set_id,
  p.param_key,
  p.value_num,
  p.value_json,
  p.units,
  p.notes
FROM inserted
CROSS JOIN LATERAL (
  VALUES
    -- 1) Capability adaptation
    ('adapt.base_rate', NULL, '{
      "strength_fingers": 0.020,
      "strength_pull": 0.015,
      "power": 0.015,
      "aerobic_capacity": 0.020,
      "anaerobic_capacity": 0.018,
      "technique": 0.012,
      "movement_skill": 0.012,
      "injury_risk": 0.000,
      "fatigue_acute": 0.000,
      "motivation": 0.000,
      "skin_limit": 0.000
    }'::JSONB, 'per_session', 'Baseline adaptation rates by latent dimension.'),
    ('adapt.intensity_sensitivity', NULL, '{
      "strength_fingers": 0.60,
      "strength_pull": 0.50,
      "power": 0.70,
      "aerobic_capacity": 0.20,
      "anaerobic_capacity": 0.35,
      "technique": 0.25,
      "movement_skill": 0.25
    }'::JSONB, 'unitless', 'How strongly high intensity contributes to gains.'),
    ('adapt.volume_sensitivity', NULL, '{
      "strength_fingers": 0.25,
      "strength_pull": 0.20,
      "power": 0.15,
      "aerobic_capacity": 0.65,
      "anaerobic_capacity": 0.50,
      "technique": 0.35,
      "movement_skill": 0.35
    }'::JSONB, 'unitless', 'How strongly volume (TUT/attempts) contributes to gains.'),
    ('adapt.diminishing_returns_k', 3.0, NULL, 'unitless', 'Diminishing returns curvature; higher = faster saturation.'),

    -- 2) Fatigue / recovery
    ('fatigue.add_per_hi_attempt', 0.030, NULL, 'fatigue_units', 'Acute fatigue added per high-intensity attempt.'),
    ('fatigue.add_per_min_tut', 0.015, NULL, 'fatigue_units', 'Acute fatigue added per minute time-under-tension.'),
    ('fatigue.recovery_half_life_sessions', 2.5, NULL, 'sessions', 'Half-life of acute fatigue (sessions).'),
    ('fatigue.sleep_modifier', 0.35, NULL, 'unitless', 'How much low sleep increases fatigue carryover.'),

    -- 3) Injury risk
    ('injury.base_risk', 0.02, NULL, 'probability', 'Base injury risk per session.'),
    ('injury.risk_from_fatigue', 0.35, NULL, 'unitless', 'Multiplier for injury risk from fatigue.'),
    ('injury.risk_from_intensity', 0.40, NULL, 'unitless', 'Multiplier for injury risk from intensity.'),
    ('injury.risk_from_history', 0.25, NULL, 'unitless', 'Multiplier for injury risk from baseline injury history flags.'),
    ('injury.cooldown_sessions', 10.0, NULL, 'sessions', 'Cooldown after micro-injury events.'),

    -- 4) Adherence model
    ('adherence.bias', 1.3, NULL, 'logit', 'Baseline adherence bias toward completing plan.'),
    ('adherence.weight_time_over_budget', 2.0, NULL, 'logit', 'Penalty when planned time exceeds time budget.'),
    ('adherence.weight_fatigue', 1.2, NULL, 'logit', 'Penalty from high fatigue.'),
    ('adherence.weight_motivation', 0.9, NULL, 'logit', 'Motivation increases adherence.'),
    ('adherence.weight_complexity', 0.6, NULL, 'logit', 'Complex plans reduce adherence.'),

    -- 5) Noise
    ('noise.state_sigma', NULL, '{
      "strength_fingers": 0.020,
      "strength_pull": 0.020,
      "power": 0.020,
      "aerobic_capacity": 0.015,
      "anaerobic_capacity": 0.015,
      "technique": 0.010,
      "movement_skill": 0.010,
      "injury_risk": 0.010,
      "fatigue_acute": 0.020,
      "motivation": 0.020,
      "skin_limit": 0.020
    }'::JSONB, 'sigma', 'Latent state noise per dimension.'),
    ('noise.execution_sigma', NULL, '{
      "hi_attempts": 0.20,
      "tut_minutes": 0.15,
      "volume_score": 0.15,
      "fatigue_cost": 0.20
    }'::JSONB, 'sigma', 'Execution noise by dose feature.'),

    -- 6) Dose extraction
    ('dose.hi_attempt_threshold', 0.85, NULL, 'intensity_0_1', 'Threshold above which attempts count as HI attempts.'),
    ('dose.intensity_map', NULL, '{
      "default": {
        "grade_band": {
          "easy": 0.40,
          "moderate": 0.65,
          "hard": 0.85,
          "limit": 0.95
        }
      }
    }'::JSONB, 'map', 'Mapping from grade bands / percent_max to intensity_0_1.' )
) AS p(param_key, value_num, value_json, units, notes)
ON CONFLICT (transition_param_set_id, param_key) DO NOTHING;

-- =====================================================================================
-- 2) Episodes (sim)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS sim_episodes (
  episode_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  coach_role TEXT NOT NULL DEFAULT 'coach' CHECK (coach_role IN ('coach', 'expert', 'reviewer')),

  persona_id UUID NOT NULL DEFAULT gen_random_uuid(),

  rng_seed BIGINT NOT NULL,
  engine_version TEXT NOT NULL,
  transition_param_set_id UUID NOT NULL REFERENCES transition_param_sets(transition_param_set_id) ON DELETE RESTRICT,

  max_t INT NOT NULL DEFAULT 30 CHECK (max_t BETWEEN 1 AND 365),
  current_t INT NOT NULL DEFAULT 1 CHECK (current_t BETWEEN 1 AND 365),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'aborted')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_episodes_coach ON sim_episodes(coach_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sim_episodes_status ON sim_episodes(status);

-- =====================================================================================
-- 3) scenario_state (authoritative world state shown to coach)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS scenario_state (
  scenario_state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES sim_episodes(episode_id) ON DELETE CASCADE,
  t_index INT NOT NULL CHECK (t_index BETWEEN 1 AND 365),
  state_time TIMESTAMPTZ NOT NULL DEFAULT now(),

  persona_id UUID NOT NULL,
  baseline_profile JSONB NOT NULL,
  potential_caps JSONB NOT NULL,

  latent_state JSONB NOT NULL,
  latent_uncertainty JSONB NOT NULL DEFAULT '{}'::JSONB,

  readiness_state JSONB NOT NULL,
  constraints_state JSONB NOT NULL,
  phase_state JSONB NOT NULL,

  sim_priors_snapshot JSONB NOT NULL,
  sim_priors_version TEXT NOT NULL,

  active_event JSONB,
  event_cooldowns JSONB NOT NULL,
  event_budget_remaining JSONB NOT NULL,

  rng_seed BIGINT NOT NULL,
  engine_version TEXT NOT NULL,
  transition_param_set_id UUID NOT NULL,

  prev_scenario_state_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (episode_id, t_index),
  FOREIGN KEY (transition_param_set_id) REFERENCES transition_param_sets(transition_param_set_id) ON DELETE RESTRICT,
  FOREIGN KEY (prev_scenario_state_id) REFERENCES scenario_state(scenario_state_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scenario_state_episode_t ON scenario_state(episode_id, t_index);
CREATE INDEX IF NOT EXISTS idx_scenario_state_persona ON scenario_state(persona_id);

-- =====================================================================================
-- 4) expert_recommendations (raw expert actions from game)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS expert_recommendations (
  expert_rec_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES sim_episodes(episode_id) ON DELETE CASCADE,
  t_index INT NOT NULL CHECK (t_index BETWEEN 1 AND 365),

  scenario_state_id UUID NOT NULL REFERENCES scenario_state(scenario_state_id) ON DELETE RESTRICT,

  action_id TEXT NOT NULL,
  planned_workout JSONB NOT NULL,
  planned_dose_features JSONB NOT NULL,

  rationale_tags JSONB NOT NULL DEFAULT '{}'::JSONB,
  noticed_signals JSONB NOT NULL DEFAULT '{}'::JSONB,
  avoided_risks JSONB NOT NULL DEFAULT '{}'::JSONB,

  predicted_outcomes JSONB NOT NULL DEFAULT '{}'::JSONB,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.500 CHECK (confidence >= 0 AND confidence <= 1),

  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  coach_role TEXT NOT NULL DEFAULT 'coach' CHECK (coach_role IN ('coach', 'expert', 'reviewer')),

  rec_text_for_embedding TEXT NOT NULL DEFAULT '',
  embedding_id UUID,
  embedding_model TEXT,

  label_trust_weight NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (label_trust_weight >= 0 AND label_trust_weight <= 1),
  outcome_trust_weight NUMERIC(4,3) NOT NULL DEFAULT 0.200 CHECK (outcome_trust_weight >= 0 AND outcome_trust_weight <= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (episode_id, t_index)
);

CREATE INDEX IF NOT EXISTS idx_expert_rec_episode_t ON expert_recommendations(episode_id, t_index);
CREATE INDEX IF NOT EXISTS idx_expert_rec_state ON expert_recommendations(scenario_state_id);
CREATE INDEX IF NOT EXISTS idx_expert_rec_coach ON expert_recommendations(coach_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_rec_action_id ON expert_recommendations(action_id);

-- =====================================================================================
-- 5) sim_session_execution + sim_observations + sim_priors (SIM ONLY)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS sim_session_execution (
  sim_session_execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES sim_episodes(episode_id) ON DELETE CASCADE,
  t_index INT NOT NULL CHECK (t_index BETWEEN 1 AND 365),
  expert_rec_id UUID NOT NULL REFERENCES expert_recommendations(expert_rec_id) ON DELETE RESTRICT,

  source_type TEXT NOT NULL DEFAULT 'sim_engine' CHECK (source_type = 'sim_engine'),
  trust_weight NUMERIC(4,3) NOT NULL DEFAULT 0.200 CHECK (trust_weight >= 0 AND trust_weight <= 1),

  executed_workout JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (episode_id, t_index)
);

CREATE INDEX IF NOT EXISTS idx_sim_exec_episode_t ON sim_session_execution(episode_id, t_index);
CREATE INDEX IF NOT EXISTS idx_sim_exec_expert_rec ON sim_session_execution(expert_rec_id);

CREATE TABLE IF NOT EXISTS sim_observations (
  sim_observation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES sim_episodes(episode_id) ON DELETE CASCADE,
  t_index INT NOT NULL CHECK (t_index BETWEEN 1 AND 365),

  stage TEXT NOT NULL CHECK (stage IN ('pre', 'post')),
  payload_json JSONB NOT NULL,

  source_type TEXT NOT NULL DEFAULT 'sim_engine' CHECK (source_type = 'sim_engine'),
  trust_weight NUMERIC(4,3) NOT NULL DEFAULT 0.200 CHECK (trust_weight >= 0 AND trust_weight <= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (episode_id, t_index, stage)
);

CREATE INDEX IF NOT EXISTS idx_sim_obs_episode_t ON sim_observations(episode_id, t_index);
CREATE INDEX IF NOT EXISTS idx_sim_obs_stage ON sim_observations(stage);

CREATE TABLE IF NOT EXISTS sim_priors (
  sim_priors_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES sim_episodes(episode_id) ON DELETE CASCADE,
  t_index INT NOT NULL CHECK (t_index BETWEEN 1 AND 365),

  priors_json JSONB NOT NULL,
  priors_version TEXT NOT NULL,

  source_type TEXT NOT NULL DEFAULT 'sim_engine' CHECK (source_type = 'sim_engine'),
  trust_weight NUMERIC(4,3) NOT NULL DEFAULT 0.200 CHECK (trust_weight >= 0 AND trust_weight <= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (episode_id, t_index)
);

CREATE INDEX IF NOT EXISTS idx_sim_priors_episode_t ON sim_priors(episode_id, t_index);

-- =====================================================================================
-- 6) Expert Library: raw vs curated + offline eval rubric gate
-- =====================================================================================

CREATE TABLE IF NOT EXISTS expert_library_raw (
  case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_rec_id UUID NOT NULL UNIQUE REFERENCES expert_recommendations(expert_rec_id) ON DELETE CASCADE,

  episode_id UUID NOT NULL,
  t_index INT NOT NULL,
  scenario_state_id UUID NOT NULL,

  action_id TEXT NOT NULL,
  planned_workout JSONB NOT NULL,
  planned_dose_features JSONB NOT NULL,

  rationale_tags JSONB NOT NULL DEFAULT '{}'::JSONB,
  predicted_outcomes JSONB NOT NULL DEFAULT '{}'::JSONB,

  coach_id UUID NOT NULL,

  rubric_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (rubric_status IN ('needs_review', 'approved', 'rejected')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_lib_raw_action_id ON expert_library_raw(action_id);
CREATE INDEX IF NOT EXISTS idx_expert_lib_raw_rubric_status ON expert_library_raw(rubric_status);
CREATE INDEX IF NOT EXISTS idx_expert_lib_raw_created_at ON expert_library_raw(created_at DESC);

CREATE TABLE IF NOT EXISTS expert_offline_eval_runs (
  eval_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  expert_rec_id UUID NOT NULL REFERENCES expert_recommendations(expert_rec_id) ON DELETE CASCADE,
  raw_case_id UUID NOT NULL REFERENCES expert_library_raw(case_id) ON DELETE CASCADE,

  rubric_version TEXT NOT NULL DEFAULT 'v1',
  rubric_scores JSONB NOT NULL,
  passed_gate BOOLEAN NOT NULL,
  gate_thresholds JSONB NOT NULL,
  evaluator_notes TEXT,

  evaluated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_eval_runs_raw_case ON expert_offline_eval_runs(raw_case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS expert_library_curated (
  curated_case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  raw_case_id UUID NOT NULL UNIQUE REFERENCES expert_library_raw(case_id) ON DELETE CASCADE,
  expert_rec_id UUID NOT NULL UNIQUE REFERENCES expert_recommendations(expert_rec_id) ON DELETE CASCADE,

  action_id TEXT NOT NULL,
  planned_workout JSONB NOT NULL,
  planned_dose_features JSONB NOT NULL,

  rationale_tags JSONB NOT NULL DEFAULT '{}'::JSONB,
  predicted_outcomes JSONB NOT NULL DEFAULT '{}'::JSONB,

  is_curated BOOLEAN NOT NULL DEFAULT TRUE,
  curated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  curated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  curation_notes TEXT,
  rubric_version TEXT NOT NULL DEFAULT 'v1',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_lib_curated_action_id ON expert_library_curated(action_id);
CREATE INDEX IF NOT EXISTS idx_expert_lib_curated_created_at ON expert_library_curated(created_at DESC);

-- =====================================================================================
-- 7) Row Level Security (optional; backend uses service role)
-- =====================================================================================

ALTER TABLE sim_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_session_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_priors ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_library_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_offline_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_library_curated ENABLE ROW LEVEL SECURITY;
ALTER TABLE transition_param_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transition_params ENABLE ROW LEVEL SECURITY;

-- Coaches can manage BetaLab tables.
DO $$
BEGIN
  -- sim_episodes
  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_sim_episodes" ON sim_episodes';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_sim_episodes"
    ON sim_episodes FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;

  -- scenario_state
  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_scenario_state" ON scenario_state';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_scenario_state"
    ON scenario_state FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;

  -- expert_recommendations
  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_expert_recommendations" ON expert_recommendations';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_expert_recommendations"
    ON expert_recommendations FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;

  -- sim tables
  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_sim_session_execution" ON sim_session_execution';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_sim_session_execution"
    ON sim_session_execution FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;

  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_sim_observations" ON sim_observations';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_sim_observations"
    ON sim_observations FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;

  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_sim_priors" ON sim_priors';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_sim_priors"
    ON sim_priors FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;

  -- expert library
  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_expert_library_raw" ON expert_library_raw';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_expert_library_raw"
    ON expert_library_raw FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;

  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_expert_offline_eval_runs" ON expert_offline_eval_runs';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_expert_offline_eval_runs"
    ON expert_offline_eval_runs FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;

  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_expert_library_curated" ON expert_library_curated';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_expert_library_curated"
    ON expert_library_curated FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;

  -- transition params
  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_transition_param_sets" ON transition_param_sets';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_transition_param_sets"
    ON transition_param_sets FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;

  EXECUTE 'DROP POLICY IF EXISTS "betalab_coaches_manage_transition_params" ON transition_params';
  EXECUTE $$
    CREATE POLICY "betalab_coaches_manage_transition_params"
    ON transition_params FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
  $$;
END$$;

COMMENT ON TABLE sim_priors IS 'SIM ONLY belief updates. Must never flow into real-user priors/posteriors.';
COMMENT ON TABLE expert_library_curated IS 'Curated expert cases allowed to feed retrieval and batch expert priors (never sim outcomes).';
