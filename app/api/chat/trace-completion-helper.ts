/**
 * Helper function to complete LLM traces consistently
 * Centralizes trace completion logic to avoid duplication
 */

import type { TraceContext } from '@/lib/tracing/types';
import * as traceService from '@/lib/tracing/trace.service';

interface TraceCompletionParams {
  traceContext: TraceContext;
  finalResponse: string;
  enhancedMessages: Array<{ role: string; content: string | unknown }>;
  tokenUsage?: {
    input_tokens: number;
    output_tokens: number;
  };
  selectedModelId?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{ function: { name: string; description?: string } }>;
  toolsCalled?: Array<{ name: string; success: boolean }>;
  reasoning?: string;
  latencyMs?: number;
  ttftMs?: number;
}

/**
 * Complete a trace with full data (input/output, cost, metrics)
 */
export async function completeTraceWithFullData(params: TraceCompletionParams): Promise<void> {
  const {
    traceContext,
    finalResponse,
    enhancedMessages,
    tokenUsage,
    selectedModelId,
    temperature,
    maxTokens,
    tools,
    toolsCalled,
    reasoning,
    latencyMs,
    ttftMs,
  } = params;

  try {
    console.log(`[Trace Helper] Starting completeTraceWithFullData for ${traceContext.spanId}`);

    // Dynamic imports to avoid circular dependencies
    const { truncateString } = await import('@/lib/tracing/trace-utils');
    const { calculateCost, matchModelToPricing } = await import('@/lib/tracing/pricing-config');

    console.log(`[Trace Helper] Imports successful, processing ${enhancedMessages?.length || 0} messages`);

    // Prepare input data
    const systemPrompt = enhancedMessages.find(m => m.role === 'system')?.content;
    const lastUserMessage = enhancedMessages.filter(m => m.role === 'user').slice(-1)[0]?.content;

    console.log(`[Trace Helper] Extracted prompts - system: ${!!systemPrompt}, user: ${!!lastUserMessage}`);
    console.log(`[Trace Helper] Tools available: ${tools?.length || 0}`);
    if (tools && tools.length > 0) {
      console.log(`[Trace Helper] Tool names: ${tools.map(t => t.function.name).join(', ')}`);
    }

    const llmInputData = {
      systemPrompt: systemPrompt ? truncateString(String(systemPrompt), 5000) : undefined,
      userMessage: lastUserMessage ? truncateString(String(lastUserMessage), 5000) : undefined,
      conversationHistory: enhancedMessages
        .filter(m => m.role !== 'system')
        .slice(0, -1) // Exclude the current message (last message)
        .slice(-5)    // Take the last 5 previous messages
        .map(m => ({
          role: m.role,
          content: truncateString(String(m.content || ''), 500),
        })),
      parameters: {
        temperature,
        maxTokens,
      },
      toolDefinitions: tools?.map(t => ({
        name: t.function.name,
        description: t.function.description,
      })),
    };

    console.log(`[Trace Helper] Input data prepared, toolDefinitions count: ${llmInputData.toolDefinitions?.length || 0}`);

    // Prepare output data
    const llmOutputData = {
      content: truncateString(finalResponse, 10000),
      reasoning: reasoning ? truncateString(reasoning, 10000) : undefined,
      stopReason: 'stop',
      toolCallsMade: toolsCalled?.map(t => ({
        name: t.name,
        success: t.success,
      })),
    };

    // Calculate cost if possible
    let costUsd: number | undefined;
    if (tokenUsage && selectedModelId) {
      const pricingKey = matchModelToPricing(selectedModelId);
      costUsd = calculateCost(pricingKey, tokenUsage.input_tokens, tokenUsage.output_tokens);
      console.log(`[Trace] Calculated cost: $${costUsd.toFixed(6)} for ${tokenUsage.input_tokens} + ${tokenUsage.output_tokens} tokens`);
    }

    // Calculate throughput
    let tokensPerSecond: number | undefined;
    if (tokenUsage?.output_tokens && latencyMs && latencyMs > 0) {
      tokensPerSecond = (tokenUsage.output_tokens / latencyMs) * 1000;
    }

    // End trace with full data
    await traceService.endTrace(traceContext, {
      endTime: new Date(),
      status: 'completed',
      inputTokens: tokenUsage?.input_tokens,
      outputTokens: tokenUsage?.output_tokens,
      cacheCreationInputTokens: tokenUsage?.cache_creation_input_tokens,
      cacheReadInputTokens: tokenUsage?.cache_read_input_tokens,
      costUsd,
      tokensPerSecond,
      ttftMs,
      inputData: llmInputData,
      outputData: llmOutputData,
    });

    console.log(`[Trace] Completed trace ${traceContext.spanId} with full data`);
  } catch (error) {
    console.error('[Trace] Failed to complete trace with full data:', error);

    // Fallback to basic completion
    try {
      await traceService.endTrace(traceContext, {
        endTime: new Date(),
        status: 'completed',
        inputTokens: tokenUsage?.input_tokens,
        outputTokens: tokenUsage?.output_tokens,
      });
      console.log(`[Trace] Completed trace ${traceContext.spanId} with basic data (fallback)`);
    } catch (fallbackErr) {
      console.error('[Trace] Fallback completion also failed:', fallbackErr);
      // Don't throw - trace completion should never break the main flow
    }
  }
}

/**
 * Complete a trace with basic data only (when full data not available)
 */
export async function completeTraceBasic(
  traceContext: TraceContext,
  tokenUsage?: { input_tokens: number; output_tokens: number }
): Promise<void> {
  try {
    await traceService.endTrace(traceContext, {
      endTime: new Date(),
      status: 'completed',
      inputTokens: tokenUsage?.input_tokens,
      outputTokens: tokenUsage?.output_tokens,
    });
    console.log(`[Trace] Completed trace ${traceContext.spanId} with basic data`);
  } catch (error) {
    console.error('[Trace] Failed to complete trace with basic data:', error);
    // Don't throw - trace completion should never break the main flow
  }
}
