-- Add metadata column to llm_models table for deployment tracking
ALTER TABLE llm_models 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN llm_models.metadata IS 'Stores deployment metadata including training_job_id, server_id, deployed_at, model_path, checkpoint_path';
