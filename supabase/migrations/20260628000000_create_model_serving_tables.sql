-- Phase 0: make model-serving tables explicit and versioned.
-- These tables existed in live Supabase before they were represented in migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.llm_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL,
  base_url TEXT NOT NULL,
  model_id TEXT NOT NULL,
  served_model_name TEXT,
  auth_type TEXT NOT NULL DEFAULT 'bearer',
  api_key_encrypted TEXT,
  auth_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  supports_streaming BOOLEAN NOT NULL DEFAULT true,
  supports_functions BOOLEAN NOT NULL DEFAULT false,
  supports_vision BOOLEAN NOT NULL DEFAULT false,
  context_length INTEGER NOT NULL DEFAULT 4096,
  max_output_tokens INTEGER NOT NULL DEFAULT 2000,
  price_per_input_token NUMERIC,
  price_per_output_token NUMERIC,
  default_temperature NUMERIC NOT NULL DEFAULT 0.7,
  default_top_p NUMERIC NOT NULL DEFAULT 1.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_global BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  training_method TEXT,
  base_model TEXT,
  training_dataset TEXT,
  training_date TIMESTAMPTZ,
  lora_config JSONB,
  evaluation_metrics JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE public.llm_models
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS base_url TEXT,
  ADD COLUMN IF NOT EXISTS model_id TEXT,
  ADD COLUMN IF NOT EXISTS served_model_name TEXT,
  ADD COLUMN IF NOT EXISTS auth_type TEXT DEFAULT 'bearer',
  ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS auth_headers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS supports_streaming BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS supports_functions BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_vision BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS context_length INTEGER DEFAULT 4096,
  ADD COLUMN IF NOT EXISTS max_output_tokens INTEGER DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS price_per_input_token NUMERIC,
  ADD COLUMN IF NOT EXISTS price_per_output_token NUMERIC,
  ADD COLUMN IF NOT EXISTS default_temperature NUMERIC DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS default_top_p NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_method TEXT,
  ADD COLUMN IF NOT EXISTS base_model TEXT,
  ADD COLUMN IF NOT EXISTS training_dataset TEXT,
  ADD COLUMN IF NOT EXISTS training_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lora_config JSONB,
  ADD COLUMN IF NOT EXISTS evaluation_metrics JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.local_inference_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  server_type TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  port INTEGER NOT NULL,
  model_path TEXT NOT NULL,
  model_name TEXT NOT NULL,
  training_job_id UUID,
  process_id INTEGER,
  status TEXT NOT NULL DEFAULT 'starting',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  last_health_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.local_inference_servers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS server_type TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS base_url TEXT,
  ADD COLUMN IF NOT EXISTS port INTEGER,
  ADD COLUMN IF NOT EXISTS model_path TEXT,
  ADD COLUMN IF NOT EXISTS model_name TEXT,
  ADD COLUMN IF NOT EXISTS training_job_id UUID,
  ADD COLUMN IF NOT EXISTS process_id INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'starting',
  ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_llm_models_user_enabled
  ON public.llm_models(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_llm_models_global_enabled
  ON public.llm_models(is_global, enabled);
CREATE INDEX IF NOT EXISTS idx_llm_models_provider
  ON public.llm_models(provider);
CREATE INDEX IF NOT EXISTS idx_llm_models_served_model_name
  ON public.llm_models(served_model_name);
CREATE INDEX IF NOT EXISTS idx_llm_models_user_default
  ON public.llm_models(user_id, is_default)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_local_inference_servers_user_status
  ON public.local_inference_servers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_local_inference_servers_type_status
  ON public.local_inference_servers(server_type, status);
CREATE INDEX IF NOT EXISTS idx_local_inference_servers_port_status
  ON public.local_inference_servers(port, status);
CREATE INDEX IF NOT EXISTS idx_local_inference_servers_training_job
  ON public.local_inference_servers(training_job_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_llm_models_updated_at ON public.llm_models;
CREATE TRIGGER touch_llm_models_updated_at
  BEFORE UPDATE ON public.llm_models
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_local_inference_servers_updated_at ON public.local_inference_servers;
CREATE TRIGGER touch_local_inference_servers_updated_at
  BEFORE UPDATE ON public.local_inference_servers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_single_default_llm_model()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.llm_models
       SET is_default = false
     WHERE user_id IS NOT DISTINCT FROM NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_single_default_llm_model ON public.llm_models;
CREATE TRIGGER ensure_single_default_llm_model
  BEFORE INSERT OR UPDATE OF is_default ON public.llm_models
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.ensure_single_default_llm_model();

ALTER TABLE public.llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_inference_servers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'llm_models'
      AND policyname = 'llm_models_select_own_or_global'
  ) THEN
    CREATE POLICY llm_models_select_own_or_global
      ON public.llm_models
      FOR SELECT
      USING (is_global = true OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'llm_models'
      AND policyname = 'llm_models_insert_own'
  ) THEN
    CREATE POLICY llm_models_insert_own
      ON public.llm_models
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'llm_models'
      AND policyname = 'llm_models_update_own'
  ) THEN
    CREATE POLICY llm_models_update_own
      ON public.llm_models
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'llm_models'
      AND policyname = 'llm_models_delete_own'
  ) THEN
    CREATE POLICY llm_models_delete_own
      ON public.llm_models
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'local_inference_servers'
      AND policyname = 'local_inference_servers_select_own'
  ) THEN
    CREATE POLICY local_inference_servers_select_own
      ON public.local_inference_servers
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'local_inference_servers'
      AND policyname = 'local_inference_servers_insert_own'
  ) THEN
    CREATE POLICY local_inference_servers_insert_own
      ON public.local_inference_servers
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'local_inference_servers'
      AND policyname = 'local_inference_servers_update_own'
  ) THEN
    CREATE POLICY local_inference_servers_update_own
      ON public.local_inference_servers
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'local_inference_servers'
      AND policyname = 'local_inference_servers_delete_own'
  ) THEN
    CREATE POLICY local_inference_servers_delete_own
      ON public.local_inference_servers
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

COMMENT ON TABLE public.llm_models IS 'Versioned model registry used by chat, evaluations, and provider adapters.';
COMMENT ON COLUMN public.llm_models.served_model_name IS 'Optional request model name for vLLM/Ollama/OpenAI-compatible servers when it differs from the stored model path.';
COMMENT ON COLUMN public.llm_models.is_default IS 'Whether this is the user default model in the chat interface.';
COMMENT ON TABLE public.local_inference_servers IS 'App-managed local inference server process records for vLLM, Ollama, and simple local servers.';
COMMENT ON COLUMN public.local_inference_servers.training_job_id IS 'Optional reference to a training job. NULL for base models or externally trained models.';
