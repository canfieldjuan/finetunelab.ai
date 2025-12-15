// Tool Manager - Database integration for tools
// Phase 2.3: Tool management service
// Date: October 10, 2025
// Updated: Phase 5 - Uses modular registry instead of builtinTools

import { supabase } from '../supabaseClient';
import { getToolByName } from './registry';
import { withTimeout, TOOL_TIMEOUT_MS } from './timeout';

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: unknown;
  isEnabled: boolean;
  isBuiltin: boolean;
}

export interface ToolExecution {
  id: string;
  conversationId: string;
  messageId: string;
  toolId: string;
  toolName: string;
  inputParams: unknown;
  outputResult: unknown;
  errorMessage?: string;
  executionTimeMs: number;
  createdAt: string;
}

// ============================================
// GET ALL ENABLED TOOLS
// ============================================

export async function getEnabledTools(): Promise<{ data: Tool[]; error: string | null }> {
  console.log('[ToolManager] Fetching enabled tools');

  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('is_enabled', true)
    .order('name');

  if (error) {
    console.error('[ToolManager] Error fetching tools:', error);
    return { data: [], error: error.message };
  }

  // Custom sort: prioritize web_search, then alphabetical
  const sortedData = data?.sort((a, b) => {
    // web_search always comes first
    if (a.name === 'web_search') return -1;
    if (b.name === 'web_search') return 1;
    // Then alphabetical
    return a.name.localeCompare(b.name);
  }) || [];

  const tools = sortedData?.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    isEnabled: t.is_enabled,
    isBuiltin: t.is_builtin,
  })) || [];

  console.log('[ToolManager] [DEBUG] Tools sorted order:', tools.map(t => t.name).join(', '));

  return { data: tools, error: null };
}

// ============================================
// EXECUTE A TOOL
// ============================================

export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  conversationId: string,
  messageId?: string,
  userId?: string,
  supabaseClient?: unknown
): Promise<{ data: unknown; error: string | null; executionTimeMs: number }> {
  console.log('[ToolManager] Executing tool:', toolName, 'with params:', params);

  const startTime = Date.now();

  // Get tool definition
  const toolDef = getToolByName(toolName);
  if (!toolDef) {
    return { 
      data: null, 
      error: `Tool not found: ${toolName}`, 
      executionTimeMs: 0 
    };
  }

  // Get tool from database
  const { data: toolData, error: toolError } = await supabase
    .from('tools')
    .select('id, is_enabled')
    .eq('name', toolName)
    .single();

  if (toolError || !toolData) {
    return { 
      data: null, 
      error: `Tool not found in database: ${toolName}`, 
      executionTimeMs: 0 
    };
  }

  if (!toolData.is_enabled) {
    return { 
      data: null, 
      error: `Tool is disabled: ${toolName}`, 
      executionTimeMs: 0 
    };
  }

  // Execute tool with timeout and error boundary
  let result: unknown;
  let errorMsg: string | null = null;

  try {
    console.log(`[ToolManager] Executing ${toolName} with ${TOOL_TIMEOUT_MS}ms timeout`);

    // Wrap execution with timeout to prevent server hang
    result = await withTimeout(
      toolDef.execute(params, conversationId, userId, supabaseClient),
      TOOL_TIMEOUT_MS,
      `Tool: ${toolName}`
    );

    console.log(`[ToolManager] ${toolName} completed successfully`);
  } catch (error) {
    console.error('[ToolManager] Tool execution error:', error);

    // Extract error message and add context
    const errorObj = error as Error;
    errorMsg = errorObj.message;

    // Add specific handling for timeout errors
    if (errorMsg.includes('[Timeout]')) {
      console.error(`[ToolManager] TIMEOUT: ${toolName} exceeded ${TOOL_TIMEOUT_MS}ms`);
      errorMsg = `Tool execution timeout: ${toolName} took longer than ${TOOL_TIMEOUT_MS/1000}s to complete`;
    }

    result = null;
  }

  const executionTimeMs = Date.now() - startTime;

  // Log execution
  await supabase.from('tool_executions').insert({
    conversation_id: conversationId,
    message_id: messageId || null,
    tool_id: toolData.id,
    tool_name: toolName,
    input_params: params,
    output_result: result,
    error_message: errorMsg,
    execution_time_ms: executionTimeMs,
  });

  return { 
    data: result, 
    error: errorMsg, 
    executionTimeMs 
  };
}

// ============================================
// GET TOOL EXECUTIONS FOR CONVERSATION
// ============================================

export async function getToolExecutions(
  conversationId: string
): Promise<{ data: ToolExecution[]; error: string | null }> {
  console.log('[ToolManager] Fetching tool executions for:', conversationId);

  const { data, error } = await supabase
    .from('tool_executions')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ToolManager] Error fetching executions:', error);
    return { data: [], error: error.message };
  }

  const executions = data?.map(e => ({
    id: e.id,
    conversationId: e.conversation_id,
    messageId: e.message_id,
    toolId: e.tool_id,
    toolName: e.tool_name,
    inputParams: e.input_params,
    outputResult: e.output_result,
    errorMessage: e.error_message,
    executionTimeMs: e.execution_time_ms,
    createdAt: e.created_at,
  })) || [];

  return { data: executions, error: null };
}
