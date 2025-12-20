-- Add network_volume_id to inference_deployments to track persistent storage

ALTER TABLE public.inference_deployments
ADD COLUMN network_volume_id TEXT;
