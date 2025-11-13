-- Check what model is actually stored in your training config
-- This will show you the model name from the config_json

-- First, find your recent configs
SELECT 
    id,
    name,
    config_json->'model'->>'name' as model_name_in_config,
    created_at,
    updated_at
FROM training_configs
WHERE is_public = true
ORDER BY created_at DESC
LIMIT 10;

-- If you want to check a specific config (replace the ID with your config ID):
-- SELECT 
--     id,
--     name,
--     config_json->'model'->>'name' as model_name,
--     config_json->'model' as full_model_config,
--     config_json
-- FROM training_configs
-- WHERE public_id = 'YOUR_PUBLIC_ID_HERE';

-- To see which configs have 0.6B vs 1.7B:
SELECT 
    CASE 
        WHEN config_json->'model'->>'name' LIKE '%0.6%' THEN 'Qwen 0.6B'
        WHEN config_json->'model'->>'name' LIKE '%1.7%' THEN 'Qwen 1.7B'
        WHEN config_json->'model'->>'name' LIKE '%2.5%' THEN 'Qwen 2.5B'
        ELSE config_json->'model'->>'name'
    END as model_category,
    COUNT(*) as count
FROM training_configs
WHERE config_json IS NOT NULL
GROUP BY model_category
ORDER BY count DESC;
