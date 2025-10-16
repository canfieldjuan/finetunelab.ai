-- Prompt Patterns Table
-- Stores reusable prompt templates with performance tracking
-- Run in Supabase SQL editor or apply through migrations

CREATE TABLE IF NOT EXISTS prompt_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    use_case TEXT NOT NULL,
    success_rate NUMERIC(3,2) DEFAULT 0.0 CHECK (success_rate >= 0 AND success_rate <= 1),
    avg_rating NUMERIC(3,2) DEFAULT 0.0 CHECK (avg_rating >= 0 AND avg_rating <= 1),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_prompt_patterns_user_id ON prompt_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_patterns_use_case ON prompt_patterns(use_case);
CREATE INDEX IF NOT EXISTS idx_prompt_patterns_created_at ON prompt_patterns(created_at DESC);

-- Enable RLS
ALTER TABLE prompt_patterns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view their own patterns" ON prompt_patterns;
DROP POLICY IF EXISTS "Users can insert their own patterns" ON prompt_patterns;
DROP POLICY IF EXISTS "Users can update their own patterns" ON prompt_patterns;
DROP POLICY IF EXISTS "Users can delete their own patterns" ON prompt_patterns;

-- RLS Policies (Optimized for performance with SELECT wrapper)
CREATE POLICY "Users can view their own patterns"
    ON prompt_patterns FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own patterns"
    ON prompt_patterns FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own patterns"
    ON prompt_patterns FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own patterns"
    ON prompt_patterns FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION set_prompt_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prompt_patterns_updated_at ON prompt_patterns;

CREATE TRIGGER trg_prompt_patterns_updated_at
BEFORE UPDATE ON prompt_patterns
FOR EACH ROW
EXECUTE FUNCTION set_prompt_patterns_updated_at();
