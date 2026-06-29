-- Async image-generation jobs for the generate_image portal tool (gap #3, slice 3ii).
-- Mirrors research_jobs: owner-only RLS keyed on user_id, written by the
-- service-role background runner and read back by the owner via RLS.

CREATE TABLE IF NOT EXISTS image_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  options JSONB,
  result_url TEXT,
  source TEXT,
  attribution JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_image_jobs_user_id ON image_jobs(user_id);

ALTER TABLE image_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY image_jobs_select_own ON image_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY image_jobs_insert_own ON image_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY image_jobs_update_own ON image_jobs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY image_jobs_delete_own ON image_jobs
  FOR DELETE USING (auth.uid() = user_id);
