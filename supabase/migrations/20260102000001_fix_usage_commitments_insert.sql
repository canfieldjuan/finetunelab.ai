-- Fix: Allow users to insert their own usage commitments
-- This enables the default subscription initialization in /api/billing/usage

-- Add INSERT policy for users to create their own commitments
DROP POLICY IF EXISTS "Users can insert their own commitments" ON public.usage_commitments;
CREATE POLICY "Users can insert their own commitments"
  ON public.usage_commitments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Also allow users to UPDATE their own commitments (for upsert to work)
DROP POLICY IF EXISTS "Users can update their own commitments" ON public.usage_commitments;
CREATE POLICY "Users can update their own commitments"
  ON public.usage_commitments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "Users can insert their own commitments" ON public.usage_commitments IS
  'Allows users to create their own subscription commitments (e.g., default starter tier)';

COMMENT ON POLICY "Users can update their own commitments" ON public.usage_commitments IS
  'Allows users to update their own commitments (for tier changes, renewals)';
