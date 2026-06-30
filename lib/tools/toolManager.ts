// Tool Manager - Database integration for tools
// Phase 2.3: Tool management service
// Date: October 10, 2025
// Updated: Phase 5 - Uses modular registry instead of builtinTools

import { supabase, supabaseAdmin } from '../supabaseClient';
import { getToolByName } from './registry';
import { isPortalChatTool } from './registry-sync';
import { toolValidator } from './validator';
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
  messageId: string | null;
  toolId: string | null;
  toolName: string;
  toolSource: 'portal' | 'mcp';
  inputParams: unknown;
  outputResult: unknown;
  errorMessage?: string;
  executionTimeMs: number;
  metadata: unknown;
  createdAt: string;
}

export interface ExecuteToolOptions {
  enforcePortalChatTool?: boolean;
  honorConfigEnabled?: boolean;
  validateParameters?: boolean;
  allowedToolNames?: ReadonlySet<string> | readonly string[];
}

export interface RecordToolExecutionInput {
  conversationId?: string | null;
  messageId?: string | null;
  toolId?: string | null;
  toolName: string;
  toolSource?: 'portal' | 'mcp';
  inputParams: unknown;
  outputResult: unknown;
  errorMessage?: string | null;
  executionTimeMs: number;
  metadata?: Record<string, unknown>;
}

function toTool(row: {
  id: string;
  name: string;
  description: string;
  parameters: unknown;
  is_enabled: boolean;
  is_builtin: boolean;
}): Tool {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    parameters: row.parameters,
    isEnabled: row.is_enabled,
    isBuiltin: row.is_builtin,
  };
}

function sortToolRows<T extends { name: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => {
    // web_search always comes first
    if (a.name === 'web_search') return -1;
    if (b.name === 'web_search') return 1;
    // Then alphabetical
    return a.name.localeCompare(b.name);
  });
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

  const registeredRows = (data || []).flatMap((row) => {
    const toolDef = getToolByName(row.name);
    if (!toolDef) {
      console.warn('[ToolManager] Skipping DB-enabled tool missing from registry:', row.name);
      return [];
    }
    if (!toolDef.config.enabled) {
      console.warn('[ToolManager] Skipping DB-enabled tool disabled by config:', row.name);
      return [];
    }
    return [{
      ...row,
      description: toolDef.description,
      parameters: toolDef.parameters,
    }];
  });

  const tools = sortToolRows(registeredRows).map(toTool);

  console.log('[ToolManager] [DEBUG] Tools sorted order:', tools.map(t => t.name).join(', '));

  return { data: tools, error: null };
}

export async function getEnabledPortalChatTools(): Promise<{ data: Tool[]; error: string | null }> {
  const { data, error } = await getEnabledTools();
  if (error) {
    return { data: [], error };
  }

  const tools = data.filter((tool) => {
    const toolDef = getToolByName(tool.name);
    if (!toolDef) return false;
    if (!isPortalChatTool(toolDef)) {
      console.debug('[ToolManager] Skipping non-portal tool for chat listing:', tool.name);
      return false;
    }
    return true;
  });

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
  supabaseClient?: unknown,
  traceContext?: unknown,
  options: ExecuteToolOptions = {}
): Promise<{ data: unknown; error: string | null; executionTimeMs: number }> {
  console.log('[ToolManager] Executing tool:', toolName, 'with params:', params);

  const startTime = Date.now();

  if (options.allowedToolNames) {
    const allowedToolNames = options.allowedToolNames instanceof Set
      ? options.allowedToolNames
      : new Set(options.allowedToolNames);
    if (!allowedToolNames.has(toolName)) {
      return {
        data: null,
        error: `Tool was not offered for this request: ${toolName}`,
        executionTimeMs: 0
      };
    }
  }

  // Get tool definition
  const toolDef = getToolByName(toolName);
  if (!toolDef) {
    return { 
      data: null, 
      error: `Tool not found: ${toolName}`, 
      executionTimeMs: 0 
    };
  }

  if (options.enforcePortalChatTool && !isPortalChatTool(toolDef)) {
    return {
      data: null,
      error: `Tool is not available in chat portal: ${toolName}`,
      executionTimeMs: 0
    };
  }

  // Get tool from database before any schema validation so disabled/missing tools
  // return the same response shape without exposing parameter details.
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

  if (options.honorConfigEnabled && !toolDef.config.enabled) {
    return {
      data: null,
      error: `Tool is disabled by config: ${toolName}`,
      executionTimeMs: 0
    };
  }

  if (options.validateParameters) {
    const validation = toolValidator.validateParameters(params, toolDef);
    if (!validation.valid) {
      return {
        data: null,
        error: `Parameter validation failed: ${validation.errors.join(', ')}`,
        executionTimeMs: 0
      };
    }
  }

  // Execute tool with timeout and error boundary
  let result: unknown;
  let errorMsg: string | null = null;

  try {
    console.log(`[ToolManager] Executing ${toolName} with ${TOOL_TIMEOUT_MS}ms timeout`);

    // Wrap execution with timeout to prevent server hang
    result = await withTimeout(
      toolDef.execute(params, conversationId, userId, supabaseClient, traceContext),
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
  await recordToolExecution({
    conversationId,
    messageId,
    toolId: toolData.id,
    toolName,
    toolSource: 'portal',
    inputParams: params,
    outputResult: result,
    errorMessage: errorMsg,
    executionTimeMs,
  });

  return {
    data: result,
    error: errorMsg,
    executionTimeMs
  };
}

export async function recordToolExecution(input: RecordToolExecutionInput): Promise<void> {
  const client = supabaseAdmin ?? supabase;
  const { error } = await client.from('tool_executions').insert({
    conversation_id: input.conversationId || null,
    message_id: input.messageId || null,
    tool_id: input.toolId || null,
    tool_name: input.toolName,
    tool_source: input.toolSource ?? 'portal',
    input_params: input.inputParams ?? {},
    output_result: input.outputResult ?? null,
    error_message: input.errorMessage ?? null,
    execution_time_ms: input.executionTimeMs,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error('[ToolManager] Failed to record tool execution:', error);
  }
}

export async function executePortalChatTool(
  toolName: string,
  params: Record<string, unknown>,
  conversationId: string,
  messageId?: string,
  userId?: string,
  supabaseClient?: unknown,
  traceContext?: unknown,
  options: Pick<ExecuteToolOptions, 'allowedToolNames'> = {}
): Promise<{ data: unknown; error: string | null; executionTimeMs: number }> {
  return executeTool(
    toolName,
    params,
    conversationId,
    messageId,
    userId,
    supabaseClient,
    traceContext,
    {
      enforcePortalChatTool: true,
      honorConfigEnabled: true,
      validateParameters: true,
      allowedToolNames: options.allowedToolNames,
    }
  );
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
    toolSource: e.tool_source ?? 'portal',
    inputParams: e.input_params,
    outputResult: e.output_result,
    errorMessage: e.error_message,
    executionTimeMs: e.execution_time_ms,
    metadata: e.metadata ?? {},
    createdAt: e.created_at,
  })) || [];

  return { data: executions, error: null };
}
