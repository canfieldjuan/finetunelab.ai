-- Fix RLS policies for model_baselines table
-- The issue: policies require auth.uid() which doesn't work for service role
-- Solution: Allow service role to bypass RLS, or make policies less restrictive

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read baselines" ON model_baselines;
DROP POLICY IF EXISTS "Allow authenticated users to create baselines" ON model_baselines;
DROP POLICY IF EXISTS "Allow authenticated users to update baselines" ON model_baselines;
DROP POLICY IF EXISTS "Allow authenticated users to delete baselines" ON model_baselines;

-- Create more permissive policies that work with service role
-- Allow all authenticated operations (including service role)
CREATE POLICY "Enable read access for all authenticated users" 
  ON model_baselines FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Enable insert access for all authenticated users" 
  ON model_baselines FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Enable update access for all authenticated users" 
  ON model_baselines FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all authenticated users" 
  ON model_baselines FOR DELETE 
  TO authenticated 
  USING (true);

-- Also allow service role full access (bypasses RLS but good to be explicit)
CREATE POLICY "Enable full access for service role" 
  ON model_baselines FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE model_baselines ENABLE ROW LEVEL SECURITY;

-- Add helpful comment
COMMENT ON TABLE model_baselines IS 'Stores baseline metrics for model validation and regression detection. RLS policies allow authenticated and service role access.';
