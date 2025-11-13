-- ============================================
-- COMPREHENSIVE TRAINING DIAGNOSTIC
-- ============================================
-- Find the exact job that's showing wrong model
-- ============================================

-- STEP 1: Get the job ID from the monitor page
-- Look at the URL or the job list, it should look like:
-- e6f3a2c7-4b1a-4891-9e5f-8d9c3e1a2b4c

-- STEP 2: Check what that specific job is using
-- Replace 'PASTE_YOUR_JOB_ID_HERE' with the actual job ID
SELECT 
    id as job_id,
    model_name as displayed_in_monitor,
    status,
    config->'model'->>'name' as model_in_job_config,
    dataset_path,
    started_at,
    completed_at,
    final_loss,
    best_eval_loss
FROM local_training_jobs
WHERE id = 'PASTE_YOUR_JOB_ID_HERE';

-- STEP 3: See the full config for that job
-- SELECT 
--     id,
--     config
-- FROM local_training_jobs
-- WHERE id = 'PASTE_YOUR_JOB_ID_HERE';

-- STEP 4: Check if config file paths exist
-- This will help determine if local model is accessible
-- Run this in your terminal (PowerShell):
-- Test-Path "C:\Users\Juan\Desktop\Dev_Ops\web-ui\AI_Models\huggingface_models\Qwen-Qwen3-1.7B\snapshots\70d244cc86ccca08cf5af4e1e306ecf908b1ad5e"

-- STEP 5: Alternative - Check all jobs from today
SELECT 
    id,
    model_name,
    config->'model'->>'name' as config_model,
    status,
    started_at,
    final_loss
FROM local_training_jobs
WHERE started_at >= '2025-11-01'
ORDER BY started_at DESC;
