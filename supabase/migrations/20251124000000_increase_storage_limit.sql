-- Increase file size limit for training-datasets bucket to 500MB
-- Supabase Pro allows up to 5GB per file

UPDATE storage.buckets
SET file_size_limit = 524288000  -- 500MB in bytes (500 * 1024 * 1024)
WHERE name = 'training-datasets';

-- Verify the update
SELECT name, file_size_limit, file_size_limit / 1024 / 1024 as limit_mb
FROM storage.buckets
WHERE name = 'training-datasets';
