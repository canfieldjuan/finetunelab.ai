-- Quick query to get your user ID
-- Run this in Supabase SQL Editor

-- Get your user ID from auth.users table
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- OR if you want to see your datasets and configs:
SELECT DISTINCT user_id, 'from training_configs' as source
FROM training_configs
UNION
SELECT DISTINCT user_id, 'from training_datasets' as source  
FROM training_datasets
ORDER BY source;
