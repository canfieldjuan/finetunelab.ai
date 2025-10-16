-- Add New Tools to Database
-- Date: October 13, 2025
-- Adds: Dataset Manager, Prompt Tester, Token Analyzer, Evaluation Metrics

-- ============================================
-- INSERT NEW TOOLS
-- ============================================

-- Dataset Manager Tool
INSERT INTO tools (name, description, parameters, is_builtin, is_enabled) VALUES
(
    'dataset_manager',
    'List, export, filter, and validate conversation data for ML training workflows. Supports JSONL export format for fine-tuning.',
    '{"type": "object", "properties": {"operation": {"type": "string", "enum": ["list", "stats", "export", "validate"], "description": "Dataset operation to perform", "required": true}, "dataset_filter": {"type": "string", "description": "Optional: Filter datasets (all, recent, quality)"}, "export_format": {"type": "string", "description": "Export format (default: jsonl)"}, "limit": {"type": "number", "description": "Optional: Limit results"}}, "required": ["operation"]}'::jsonb,
    true,
    true
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    parameters = EXCLUDED.parameters,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

-- Prompt Tester Tool
INSERT INTO tools (name, description, parameters, is_builtin, is_enabled) VALUES
(
    'prompt_tester',
    'Test prompts with different models, compare outputs, evaluate quality, and save results for analysis.',
    '{"type": "object", "properties": {"operation": {"type": "string", "enum": ["test_single", "compare_models", "batch_test", "save_result"], "description": "Testing operation to perform", "required": true}, "prompt": {"type": "string", "description": "The prompt to test"}, "model": {"type": "string", "description": "Model identifier (e.g., gpt-4, claude-3)"}, "models": {"type": "array", "description": "Multiple models for comparison"}, "temperature": {"type": "number", "description": "Model temperature (0-2)"}, "max_tokens": {"type": "number", "description": "Maximum tokens to generate"}}, "required": ["operation"]}'::jsonb,
    true,
    true
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    parameters = EXCLUDED.parameters,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

-- Token Analyzer Tool
INSERT INTO tools (name, description, parameters, is_builtin, is_enabled) VALUES
(
    'token_analyzer',
    'Analyze token usage, estimate costs, track spending patterns, and optimize token efficiency across conversations and models.',
    '{"type": "object", "properties": {"operation": {"type": "string", "enum": ["analyze_text", "conversation_usage", "model_comparison", "cost_estimate"], "description": "Token analysis operation", "required": true}, "text": {"type": "string", "description": "Text to analyze for tokens"}, "model": {"type": "string", "description": "Model for token calculation"}, "conversationId": {"type": "string", "description": "Conversation ID for usage analysis"}, "period": {"type": "string", "enum": ["day", "week", "month", "all"], "description": "Time period for analysis"}}, "required": ["operation"]}'::jsonb,
    true,
    true
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    parameters = EXCLUDED.parameters,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

-- Evaluation Metrics Tool
INSERT INTO tools (name, description, parameters, is_builtin, is_enabled) VALUES
(
    'evaluation_metrics',
    'Track evaluation quality scores, analyze trends, monitor success rates, and compare performance across time periods',
    '{"type": "object", "properties": {"operation": {"type": "string", "enum": ["get_metrics", "quality_trends", "success_analysis", "compare_periods"], "description": "Metrics operation to perform", "required": true}, "period": {"type": "string", "enum": ["day", "week", "month", "quarter", "year", "all"], "description": "Time period to analyze (default: week)"}, "conversationId": {"type": "string", "description": "Optional: Analyze specific conversation only"}, "startDate": {"type": "string", "description": "Optional: Custom start date (ISO format)"}, "endDate": {"type": "string", "description": "Optional: Custom end date (ISO format)"}, "minRating": {"type": "number", "description": "Optional: Filter by minimum rating (1-5)"}, "maxRating": {"type": "number", "description": "Optional: Filter by maximum rating (1-5)"}}, "required": ["operation"]}'::jsonb,
    true,
    true
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    parameters = EXCLUDED.parameters,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

-- System Monitor Tool
INSERT INTO tools (name, description, parameters, is_builtin, is_enabled) VALUES
(
    'system_monitor',
    'Monitor system health, resource usage, and performance metrics. Check database status, tool availability, and get alerts for potential issues.',
    '{"type": "object", "properties": {"operation": {"type": "string", "enum": ["health_check", "resource_usage", "performance_metrics", "get_alerts"], "description": "Monitoring operation to perform", "required": true}, "period": {"type": "string", "enum": ["hour", "day", "week", "month", "all"], "description": "Time period for metrics analysis (default: day)"}, "metricType": {"type": "string", "enum": ["response_time", "throughput", "errors", "all"], "description": "Type of performance metrics to retrieve"}, "includeDetails": {"type": "boolean", "description": "Include detailed breakdown in results"}}, "required": ["operation"]}'::jsonb,
    true,
    true
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    parameters = EXCLUDED.parameters,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

-- ============================================
-- VERIFY TOOLS
-- ============================================

SELECT 
    name, 
    description, 
    is_enabled, 
    is_builtin,
    created_at
FROM tools 
ORDER BY created_at DESC;

-- Expected: 8 tools total (3 original + 5 new)
-- calculator, datetime, web_search, dataset_manager, prompt_tester, token_analyzer, evaluation_metrics, system_monitor
