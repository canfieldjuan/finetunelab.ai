-- Find the "PC Expert" model configuration
SELECT
    id,
    name,
    model_id,
    provider,
    base_url,
    is_global,
    training_method,
    base_model,
    training_dataset,
    training_date,
    created_at,
    updated_at,
    description
FROM llm_models
WHERE name ILIKE '%PC Expert%'
   OR description ILIKE '%PC Expert%'
ORDER BY created_at DESC;

-- Show all user-specific models (is_global = false)
SELECT
    id,
    name,
    model_id,
    provider,
    base_url,
    is_global,
    training_method,
    training_date,
    created_at
FROM llm_models
WHERE is_global = false
ORDER BY created_at DESC
LIMIT 20;

-- Check for Qwen models specifically
SELECT
    id,
    name,
    model_id,
    provider,
    base_url,
    is_global,
    training_method,
    base_model,
    training_date,
    created_at
FROM llm_models
WHERE model_id ILIKE '%qwen%'
   OR base_model ILIKE '%qwen%'
ORDER BY created_at DESC;

-- Show models created/updated/trained today
SELECT
    id,
    name,
    model_id,
    provider,
    base_url,
    is_global,
    training_method,
    base_model,
    training_date,
    created_at,
    updated_at
FROM llm_models
WHERE DATE(created_at) = CURRENT_DATE
   OR DATE(updated_at) = CURRENT_DATE
   OR DATE(training_date) = CURRENT_DATE
ORDER BY created_at DESC;
