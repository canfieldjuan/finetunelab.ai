-- Fix RLS policies for validation_results table
-- The issue: policies require auth.uid() which doesn't work for service role
-- Solution: Allow service role to bypass RLS, or make policies less restrictive

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read validation results" ON validation_results;
DROP POLICY IF EXISTS "Allow authenticated users to create validation results" ON validation_results;
DROP POLICY IF EXISTS "Allow authenticated users to update validation results" ON validation_results;

-- Create more permissive policies that work with service role
-- Allow all authenticated operations (including service role)
CREATE POLICY "Enable read access for all authenticated users" 
  ON validation_results FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Enable insert access for all authenticated users" 
  ON validation_results FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Enable update access for all authenticated users" 
  ON validation_results FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Also allow service role full access (bypasses RLS but good to be explicit)
CREATE POLICY "Enable full access for service role" 
  ON validation_results FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;

-- Add helpful comment
COMMENT ON TABLE validation_results IS 'Stores validation results from regression gates. RLS policies allow authenticated and service role access.';
