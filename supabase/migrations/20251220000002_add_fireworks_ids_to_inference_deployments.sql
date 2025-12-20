-- Add columns to support Fireworks.ai deployments
ALTER TABLE public.inference_deployments
ADD COLUMN fireworks_model_id TEXT,
ADD COLUMN fireworks_deployment_id TEXT;
