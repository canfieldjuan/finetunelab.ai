-- Check which model is being used in recent training jobs
SELECT 
    ltj.id as job_id,
    ltj.model_name as model_shown_in_monitor,
    ltj.status,
    ltj.config->'model'->>'name' as model_from_config,
    ltj.started_at,
    ltj.created_at,
    LEFT(ltj.id, 8) as job_id_short
FROM local_training_jobs ltj
ORDER BY ltj.created_at DESC
LIMIT 10;

-- If you see a specific job showing 0.6B, get its full config:
-- Replace 'YOUR_JOB_ID' with the job ID from the monitor page
-- SELECT 
--     id,
--     model_name,
--     config->'model'->>'name' as config_model,
--     config->'training'->>'num_epochs' as epochs,
--     config
-- FROM local_training_jobs
-- WHERE id = 'YOUR_JOB_ID';
