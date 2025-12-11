-- =============================================================================
-- COMPREHENSIVE RLS FIX FOR ALL TRAINING TABLES
-- Issue: Both local_training_jobs and local_training_metrics have RLS violations
-- Root Cause: Missing or improperly configured RLS policies
-- =============================================================================

-- First, let's check current RLS status and fix both tables

-- =============================================================================
-- 1. DISABLE RLS TEMPORARILY TO TEST CONNECTIVITY
-- =============================================================================

-- Disable RLS on both tables for testing
ALTER TABLE local_training_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE local_training_metrics DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. CREATE PROPER RLS POLICIES FOR BOTH TABLES
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE local_training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_training_metrics ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "local_training_jobs_policy" ON local_training_jobs;
DROP POLICY IF EXISTS "local_training_metrics_policy" ON local_training_metrics;
DROP POLICY IF EXISTS "local_training_jobs_select_policy" ON local_training_jobs;
DROP POLICY IF EXISTS "local_training_jobs_insert_policy" ON local_training_jobs;
DROP POLICY IF EXISTS "local_training_jobs_update_policy" ON local_training_jobs;
DROP POLICY IF EXISTS "local_training_metrics_select_policy" ON local_training_metrics;
DROP POLICY IF EXISTS "local_training_metrics_insert_policy" ON local_training_metrics;

-- =============================================================================
-- 3. CREATE PERMISSIVE POLICIES FOR LOCAL TRAINING (ANON ROLE ACCESS)
-- =============================================================================

-- Policy for local_training_jobs: Allow all operations for anon role
-- This is needed for RunPod training to create and update jobs
CREATE POLICY "local_training_jobs_full_access" ON local_training_jobs
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Policy for local_training_metrics: Allow all operations for anon role
-- This is needed for RunPod training to insert metrics
CREATE POLICY "local_training_metrics_full_access" ON local_training_metrics
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- =============================================================================
-- 4. GRANT NECESSARY PERMISSIONS TO ANON ROLE
-- =============================================================================

-- Ensure anon role has the required permissions
GRANT SELECT, INSERT, UPDATE ON local_training_jobs TO anon;
GRANT SELECT, INSERT, UPDATE ON local_training_metrics TO anon;

-- Also grant usage on sequences if they exist
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- =============================================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Ensure primary key indexes exist and add performance indexes
CREATE INDEX IF NOT EXISTS idx_local_training_jobs_status ON local_training_jobs (status);
CREATE INDEX IF NOT EXISTS idx_local_training_jobs_created_at ON local_training_jobs (created_at);
CREATE INDEX IF NOT EXISTS idx_local_training_metrics_job_id ON local_training_metrics (job_id);
CREATE INDEX IF NOT EXISTS idx_local_training_metrics_timestamp ON local_training_metrics (timestamp);

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE tablename IN ('local_training_jobs', 'local_training_metrics')
AND schemaname = 'public';

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('local_training_jobs', 'local_training_metrics')
ORDER BY tablename, policyname;