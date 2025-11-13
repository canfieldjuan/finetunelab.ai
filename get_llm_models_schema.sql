-- Get actual column names for llm_models table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'llm_models'
ORDER BY ordinal_position;
