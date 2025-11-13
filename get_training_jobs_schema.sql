-- Get structure of local_training_jobs table to see what fields we can pull
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
ORDER BY ordinal_position;
