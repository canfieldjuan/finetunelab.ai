SELECT id, name, model_id, provider FROM llm_models WHERE name LIKE '%PC%' OR name LIKE '%moderator%' OR name LIKE '%Qwen%' ORDER BY created_at DESC LIMIT 10;
