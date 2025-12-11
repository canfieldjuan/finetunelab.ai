// Tool Executor - Wrapper for executing analytics tools
// Phase 12: Analytics Tools Integration
// Date: October 13, 2025

import { tokenAnalyzerTool } from './token-analyzer';
import { evaluationMetricsTool } from './evaluation-metrics';
import promptTesterTool from './prompt-tester';

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Execute an analytics tool with parameters
 */
export async function executeTool(
  toolName: string,
  operation: string,
  params: Record<string, unknown>,
  userId: string
): Promise<ToolExecutionResult> {
  try {
    const allParams = { operation, userId, ...params };

    let result: unknown;

    switch (toolName) {
      case 'token_analyzer':
        result = await tokenAnalyzerTool.execute(allParams);
        break;

      case 'evaluation_metrics':
        result = await evaluationMetricsTool.execute(allParams);
        break;

      case 'prompt_tester':
        result = await promptTesterTool.execute(allParams);
        break;

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }

    return result as ToolExecutionResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
