-- Check the schema of cloud_deployments table
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'cloud_deployments'
ORDER BY ordinal_position;
