-- ============================================================================
-- CLIMBIQ TABLE CLEANUP SCRIPT
-- ============================================================================
-- Run this in the Supabase SQL Editor to identify and remove unnecessary tables.
-- 
-- IMPORTANT: Review the output before running DROP statements!
-- ============================================================================

-- ============================================================================
-- STEP 1: List all tables currently in the database
-- ============================================================================
-- Run this first to see what exists:

SELECT 
    table_name,
    pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- STEP 2: REQUIRED TABLES (DO NOT DELETE)
-- ============================================================================
-- These tables are part of the ClimbIQ Architecture and must be kept:
--
-- USER DATA:
--   - profiles                    (user profiles)
--   - subscriptions               (Stripe subscriptions)
--   - climbing_sessions           (session tracking - main table)
--   - climbing_goals              (user goals)
--   - goal_progress               (goal tracking)
--   - custom_variables            (user-defined tracking)
--   - custom_variable_entries     (variable values)
--   - baseline_assessments        (user baseline profiles)
--
-- EXPERT CAPTURE SYSTEM:
--   - rule_review_sessions        (expert review sessions)
--   - synthetic_scenarios         (AI-generated scenarios)
--   - expert_scenario_responses   (expert judgments)
--   - scenario_consensus          (aggregated consensus)
--   - expert_rules                (override rules)
--   - rule_audit_log              (rule change tracking)
--
-- MODEL & PRIORS:
--   - population_priors           (Bayesian priors)
--   - model_outputs               (per-user coefficients)
--   - literature_references       (research citations)
--
-- ============================================================================

-- ============================================================================
-- STEP 3: IDENTIFY POTENTIALLY UNNECESSARY TABLES
-- ============================================================================
-- This query shows tables that are NOT in the required list:

WITH required_tables AS (
    SELECT unnest(ARRAY[
        'profiles',
        'subscriptions',
        'climbing_sessions',
        'climbing_goals',
        'goal_progress',
        'custom_variables',
        'custom_variable_entries',
        'baseline_assessments',
        'rule_review_sessions',
        'synthetic_scenarios',
        'expert_scenario_responses',
        'scenario_consensus',
        'expert_rules',
        'rule_audit_log',
        'population_priors',
        'model_outputs',
        'literature_references'
    ]) as table_name
)
SELECT 
    t.table_name as "Potentially Unnecessary Table",
    pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name))) as "Size",
    'DROP TABLE IF EXISTS ' || t.table_name || ' CASCADE;' as "Drop Command"
FROM information_schema.tables t
LEFT JOIN required_tables r ON t.table_name = r.table_name
WHERE t.table_schema = 'public'
  AND r.table_name IS NULL
ORDER BY t.table_name;


-- ============================================================================
-- STEP 4: TABLES TO POTENTIALLY REMOVE
-- ============================================================================
-- Based on migration analysis, these tables may be redundant or legacy:
-- 
-- NOTE: Only run these if you confirm the data is not needed!

-- Legacy/duplicate tables that might exist:
-- DROP TABLE IF EXISTS climbs CASCADE;                  -- If sessions has climbs_log JSONB
-- DROP TABLE IF EXISTS recommendations CASCADE;        -- If not using stored recommendations
-- DROP TABLE IF EXISTS user_preferences CASCADE;       -- If merged into profiles
-- DROP TABLE IF EXISTS sessions CASCADE;               -- If using climbing_sessions instead
-- DROP TABLE IF EXISTS pre_session_data CASCADE;       -- If merged into climbing_sessions
-- DROP TABLE IF EXISTS post_session_data CASCADE;      -- If merged into climbing_sessions


-- ============================================================================
-- STEP 5: SAFE CLEANUP (UNCOMMENT AFTER REVIEW)
-- ============================================================================
-- These are common unnecessary tables. Review and uncomment as needed:

-- Remove legacy session tables if using climbing_sessions
-- DROP TABLE IF EXISTS sessions CASCADE;
-- DROP TABLE IF EXISTS pre_session_data CASCADE;
-- DROP TABLE IF EXISTS post_session_data CASCADE;

-- Remove legacy climb tracking if using climbs_log JSONB in climbing_sessions
-- DROP TABLE IF EXISTS climbs CASCADE;

-- Remove legacy recommendation storage if using real-time generation
-- DROP TABLE IF EXISTS recommendations CASCADE;

-- Remove any test/development tables
-- DROP TABLE IF EXISTS test_sessions CASCADE;
-- DROP TABLE IF EXISTS temp_data CASCADE;


-- ============================================================================
-- STEP 6: VERIFY CLEANUP
-- ============================================================================
-- After running DROP statements, verify the required tables remain:

SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'profiles', 'subscriptions', 'climbing_sessions', 'climbing_goals',
            'goal_progress', 'custom_variables', 'custom_variable_entries',
            'baseline_assessments', 'rule_review_sessions', 'synthetic_scenarios',
            'expert_scenario_responses', 'scenario_consensus', 'expert_rules',
            'rule_audit_log', 'population_priors', 'model_outputs', 'literature_references'
        ) THEN '✅ Required'
        ELSE '⚠️ Review'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY status, table_name;


-- ============================================================================
-- STEP 7: CLEAN UP ORPHANED DATA (OPTIONAL)
-- ============================================================================
-- Remove orphaned records after table cleanup:

-- Delete sessions for non-existent users
-- DELETE FROM climbing_sessions WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Delete goals for non-existent users  
-- DELETE FROM climbing_goals WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Delete model outputs for non-existent users
-- DELETE FROM model_outputs WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Vacuum to reclaim space
-- VACUUM ANALYZE;


