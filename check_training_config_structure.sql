-- Check the structure of the training config for the most recent job
SELECT
  ltj.id as job_id,
  ltj.config,
  tc.id as config_id,
  tc.name as config_name,
  tc.config_json
FROM local_training_jobs ltj
LEFT JOIN local_training_configs tc ON ltj.config->>'id' = tc.id::text
WHERE ltj.id = 'ad01f229-e59d-4284-8180-0e69d92d0c34';

-- Also check what training configs exist
SELECT
  id,
  name,
  config_json->'training' as training_section,
  config_json->'training'->>'num_epochs' as num_epochs_in_config,
  config_json->>'num_epochs' as num_epochs_top_level,
  created_at
FROM training_configs
ORDER BY created_at DESC
LIMIT 5;
