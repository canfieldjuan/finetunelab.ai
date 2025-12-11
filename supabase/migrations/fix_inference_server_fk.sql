-- Fix foreign key constraint on local_inference_servers.training_job_id
-- Allow NULL values for models that weren't trained through the system

-- Drop the existing constraint
ALTER TABLE public.local_inference_servers
  DROP CONSTRAINT IF EXISTS local_inference_servers_training_job_id_fkey;

-- Recreate it with proper NULL handling
ALTER TABLE public.local_inference_servers
  ADD CONSTRAINT local_inference_servers_training_job_id_fkey
  FOREIGN KEY (training_job_id)
  REFERENCES public.local_training_jobs(id)
  ON DELETE SET NULL;

-- Make sure the column allows NULL
ALTER TABLE public.local_inference_servers
  ALTER COLUMN training_job_id DROP NOT NULL;

-- Add comment explaining the nullable column
COMMENT ON COLUMN public.local_inference_servers.training_job_id IS
  'Optional reference to training job. NULL for base models or externally trained models.';
