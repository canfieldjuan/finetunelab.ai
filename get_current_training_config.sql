-- Get the full training config for your currently running job
SELECT 
    id as job_id,
    model_name,
    status,
    config,
    dataset_path,
    started_at,
    total_epochs,
    best_eval_loss
FROM local_training_jobs
WHERE id = '8d0d8022-44ab-425c-87fd-e3f9db795384';

-- Extract specific parts of the config in a readable format
SELECT 
    id as job_id,
    config->'model'->>'name' as model_name,
    config->'model'->>'torch_dtype' as torch_dtype,
    config->'model'->>'device_map' as device_map,
    config->'training'->>'num_epochs' as num_epochs,
    config->'training'->>'batch_size' as batch_size,
    config->'training'->>'learning_rate' as learning_rate,
    config->'training'->>'use_lora' as use_lora,
    config->'lora'->>'r' as lora_r,
    config->'lora'->>'alpha' as lora_alpha,
    config->'data'->>'max_seq_length' as max_seq_length,
    config->'data'->>'strategy' as data_strategy
FROM local_training_jobs
WHERE id = '8d0d8022-44ab-425c-87fd-e3f9db795384';
