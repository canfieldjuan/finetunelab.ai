-- Fix Tool Schemas - Remove Invalid 'required' Properties
-- Date: October 14, 2025
-- Issue: Tool parameters have "required: true" inside property definitions
--        This is invalid JSON Schema - 'required' must be array at schema level

-- ============================================
-- UPDATE DATASET MANAGER
-- ============================================
UPDATE tools SET parameters = '{
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["list", "stats", "export", "validate"],
      "description": "Dataset operation to perform"
    },
    "dataset_filter": {
      "type": "string",
      "description": "Optional: Filter datasets (all, recent, quality)"
    },
    "export_format": {
      "type": "string",
      "description": "Export format (default: jsonl)"
    },
    "limit": {
      "type": "number",
      "description": "Optional: Limit results"
    }
  },
  "required": ["operation"]
}'::jsonb
WHERE name = 'dataset_manager';

-- ============================================
-- UPDATE PROMPT TESTER
-- ============================================
UPDATE tools SET parameters = '{
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["test_single", "compare_models", "batch_test", "save_result"],
      "description": "Testing operation to perform"
    },
    "prompt": {
      "type": "string",
      "description": "The prompt to test"
    },
    "model": {
      "type": "string",
      "description": "Model identifier (e.g., gpt-4, claude-3)"
    },
    "models": {
      "type": "array",
      "description": "Multiple models for comparison"
    },
    "temperature": {
      "type": "number",
      "description": "Model temperature (0-2)"
    },
    "max_tokens": {
      "type": "number",
      "description": "Maximum tokens to generate"
    }
  },
  "required": ["operation"]
}'::jsonb
WHERE name = 'prompt_tester';

-- ============================================
-- UPDATE TOKEN ANALYZER
-- ============================================
UPDATE tools SET parameters = '{
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["analyze_text", "conversation_usage", "model_comparison", "cost_estimate"],
      "description": "Token analysis operation"
    },
    "text": {
      "type": "string",
      "description": "Text to analyze for tokens"
    },
    "model": {
      "type": "string",
      "description": "Model for token calculation"
    },
    "conversationId": {
      "type": "string",
      "description": "Conversation ID for usage analysis"
    },
    "period": {
      "type": "string",
      "enum": ["day", "week", "month", "all"],
      "description": "Time period for analysis"
    }
  },
  "required": ["operation"]
}'::jsonb
WHERE name = 'token_analyzer';

-- ============================================
-- UPDATE EVALUATION METRICS
-- ============================================
UPDATE tools SET parameters = '{
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["get_metrics", "quality_trends", "success_analysis", "compare_periods"],
      "description": "Metrics operation to perform"
    },
    "period": {
      "type": "string",
      "enum": ["day", "week", "month", "quarter", "year", "all"],
      "description": "Time period to analyze (default: week)"
    },
    "conversationId": {
      "type": "string",
      "description": "Optional: Analyze specific conversation only"
    },
    "startDate": {
      "type": "string",
      "description": "Optional: Custom start date (ISO format)"
    },
    "endDate": {
      "type": "string",
      "description": "Optional: Custom end date (ISO format)"
    },
    "minRating": {
      "type": "number",
      "description": "Optional: Filter by minimum rating (1-5)"
    },
    "maxRating": {
      "type": "number",
      "description": "Optional: Filter by maximum rating (1-5)"
    }
  },
  "required": ["operation"]
}'::jsonb
WHERE name = 'evaluation_metrics';

-- ============================================
-- UPDATE SYSTEM MONITOR
-- ============================================
UPDATE tools SET parameters = '{
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["health_check", "resource_usage", "performance_metrics", "get_alerts"],
      "description": "Monitoring operation to perform"
    },
    "period": {
      "type": "string",
      "enum": ["hour", "day", "week", "month", "all"],
      "description": "Time period for metrics analysis (default: day)"
    },
    "metricType": {
      "type": "string",
      "enum": ["response_time", "throughput", "errors", "all"],
      "description": "Type of performance metrics to retrieve"
    },
    "includeDetails": {
      "type": "boolean",
      "description": "Include detailed breakdown in results"
    }
  },
  "required": ["operation"]
}'::jsonb
WHERE name = 'system_monitor';

-- ============================================
-- VERIFY UPDATES
-- ============================================
SELECT
    name,
    parameters->>'type' as param_type,
    parameters->'required' as required_array,
    parameters->'properties'->'operation'->'required' as invalid_nested_required
FROM tools
WHERE name IN ('dataset_manager', 'prompt_tester', 'token_analyzer', 'evaluation_metrics', 'system_monitor');

-- Expected:
-- - param_type should be 'object' for all
-- - required_array should show ["operation"]
-- - invalid_nested_required should be NULL (removed)
