-- ============================================================================
-- ADD METADATA COLUMN TO PROVIDER_SECRETS
-- ============================================================================
-- Purpose: Add metadata JSONB column to store additional provider-specific data
--          For HuggingFace: stores username for auto-generating repo names
-- Date: 2025-11-25
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this ENTIRE file
-- 3. Click "RUN"
-- ============================================================================

-- Add metadata column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_secrets'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE provider_secrets ADD COLUMN metadata JSONB DEFAULT '{}';
    RAISE NOTICE 'Added metadata column to provider_secrets';
  ELSE
    RAISE NOTICE 'metadata column already exists';
  END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'provider_secrets'
  AND column_name = 'metadata';

-- ============================================================================
-- Usage:
-- For HuggingFace provider, metadata will store:
-- {
--   "username": "juan-canfield"
-- }
--
-- This allows auto-generating repo names like:
-- juan-canfield/my-training-config
-- ============================================================================
