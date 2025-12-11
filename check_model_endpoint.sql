-- Check the endpoint configuration for the custom model
SELECT 
    model_id,
    provider,
    base_url,
    name,
    is_active,
    created_at
FROM llm_models
WHERE model_id = 'Canfield/llama-3-2-3b-instruct-new-atlas-dataset';
