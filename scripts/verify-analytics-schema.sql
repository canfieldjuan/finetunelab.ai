-- Verify Analytics Database Schema
-- Created: 2025-11-28
-- Purpose: Check if all required analytics fields exist in database tables
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- ============================================================================
-- 1. CHECK MESSAGES TABLE
-- ============================================================================
SELECT
  '=== MESSAGES TABLE ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- Check for required analytics fields in messages table
SELECT
  '=== MESSAGES ANALYTICS FIELDS ===' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'input_tokens'
    ) THEN '✅ input_tokens'
    ELSE '❌ input_tokens MISSING'
  END as input_tokens_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'output_tokens'
    ) THEN '✅ output_tokens'
    ELSE '❌ output_tokens MISSING'
  END as output_tokens_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'latency_ms'
    ) THEN '✅ latency_ms'
    ELSE '❌ latency_ms MISSING'
  END as latency_ms_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'model_id'
    ) THEN '✅ model_id'
    ELSE '❌ model_id MISSING'
  END as model_id_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'provider'
    ) THEN '✅ provider'
    ELSE '❌ provider MISSING'
  END as provider_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'tools_called'
    ) THEN '✅ tools_called'
    ELSE '❌ tools_called MISSING'
  END as tools_called_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'tool_success'
    ) THEN '✅ tool_success'
    ELSE '❌ tool_success MISSING'
  END as tool_success_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'error_type'
    ) THEN '✅ error_type'
    ELSE '❌ error_type MISSING'
  END as error_type_status;

-- ============================================================================
-- 2. CHECK MESSAGE_EVALUATIONS TABLE
-- ============================================================================
SELECT
  '=== MESSAGE_EVALUATIONS TABLE ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'message_evaluations'
ORDER BY ordinal_position;

-- Check for required analytics fields in message_evaluations table
SELECT
  '=== MESSAGE_EVALUATIONS ANALYTICS FIELDS ===' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'message_evaluations'
        AND column_name = 'rating'
    ) THEN '✅ rating'
    ELSE '❌ rating MISSING'
  END as rating_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'message_evaluations'
        AND column_name = 'success'
    ) THEN '✅ success'
    ELSE '❌ success MISSING'
  END as success_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'message_evaluations'
        AND column_name = 'failure_tags'
    ) THEN '✅ failure_tags'
    ELSE '❌ failure_tags MISSING'
  END as failure_tags_status;

-- ============================================================================
-- 3. CHECK CONVERSATIONS TABLE
-- ============================================================================
SELECT
  '=== CONVERSATIONS TABLE ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversations'
ORDER BY ordinal_position;

-- Check for required analytics fields in conversations table
SELECT
  '=== CONVERSATIONS ANALYTICS FIELDS ===' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'session_id'
    ) THEN '✅ session_id'
    ELSE '❌ session_id MISSING'
  END as session_id_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'experiment_name'
    ) THEN '✅ experiment_name'
    ELSE '❌ experiment_name MISSING'
  END as experiment_name_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'is_widget_session'
    ) THEN '✅ is_widget_session'
    ELSE '❌ is_widget_session MISSING'
  END as is_widget_session_status;

-- ============================================================================
-- 4. CHECK LLM_MODELS TABLE
-- ============================================================================
SELECT
  '=== LLM_MODELS TABLE ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'llm_models'
ORDER BY ordinal_position;

-- Check for required analytics fields in llm_models table
SELECT
  '=== LLM_MODELS ANALYTICS FIELDS ===' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'llm_models'
        AND column_name = 'training_method'
    ) THEN '✅ training_method'
    ELSE '❌ training_method MISSING'
  END as training_method_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'llm_models'
        AND column_name = 'base_model'
    ) THEN '✅ base_model'
    ELSE '❌ base_model MISSING'
  END as base_model_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'llm_models'
        AND column_name = 'training_dataset'
    ) THEN '✅ training_dataset'
    ELSE '❌ training_dataset MISSING'
  END as training_dataset_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'llm_models'
        AND column_name = 'evaluation_metrics'
    ) THEN '✅ evaluation_metrics'
    ELSE '❌ evaluation_metrics MISSING'
  END as evaluation_metrics_status;

-- ============================================================================
-- 5. SUMMARY
-- ============================================================================
SELECT
  '=== ANALYTICS SCHEMA SUMMARY ===' as section,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name IN ('messages', 'message_evaluations', 'conversations', 'llm_models')) as tables_found,
  4 as tables_required,
  CASE
    WHEN (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name IN ('messages', 'message_evaluations', 'conversations', 'llm_models')) = 4
    THEN '✅ All core analytics tables exist'
    ELSE '❌ Some core analytics tables are MISSING'
  END as status;
