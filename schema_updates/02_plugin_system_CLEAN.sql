-- Plugin System Schema
-- Phase 2.1: Database tables for tools and tool executions
-- Date: October 10, 2025
-- COPY THIS ENTIRE FILE TO SUPABASE SQL EDITOR

-- ============================================
-- TOOLS TABLE
-- Stores available tools/plugins that the AI can use
-- ============================================

CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    is_builtin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tools_enabled ON tools(is_enabled);
CREATE INDEX IF NOT EXISTS idx_tools_builtin ON tools(is_builtin);

-- ============================================
-- TOOL EXECUTIONS TABLE
-- Tracks when tools are called and their results
-- ============================================

CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    input_params JSONB NOT NULL,
    output_result JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_conversation ON tool_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_message ON tool_executions(message_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool_id);

-- ============================================
-- INSERT BUILT-IN TOOLS
-- Pre-populate with standard tools
-- ============================================

INSERT INTO tools (name, description, parameters, is_builtin, is_enabled) VALUES
(
    'calculator',
    'Perform mathematical calculations. Supports basic arithmetic, powers, roots, trigonometry.',
    '{"type": "object", "properties": {"expression": {"type": "string", "description": "Mathematical expression to evaluate"}}, "required": ["expression"]}'::jsonb,
    true,
    true
),
(
    'datetime',
    'Get current date and time information, or convert between timezones.',
    '{"type": "object", "properties": {"action": {"type": "string", "enum": ["current", "convert"], "description": "Action to perform"}, "timezone": {"type": "string", "description": "Timezone (e.g., America/New_York)"}}, "required": ["action"]}'::jsonb,
    true,
    true
),
(
    'web_search',
    'Search the web for current information (simulated - returns mock data for now).',
    '{"type": "object", "properties": {"query": {"type": "string", "description": "Search query"}}, "required": ["query"]}'::jsonb,
    true,
    false
);
