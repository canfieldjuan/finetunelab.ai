-- Migration: Add API Key to Scheduled Evaluations
-- Created: 2026-01-04
-- Purpose: Store encrypted API key for recurring evaluations to use same auth flow as direct batch tests
-- Breaking Changes: NONE (adds optional column)

-- ============================================================================
-- ADD api_key_encrypted COLUMN
-- Purpose: Store encrypted API key for scheduler worker authentication
-- The scheduler will use this API key instead of service role key
-- ============================================================================

ALTER TABLE public.scheduled_evaluations
ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.scheduled_evaluations.api_key_encrypted IS
  'Encrypted API key (wak_*) for scheduler authentication. Uses same encryption as provider_secrets.';
