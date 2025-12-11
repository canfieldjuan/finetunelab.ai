// Tools Hook - React integration for tool system
// Phase 2.5: Custom hook for tool management
// Date: October 10, 2025

import { useState, useEffect, useCallback } from 'react';
import {
  getEnabledTools,
  executeTool as executeToolService,
  getToolExecutions,
  Tool,
  ToolExecution,
} from '@/lib/tools';

export function useTools(conversationId?: string) {
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [loading, setLoading] = useState(false);

  // ============================================
  // AUTO-LOAD AVAILABLE TOOLS ON MOUNT
  // ============================================
  useEffect(() => {
    async function loadTools() {
      console.log('[useTools] Loading available tools');
      setLoading(true);
      const { data, error } = await getEnabledTools();
      setLoading(false);

      if (error) {
        console.error('[useTools] Error loading tools:', error);
        return;
      }

      setAvailableTools(data);
      console.log('[useTools] Loaded', data.length, 'tools');
    }

    loadTools();
  }, []);

  // ============================================
  // AUTO-LOAD TOOL EXECUTIONS ON CONVERSATION CHANGE
  // ============================================
  useEffect(() => {
    async function loadExecutions() {
      if (!conversationId) {
        setToolExecutions([]);
        return;
      }

      console.log('[useTools] Loading tool executions for:', conversationId);
      setLoading(true);
      const { data, error } = await getToolExecutions(conversationId);
      setLoading(false);

      if (error) {
        console.error('[useTools] Error loading executions:', error);
        return;
      }

      setToolExecutions(data);
      console.log('[useTools] Loaded', data.length, 'executions');
    }

    loadExecutions();
  }, [conversationId]);

  // ============================================
  // EXECUTE TOOL METHOD
  // ============================================
  const executeTool = useCallback(
    async (
      toolName: string,
      params: Record<string, unknown>,
      messageId?: string
    ) => {
      if (!conversationId) {
        console.warn('[useTools] Cannot execute tool: no conversation');
        return { data: null, error: 'No active conversation' };
      }

      console.log('[useTools] Executing tool:', toolName);
      const result = await executeToolService(toolName, params, conversationId, messageId);

      // Add to local state
      if (!result.error && conversationId) {
        const newExecution: ToolExecution = {
          id: Date.now().toString(), // Temporary ID
          conversationId,
          messageId: messageId || '',
          toolId: '', // Will be filled by database
          toolName,
          inputParams: params,
          outputResult: result.data,
          executionTimeMs: result.executionTimeMs,
          createdAt: new Date().toISOString(),
        };
        setToolExecutions(prev => [newExecution, ...prev]);
      }

      return result;
    },
    [conversationId]
  );

  // ============================================
  // GET TOOLS FOR OPENAI FORMAT
  // ============================================
  const getToolsForOpenAI = useCallback(() => {
    return availableTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }, [availableTools]);

  return {
    // State
    availableTools,
    toolExecutions,
    loading,

    // Methods
    executeTool,
    getToolsForOpenAI,
  };
}
