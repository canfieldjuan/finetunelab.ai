-- Migration: Create Prompt Patterns Table with Versioning
-- Created: 2025-12-21
-- Purpose: Store prompt templates with version history for debugging and comparison

-- Create prompt_patterns table
CREATE TABLE IF NOT EXISTS public.prompt_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Pattern identification
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  use_case TEXT,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  version_hash TEXT,
  parent_version_id UUID REFERENCES public.prompt_patterns(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  change_summary TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Performance metrics
  success_rate NUMERIC(5, 4),
  avg_rating NUMERIC(3, 2),

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT prompt_patterns_name_version_unique UNIQUE (user_id, name, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompt_patterns_user_id
  ON public.prompt_patterns(user_id);

CREATE INDEX IF NOT EXISTS idx_prompt_patterns_name
  ON public.prompt_patterns(name);

CREATE INDEX IF NOT EXISTS idx_prompt_patterns_version_hash
  ON public.prompt_patterns(version_hash);

CREATE INDEX IF NOT EXISTS idx_prompt_patterns_parent_version
  ON public.prompt_patterns(parent_version_id);

CREATE INDEX IF NOT EXISTS idx_prompt_patterns_published
  ON public.prompt_patterns(is_published) WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_prompt_patterns_created_at
  ON public.prompt_patterns(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.prompt_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own patterns
CREATE POLICY "Users can view their own patterns"
  ON public.prompt_patterns
  FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can insert their own patterns
CREATE POLICY "Users can insert their own patterns"
  ON public.prompt_patterns
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can update their own patterns
CREATE POLICY "Users can update their own patterns"
  ON public.prompt_patterns
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can delete their own patterns
CREATE POLICY "Users can delete their own patterns"
  ON public.prompt_patterns
  FOR DELETE
  USING (user_id = auth.uid());

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_prompt_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER prompt_patterns_updated_at_trigger
  BEFORE UPDATE ON public.prompt_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_patterns_updated_at();

-- Function to auto-generate version hash from template
CREATE OR REPLACE FUNCTION generate_prompt_version_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version_hash = encode(digest(NEW.template, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate hash on insert/update
CREATE TRIGGER prompt_patterns_hash_trigger
  BEFORE INSERT OR UPDATE ON public.prompt_patterns
  FOR EACH ROW
  EXECUTE FUNCTION generate_prompt_version_hash();

-- Add comments for documentation
COMMENT ON TABLE public.prompt_patterns IS 'Stores prompt templates with version history for comparison and rollback';
COMMENT ON COLUMN public.prompt_patterns.name IS 'Name of the prompt pattern (e.g., system_prompt, user_greeting)';
COMMENT ON COLUMN public.prompt_patterns.template IS 'Prompt template text with optional {{variable}} placeholders';
COMMENT ON COLUMN public.prompt_patterns.version IS 'Incremental version number (1, 2, 3, ...)';
COMMENT ON COLUMN public.prompt_patterns.version_hash IS 'SHA-256 hash of template content for deduplication';
COMMENT ON COLUMN public.prompt_patterns.parent_version_id IS 'Reference to previous version for change history';
COMMENT ON COLUMN public.prompt_patterns.is_published IS 'Whether this version is active/production';
COMMENT ON COLUMN public.prompt_patterns.is_archived IS 'Whether this version is archived (soft delete)';
COMMENT ON COLUMN public.prompt_patterns.change_summary IS 'Description of changes in this version';
COMMENT ON COLUMN public.prompt_patterns.tags IS 'Tags for categorization (e.g., production, experimental)';
COMMENT ON COLUMN public.prompt_patterns.success_rate IS 'Success rate metric for this prompt version (0.0 to 1.0)';
COMMENT ON COLUMN public.prompt_patterns.avg_rating IS 'Average rating metric for this prompt version (0.0 to 5.0)';
