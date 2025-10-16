-- Training Metadata for LLM Models
-- Adds optional columns to track model provenance and training details
-- Date: 2025-10-15
-- Run in Supabase SQL editor

-- ============================================================================
-- ALTER llm_models TABLE - Add Training Metadata
-- ============================================================================
-- These columns are OPTIONAL (nullable) and track which models were trained
-- with Tiny Tool Use vs. imported from other sources

ALTER TABLE llm_models
  ADD COLUMN IF NOT EXISTS training_method TEXT,
  ADD COLUMN IF NOT EXISTS base_model TEXT,
  ADD COLUMN IF NOT EXISTS training_dataset TEXT,
  ADD COLUMN IF NOT EXISTS training_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lora_config JSONB,
  ADD COLUMN IF NOT EXISTS evaluation_metrics JSONB;

-- Add column comments for documentation
COMMENT ON COLUMN llm_models.training_method IS 'Training method used (e.g., "sft", "dpo", "rlhf"). NULL if model was not trained by user.';
COMMENT ON COLUMN llm_models.base_model IS 'Base model used for fine-tuning (e.g., "Qwen/Qwen3-0.6B"). NULL if not applicable.';
COMMENT ON COLUMN llm_models.training_dataset IS 'Dataset used for training (e.g., "ToolBench", "PC Building"). NULL if unknown.';
COMMENT ON COLUMN llm_models.training_date IS 'Date when training was completed. NULL if not applicable.';
COMMENT ON COLUMN llm_models.lora_config IS 'LoRA configuration used (JSON: {r: 8, alpha: 32, dropout: 0.05}). NULL if not using LoRA.';
COMMENT ON COLUMN llm_models.evaluation_metrics IS 'Evaluation metrics from training (JSON: {accuracy: 0.95, loss: 0.12}). NULL if not available.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check columns were added successfully
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'llm_models'
  AND column_name IN (
    'training_method',
    'base_model',
    'training_dataset',
    'training_date',
    'lora_config',
    'evaluation_metrics'
  )
ORDER BY column_name;

-- Check that existing models are unaffected (all should have NULL values)
SELECT
  id,
  name,
  provider,
  training_method,
  base_model,
  training_dataset,
  training_date,
  lora_config,
  evaluation_metrics
FROM llm_models
LIMIT 5;

-- Count models with training metadata (should be 0 initially)
SELECT
  COUNT(*) FILTER (WHERE training_method IS NOT NULL) as with_training_method,
  COUNT(*) FILTER (WHERE base_model IS NOT NULL) as with_base_model,
  COUNT(*) FILTER (WHERE training_dataset IS NOT NULL) as with_training_dataset,
  COUNT(*) FILTER (WHERE training_date IS NOT NULL) as with_training_date,
  COUNT(*) FILTER (WHERE lora_config IS NOT NULL) as with_lora_config,
  COUNT(*) FILTER (WHERE evaluation_metrics IS NOT NULL) as with_evaluation_metrics,
  COUNT(*) as total_models
FROM llm_models;

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- Example 1: Insert model WITH training metadata
-- INSERT INTO llm_models (
--   user_id, name, description, provider, base_url, model_id,
--   auth_type, api_key_encrypted,
--   training_method, base_model, training_dataset, training_date,
--   lora_config, evaluation_metrics
-- ) VALUES (
--   'user-uuid-here',
--   'Qwen3-Tool-Use-v1',
--   'Fine-tuned on ToolBench dataset',
--   'huggingface',
--   'https://api-inference.huggingface.co/models',
--   'username/qwen3-0.6b-tool-use-v1',
--   'bearer',
--   'encrypted-api-key',
--   'sft',
--   'Qwen/Qwen3-0.6B',
--   'ToolBench',
--   NOW(),
--   '{"r": 8, "alpha": 32, "dropout": 0.05}'::jsonb,
--   '{"accuracy": 0.95, "token_acceptance": 0.92, "final_loss": 0.18}'::jsonb
-- );

-- Example 2: Insert model WITHOUT training metadata (backward compatible)
-- INSERT INTO llm_models (
--   user_id, name, description, provider, base_url, model_id,
--   auth_type, api_key_encrypted
-- ) VALUES (
--   'user-uuid-here',
--   'GPT-4o Mini',
--   'OpenAI GPT-4o Mini',
--   'openai',
--   'https://api.openai.com/v1',
--   'gpt-4o-mini',
--   'bearer',
--   'encrypted-api-key'
-- );

-- Example 3: Update existing model to add training metadata
-- UPDATE llm_models
-- SET
--   training_method = 'sft',
--   base_model = 'Qwen/Qwen3-0.6B',
--   training_dataset = 'ToolBench',
--   training_date = '2025-10-15 10:30:00'::timestamptz,
--   lora_config = '{"r": 8, "alpha": 32, "dropout": 0.05}'::jsonb,
--   evaluation_metrics = '{"accuracy": 0.95, "loss": 0.18}'::jsonb
-- WHERE id = 'model-uuid-here';

-- ============================================================================
-- QUERY EXAMPLES
-- ============================================================================

-- Query 1: Get all models trained with Tiny Tool Use
-- SELECT id, name, base_model, training_method, training_dataset, training_date
-- FROM llm_models
-- WHERE training_method IS NOT NULL
-- ORDER BY training_date DESC;

-- Query 2: Get models trained with SFT method
-- SELECT id, name, base_model, training_dataset
-- FROM llm_models
-- WHERE training_method = 'sft'
-- ORDER BY created_at DESC;

-- Query 3: Get models with evaluation metrics
-- SELECT
--   id,
--   name,
--   training_method,
--   evaluation_metrics->>'accuracy' as accuracy,
--   evaluation_metrics->>'token_acceptance' as token_acceptance,
--   evaluation_metrics->>'final_loss' as final_loss
-- FROM llm_models
-- WHERE evaluation_metrics IS NOT NULL;

-- Query 4: Get models trained on specific base model
-- SELECT id, name, provider, training_method, training_dataset
-- FROM llm_models
-- WHERE base_model LIKE '%Qwen%'
-- ORDER BY training_date DESC;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- UNCOMMENT THESE ONLY IF YOU NEED TO UNDO:
-- ALTER TABLE llm_models DROP COLUMN IF EXISTS evaluation_metrics;
-- ALTER TABLE llm_models DROP COLUMN IF EXISTS lora_config;
-- ALTER TABLE llm_models DROP COLUMN IF EXISTS training_date;
-- ALTER TABLE llm_models DROP COLUMN IF EXISTS training_dataset;
-- ALTER TABLE llm_models DROP COLUMN IF EXISTS base_model;
-- ALTER TABLE llm_models DROP COLUMN IF EXISTS training_method;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. All columns are nullable (backward compatible)
-- 2. Existing models remain unaffected
-- 3. No indexes needed (low query frequency)
-- 4. JSONB columns allow flexible metadata storage
-- 5. Training metadata is OPTIONAL - only fill if known

-- ============================================================================
-- VALIDATION CHECKLIST
-- ============================================================================

-- [ ] Run verification query - all columns exist
-- [ ] Check existing models have NULL values
-- [ ] Insert test model WITH training metadata
-- [ ] Insert test model WITHOUT training metadata
-- [ ] Verify no errors in application
-- [ ] Check TypeScript types updated to match
