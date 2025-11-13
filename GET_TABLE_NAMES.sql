-- =============================================================================
-- SQL Queries to Get Proper Table Names in Supabase
-- Run these in Supabase Dashboard > SQL Editor
-- =============================================================================

-- Query 1: List ALL tables in public schema
-- =============================================================================
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Query 2: List tables with row counts
-- =============================================================================
SELECT
  schemaname,
  relname as table_name,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Query 3: Find training-related tables
-- =============================================================================
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%training%'
    OR table_name LIKE '%job%'
    OR table_name LIKE '%metric%'
  )
ORDER BY table_name;

-- Query 4: Get detailed table information with sizes
-- =============================================================================
SELECT
  schemaname,
  relname as table_name,
  n_live_tup as rows,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) as table_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC;

-- Query 5: Show columns for a specific table
-- =============================================================================
-- Replace 'local_training_jobs' with your table name
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'local_training_jobs'
ORDER BY ordinal_position;

-- Query 6: Show columns for training_metrics table
-- =============================================================================
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'training_metrics'
ORDER BY ordinal_position;

-- Query 7: Find all tables and their primary keys
-- =============================================================================
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name as primary_key_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Query 8: Find foreign key relationships
-- =============================================================================
SELECT
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name AS to_table,
  ccu.column_name AS to_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Query 9: List all schemas in database
-- =============================================================================
SELECT
  schema_name,
  schema_owner
FROM information_schema.schemata
ORDER BY schema_name;

-- Query 10: Search for tables by partial name
-- =============================================================================
-- Useful if you don't remember exact table name
SELECT
  table_schema,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name ILIKE '%job%'  -- Change 'job' to search term
ORDER BY table_name;

-- Query 11: Get table creation info (if available)
-- =============================================================================
SELECT
  n.nspname as schema_name,
  c.relname as table_name,
  c.relkind as table_type,
  c.relnatts as column_count,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'v')  -- r=table, v=view
ORDER BY c.relname;

-- Query 12: Check indexes on tables
-- =============================================================================
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Query 13: Quick lookup - All table names only
-- =============================================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =============================================================================
-- EXPECTED TRAINING TABLES:
-- =============================================================================
-- Based on your codebase, these tables should exist:
--
-- 1. local_training_jobs
--    - Stores training job metadata (status, config, model_name, etc.)
--    - Primary key: id (UUID)
--    - Contains: user_id, status, config (JSONB), error_message, etc.
--
-- 2. training_metrics
--    - Stores real-time training metrics (loss, perplexity, GPU stats, etc.)
--    - Primary key: id
--    - Foreign key: job_id → local_training_jobs.id
--    - Contains: step, epoch, train_loss, eval_loss, perplexity, etc.
--
-- =============================================================================

-- =============================================================================
-- QUICK DIAGNOSTIC:
-- =============================================================================
-- Run this to verify training tables exist:

SELECT
  table_name,
  (SELECT COUNT(*)
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('local_training_jobs', 'training_metrics')
ORDER BY table_name;

-- If this returns 0 rows, the tables don't exist!
-- If it returns 2 rows, tables exist - check column_count
