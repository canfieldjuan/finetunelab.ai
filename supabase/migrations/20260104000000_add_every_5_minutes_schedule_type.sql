-- Migration: Add 'every_5_minutes' Schedule Type
-- Created: 2026-01-04
-- Purpose: Add testing schedule option that runs every 5 minutes
-- Breaking Changes: NONE (backward compatible - only adds new value)

-- ============================================================================
-- UPDATE: scheduled_evaluations table constraint
-- Add 'every_5_minutes' to allowed schedule_type values
-- ============================================================================

-- Drop existing constraint
ALTER TABLE public.scheduled_evaluations
DROP CONSTRAINT IF EXISTS scheduled_evaluations_schedule_type_check;

-- Add new constraint with 'every_5_minutes' included
ALTER TABLE public.scheduled_evaluations
ADD CONSTRAINT scheduled_evaluations_schedule_type_check
CHECK (schedule_type IN ('every_5_minutes', 'hourly', 'daily', 'weekly', 'custom'));

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scheduled_evaluations_schedule_type_check'
    AND conrelid = 'public.scheduled_evaluations'::regclass
  ) THEN
    RAISE EXCEPTION 'Constraint scheduled_evaluations_schedule_type_check not found';
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration:
--
-- ALTER TABLE public.scheduled_evaluations
-- DROP CONSTRAINT scheduled_evaluations_schedule_type_check;
--
-- ALTER TABLE public.scheduled_evaluations
-- ADD CONSTRAINT scheduled_evaluations_schedule_type_check
-- CHECK (schedule_type IN ('hourly', 'daily', 'weekly', 'custom'));
