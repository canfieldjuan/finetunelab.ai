-- Comprehensive check for ALL possible constraint violations
SELECT
  id,
  user_id,
  name,
  storage_provider,
  storage_path,
  created_at,
  CASE
    -- Check for NULL values
    WHEN storage_path IS NULL THEN 'storage_path is NULL'
    WHEN storage_provider IS NULL THEN 'storage_provider is NULL'

    -- Check for invalid storage_provider values
    WHEN storage_provider NOT IN ('supabase', 's3') THEN 'Invalid storage_provider: ' || storage_provider

    -- Check for path format mismatches
    WHEN storage_provider = 'supabase' AND storage_path NOT LIKE '%/private/%' THEN 'Supabase path missing /private/: ' || storage_path
    WHEN storage_provider = 's3' AND storage_path NOT LIKE 'datasets/%' THEN 'S3 path does not start with datasets/: ' || storage_path

    ELSE 'Valid'
  END as violation_reason
FROM training_datasets
WHERE
  -- NULL checks
  storage_path IS NULL
  OR storage_provider IS NULL
  -- Invalid provider
  OR storage_provider NOT IN ('supabase', 's3')
  -- Path format checks
  OR (storage_provider = 'supabase' AND storage_path NOT LIKE '%/private/%')
  OR (storage_provider = 's3' AND storage_path NOT LIKE 'datasets/%')
ORDER BY created_at DESC;

-- Also show count by storage_provider
SELECT
  storage_provider,
  COUNT(*) as count
FROM training_datasets
GROUP BY storage_provider;
