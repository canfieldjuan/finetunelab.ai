-- ============================================
-- FIX MODEL FALLBACK ISSUE
-- ============================================
-- Problem: Training showing Qwen 0.6B instead of selected Qwen 1.7B
-- Symptoms: 
--   - Monitor page shows "Qwen 0.6B" 
--   - Metrics show 0.6B characteristics (loss ~3.75, perplexity ~42)
-- Root Cause: config_json contains 0.6B instead of 1.7B
-- ============================================

-- STEP 1: Find your recent training configs
-- This will show which model is actually stored in each config
SELECT 
    id,
    name,
    public_id,
    config_json->'model'->>'name' as model_in_config,
    is_public,
    created_at,
    updated_at
FROM training_configs
ORDER BY created_at DESC
LIMIT 20;

-- STEP 2: Check your recent training jobs to see which config was used
-- This shows which config ID was used for recent training runs
SELECT 
    ltj.id as job_id,
    ltj.model_name as model_shown_in_monitor,
    ltj.status,
    ltj.config->>'model' as model_from_job_config,
    ltj.started_at,
    ltj.created_at
FROM local_training_jobs ltj
ORDER BY ltj.created_at DESC
LIMIT 10;

-- STEP 3: Cross-reference - find which config was used for a specific job
-- Replace 'YOUR_JOB_ID' with the actual job ID from monitor page
-- SELECT 
--     ltj.id as job_id,
--     ltj.model_name as displayed_model,
--     ltj.config->'model'->>'name' as config_model_name,
--     tc.id as config_id,
--     tc.name as config_name,
--     tc.config_json->'model'->>'name' as original_config_model
-- FROM local_training_jobs ltj
-- LEFT JOIN training_configs tc ON tc.public_id = (ltj.config->>'public_id')
-- WHERE ltj.id = 'YOUR_JOB_ID';

-- STEP 4: Identify all configs that have 0.6B when they shouldn't
-- This finds configs that might be incorrectly set to 0.6B
SELECT 
    id,
    name,
    config_json->'model'->>'name' as model_name,
    template_type,
    created_at
FROM training_configs
WHERE config_json->'model'->>'name' LIKE '%0.6%'
  AND is_public = true
ORDER BY created_at DESC;

-- STEP 5: FIX - Update a specific config to use Qwen 1.7B
-- ⚠️ IMPORTANT: Replace 'YOUR_CONFIG_ID' with the actual config ID you want to fix
-- ⚠️ Make sure to verify the config ID first!

-- UPDATE training_configs
-- SET 
--     config_json = jsonb_set(
--         jsonb_set(
--             config_json,
--             '{model,name}',
--             '"Qwen/Qwen3-1.7B"'
--         ),
--         '{tokenizer,name}',
--         '"Qwen/Qwen3-1.7B"'
--     ),
--     updated_at = NOW()
-- WHERE id = 'YOUR_CONFIG_ID';

-- STEP 6: Verify the fix
-- Run this after updating to confirm the change
-- SELECT 
--     id,
--     name,
--     config_json->'model'->>'name' as model_name,
--     config_json->'tokenizer'->>'name' as tokenizer_name,
--     updated_at
-- FROM training_configs
-- WHERE id = 'YOUR_CONFIG_ID';

-- ============================================
-- PREVENTION: Check template defaults
-- ============================================
-- The root cause might be in lib/training/training-templates.ts
-- All templates currently default to Qwen3-0.6B
-- 
-- Recommendation: 
-- 1. After creating a config from a template, verify the model in the UI
-- 2. Use the model selector to choose your desired model
-- 3. Save the config and verify it persisted correctly
-- ============================================

-- DIAGNOSTIC: Find most recent public config by user
-- SELECT 
--     id,
--     name,
--     public_id,
--     config_json->'model'->>'name' as model,
--     is_public,
--     created_at
-- FROM training_configs
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com')
-- ORDER BY created_at DESC
-- LIMIT 5;
