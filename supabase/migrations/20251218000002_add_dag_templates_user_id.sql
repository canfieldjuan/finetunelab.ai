-- Add user_id column to training_pipelines table for ownership tracking
-- Date: 2025-12-18
-- Phase 2: DAG Template Authentication

-- Check if table exists and add user_id column if not present
DO $$
BEGIN
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'training_pipelines' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE training_pipelines
        ADD COLUMN user_id UUID REFERENCES auth.users(id);
        
        RAISE NOTICE 'Added user_id column to training_pipelines table';
    ELSE
        RAISE NOTICE 'user_id column already exists in training_pipelines table';
    END IF;
END $$;

-- Create index for performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_training_pipelines_user_id 
ON training_pipelines(user_id);

-- Enable Row Level Security
ALTER TABLE training_pipelines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own templates" ON training_pipelines;
DROP POLICY IF EXISTS "Users can create own templates" ON training_pipelines;
DROP POLICY IF EXISTS "Users can update own templates" ON training_pipelines;
DROP POLICY IF EXISTS "Users can delete own templates" ON training_pipelines;

-- Create RLS policies for user access
CREATE POLICY "Users can view own templates"
ON training_pipelines
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own templates"
ON training_pipelines
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
ON training_pipelines
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
ON training_pipelines
FOR DELETE
USING (auth.uid() = user_id);

-- Verify the changes
DO $$
DECLARE
    column_exists BOOLEAN;
    index_exists BOOLEAN;
    rls_enabled BOOLEAN;
    policy_count INTEGER;
BEGIN
    -- Check column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'training_pipelines' 
        AND column_name = 'user_id'
    ) INTO column_exists;
    
    -- Check index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'training_pipelines' 
        AND indexname = 'idx_training_pipelines_user_id'
    ) INTO index_exists;
    
    -- Check RLS
    SELECT relrowsecurity 
    FROM pg_class 
    WHERE relname = 'training_pipelines'
    INTO rls_enabled;
    
    -- Check policies
    SELECT COUNT(*) 
    FROM pg_policies 
    WHERE tablename = 'training_pipelines'
    INTO policy_count;
    
    RAISE NOTICE 'Migration Verification:';
    RAISE NOTICE '- user_id column exists: %', column_exists;
    RAISE NOTICE '- Index exists: %', index_exists;
    RAISE NOTICE '- RLS enabled: %', rls_enabled;
    RAISE NOTICE '- Policies created: %', policy_count;
    
    IF NOT column_exists THEN
        RAISE EXCEPTION 'Migration failed: user_id column not created';
    END IF;
    
    IF NOT index_exists THEN
        RAISE EXCEPTION 'Migration failed: index not created';
    END IF;
    
    IF NOT rls_enabled THEN
        RAISE EXCEPTION 'Migration failed: RLS not enabled';
    END IF;
    
    IF policy_count < 4 THEN
        RAISE EXCEPTION 'Migration failed: not all policies created (expected 4, got %)', policy_count;
    END IF;
    
    RAISE NOTICE 'Migration completed successfully!';
END $$;
