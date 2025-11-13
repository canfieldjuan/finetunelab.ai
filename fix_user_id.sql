-- Quick fix: Make user_id nullable in local_inference_servers
ALTER TABLE local_inference_servers ALTER COLUMN user_id DROP NOT NULL;
