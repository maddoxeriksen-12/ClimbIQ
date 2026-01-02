-- Migration: BetaLab expert priors (batch, versioned)
-- Purpose:
--   Store curated-case-derived expert priors with conservative, batch updates.
--   This table is the ONLY supported bridge from BetaLab curated data to
--   production plan generation (via template/parameter priors).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS expert_priors_versions (
  expert_priors_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  version_label TEXT NOT NULL, -- e.g. '2025-W51'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  is_current BOOLEAN NOT NULL DEFAULT FALSE,

  n_curated_cases INT NOT NULL DEFAULT 0,
  source_window JSONB NOT NULL DEFAULT '{}'::JSONB,

  shrinkage_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  priors_json JSONB NOT NULL,

  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_expert_priors_versions_current
  ON expert_priors_versions(is_current)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_expert_priors_versions_created_at
  ON expert_priors_versions(created_at DESC);

CREATE OR REPLACE VIEW expert_priors_current AS
SELECT *
FROM expert_priors_versions
WHERE is_current = TRUE
ORDER BY created_at DESC
LIMIT 1;

ALTER TABLE expert_priors_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages expert priors" ON expert_priors_versions;
CREATE POLICY "Service role manages expert priors"
ON expert_priors_versions FOR ALL
TO authenticated
USING (auth.role() = 'service_role');
