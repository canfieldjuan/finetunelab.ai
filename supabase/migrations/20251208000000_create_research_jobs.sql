-- Create research_jobs table
CREATE TABLE IF NOT EXISTS research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  steps JSONB DEFAULT '[]'::jsonb,
  collected_content JSONB DEFAULT '[]'::jsonb,
  report JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

-- Create research_steps table
CREATE TABLE IF NOT EXISTS research_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES research_jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  content TEXT,
  result JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

-- Enable RLS
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_steps ENABLE ROW LEVEL SECURITY;

-- Policies for research_jobs
CREATE POLICY "Users can view their own research jobs"
  ON research_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own research jobs"
  ON research_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own research jobs"
  ON research_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for research_steps
CREATE POLICY "Users can view steps of their own research jobs"
  ON research_steps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM research_jobs
    WHERE research_jobs.id = research_steps.job_id
    AND research_jobs.user_id = auth.uid()
  ));

-- Allow service role full access (implicit, but good to be aware)
