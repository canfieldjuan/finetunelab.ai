-- Check which rows would violate the storage_consistency_check constraint
SELECT
  id,
  user_id,
  name,
  storage_provider,
  storage_path,
  CASE
    WHEN storage_path IS NULL THEN 'NULL storage_path'
    WHEN storage_provider = 'supabase' AND storage_path NOT LIKE '%/private/%' THEN 'Supabase path missing /private/'
    WHEN storage_provider = 's3' AND storage_path NOT LIKE 'datasets/%' THEN 'S3 path does not start with datasets/'
    ELSE 'Valid'
  END as issue
FROM training_datasets
WHERE
  storage_path IS NULL
  OR (storage_provider = 'supabase' AND storage_path NOT LIKE '%/private/%')
  OR (storage_provider = 's3' AND storage_path NOT LIKE 'datasets/%');
