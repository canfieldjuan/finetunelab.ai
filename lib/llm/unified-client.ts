// Unified LLM Client
// Single interface for all LLM providers
// Date: 2025-10-14

import type { ChatMessage, ToolDefinition, LLMResponse, LLMUsage, ToolCallMetadata } from './openai';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import { modelManager } from '@/lib/models/model-manager.service';
import { OpenAIAdapter } from './adapters/openai-adapter';
import { AnthropicAdapter } from './adapters/anthropic-adapter';
import { OllamaAdapter } from './adapters/ollama-adapter';
import { HuggingFaceAdapter } from './adapters/huggingface-adapter';
import type { ProviderAdapter, AdapterRequest } from './adapters/base-adapter';

// ============================================================================
// Unified LLM Client
// Provides a single interface for all LLM providers
// Automatically selects the correct adapter based on model configuration
// ============================================================================

export class UnifiedLLMClient {
  private adapters: Map<string, ProviderAdapter>;

  constructor() {
    // Initialize adapters for each provider
    this.adapters = new Map<string, ProviderAdapter>([
      ['openai', new OpenAIAdapter()],
      ['anthropic', new AnthropicAdapter()],
      ['ollama', new OllamaAdapter()],
      ['huggingface', new HuggingFaceAdapter()],
      ['vllm', new OpenAIAdapter()], // vLLM uses OpenAI-compatible API
      ['azure', new OpenAIAdapter()], // Azure OpenAI uses OpenAI-compatible API
      ['custom', new OpenAIAdapter()], // Custom endpoints typically use OpenAI format
    ]);

    console.log('[UnifiedLLMClient] Initialized with', this.adapters.size, 'adapters');
  }

  /**
   * Get the appropriate adapter for a model
   */
  private getAdapter(provider: string): ProviderAdapter {
    const adapter = this.adapters.get(provider.toLowerCase());
    if (!adapter) {
      console.error('[UnifiedLLMClient] No adapter found for provider:', provider);
      throw new Error(`Unsupported provider: ${provider}`);
    }
    return adapter;
  }

  /**
   * Main chat method - handles both streaming and non-streaming
   * Supports tool calls when tools are provided
   */
  async chat(
    modelId: string,
    messages: ChatMessage[],
    options?: {
      tools?: ToolDefinition[];
      temperature?: number;
      maxTokens?: number;
      userId?: string;
      toolCallHandler?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
    }
  ): Promise<LLMResponse> {
    console.log('[UnifiedLLMClient] Chat request for model:', modelId);

    // Load model configuration from database (with userId for provider secret lookup)
    const config = await modelManager.getModelConfig(modelId, options?.userId);

    if (!config) {
      console.error('[UnifiedLLMClient] Model not found:', modelId);
      throw new Error(`Model not found: ${modelId}`);
    }

    console.log('[UnifiedLLMClient] Using provider:', config.provider, 'model:', config.model_id);

    // Get appropriate adapter
    const adapter = this.getAdapter(config.provider);

    // If tools are provided and handler exists, use tool-call aware flow
    if (options?.tools && options.tools.length > 0 && options.toolCallHandler) {
      return this.chatWithTools(config, adapter, messages, {
        tools: options.tools,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        toolCallHandler: options.toolCallHandler,
      });
    }

    // Otherwise, simple chat completion
    return this.chatSimple(config, adapter, messages, options || {});
  }

  /**
   * Simple chat completion without tool calls
   */
  private async chatSimple(
    config: ModelConfig,
    adapter: ProviderAdapter,
    messages: ChatMessage[],
    options: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<LLMResponse> {
    // Format request using adapter
    const request: AdapterRequest = {
      messages,
      config,
      options: {
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: false,
      },
    };

    const { url, headers, body } = adapter.formatRequest(request);

    console.log('[UnifiedLLMClient] Sending request to:', url);

    // Make API call
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    // Parse response body
    const responseBody = await response.json();

    // Check for errors AFTER parsing body
    if (!response.ok) {
      console.error('[UnifiedLLMClient] API error:', {
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
      });
      // Extract error message from response body
      const errorMsg = this.extractErrorMessage(responseBody);
      throw new Error(`API error (${response.status}): ${errorMsg}`);
    }

    // Parse response using adapter
    const adapterResponse = await adapter.parseResponse(response, responseBody);

    // Convert to LLMResponse format
    const llmResponse: LLMResponse = {
      content: adapterResponse.content,
      reasoning: adapterResponse.reasoning,
      usage: adapterResponse.usage || {
        input_tokens: 0,
        output_tokens: 0,
      },
    };

    console.log('[UnifiedLLMClient] Response:', {
      contentLength: llmResponse.content.length,
      usage: llmResponse.usage,
    });

    return llmResponse;
  }

  /**
   * Chat with tool call support
   * Handles multiple rounds of tool execution
   */
  private async chatWithTools(
    config: ModelConfig,
    adapter: ProviderAdapter,
    messages: ChatMessage[],
    options: {
      tools: ToolDefinition[];
      temperature?: number;
      maxTokens?: number;
      toolCallHandler: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
    }
  ): Promise<LLMResponse> {
    // Filter out messages with empty/null content (Anthropic requirement)
    let currentMessages = messages.filter(msg => {
      const hasContent = msg.content !== null &&
                        msg.content !== undefined &&
                        msg.content.trim().length > 0;
      if (!hasContent) {
        console.log('[UnifiedLLMClient] Filtering out empty message:', {
          role: msg.role,
          content: msg.content,
          hasContent,
        });
      }
      return hasContent;
    });

    console.log('[UnifiedLLMClient] Starting with', currentMessages.length, 'messages (filtered from', messages.length, ')');

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const toolCallsTracking: ToolCallMetadata[] = [];

    // Allow up to 3 rounds of tool calls
    for (let round = 0; round < 3; round++) {
      console.log('[UnifiedLLMClient] Tool call round:', round + 1);

      // Format request
      const request: AdapterRequest = {
        messages: currentMessages,
        config,
        options: {
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          tools: options.tools,
          stream: false,
        },
      };

      const { url, headers, body } = adapter.formatRequest(request);

      // Make API call
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      // Parse response body
      const responseBody = await response.json();

      // Check for errors AFTER parsing body
      if (!response.ok) {
        console.error('[UnifiedLLMClient] API error in tool call round', round + 1, ':', {
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
        });
        // Extract error message from response body
        const errorMsg = this.extractErrorMessage(responseBody);

        // VLLM TOOL CHOICE ERROR HANDLING
        // If vLLM server isn't configured with --enable-auto-tool-choice, provide helpful error
        if (
          errorMsg.includes('tool choice requires --enable-auto-tool-choice') ||
          errorMsg.includes('tool-call-parser')
        ) {
          console.error('[UnifiedLLMClient] vLLM server not configured for tool choice');
          console.error('[UnifiedLLMClient] To fix: restart vLLM with --enable-auto-tool-choice and --tool-call-parser hermes');
          console.error('[UnifiedLLMClient] Example: vllm serve MODEL --port 8003 --enable-auto-tool-choice --tool-call-parser hermes');
          throw new Error(
            'vLLM server is not configured to support tools. ' +
            'Please restart vLLM with --enable-auto-tool-choice and --tool-call-parser flags, ' +
            'or disable tools for this model in the model configuration.'
          );
        }

        throw new Error(`API error (${response.status}): ${errorMsg}`);
      }

      // Parse response
      const adapterResponse = await adapter.parseResponse(response, responseBody);

      // Accumulate token usage
      if (adapterResponse.usage) {
        totalInputTokens += adapterResponse.usage.input_tokens;
        totalOutputTokens += adapterResponse.usage.output_tokens;
      }

      // If model provides BOTH content and tool calls, it's giving a final answer
      // Return the content and track the tool calls
      if (adapterResponse.content && adapterResponse.toolCalls && adapterResponse.toolCalls.length > 0) {
        console.log('[UnifiedLLMClient] Model provided both content and tool calls - returning final answer');

        const finalUsage: LLMUsage = {
          input_tokens: totalInputTokens + (adapterResponse.usage?.input_tokens || 0),
          output_tokens: totalOutputTokens + (adapterResponse.usage?.output_tokens || 0),
        };

        return {
          content: adapterResponse.content,
          reasoning: adapterResponse.reasoning,
          usage: finalUsage,
          toolsCalled: toolCallsTracking.length > 0 ? toolCallsTracking : undefined,
        };
      }

      // Check for tool calls (without content - model wants to call tools)
      if (adapterResponse.toolCalls && adapterResponse.toolCalls.length > 0) {
        console.log('[UnifiedLLMClient] Executing', adapterResponse.toolCalls.length, 'tool calls');

        // Execute tool calls
        const toolResults = [];
        for (const toolCall of adapterResponse.toolCalls) {
          try {
            const result = await options.toolCallHandler(toolCall.name, toolCall.arguments);

            // Check if result indicates error
            const hasError = result && typeof result === 'object' && 'error' in result;

            toolCallsTracking.push({
              name: toolCall.name,
              success: !hasError,
              error: hasError ? String((result as any).error) : undefined,
            });

            // Add tool result to messages
            toolResults.push({
              role: 'tool' as const,
              content: typeof result === 'string' ? result : JSON.stringify(result),
              tool_call_id: toolCall.id,
              name: toolCall.name,
            });
          } catch (error) {
            toolCallsTracking.push({
              name: toolCall.name,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });

            // Add error result to messages
            toolResults.push({
              role: 'tool' as const,
              content: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
              tool_call_id: toolCall.id,
              name: toolCall.name,
            });
          }
        }

        // Continue conversation with tool results
        // Only include assistant message if it has content (Anthropic requirement)
        const assistantMessage = adapterResponse.content
          ? [{
              role: 'assistant' as const,
              content: adapterResponse.content,
            }]
          : [];

        if (!adapterResponse.content) {
          console.log('[UnifiedLLMClient] Skipping empty assistant message (tool-only response)');
        }

        currentMessages = [
          ...currentMessages,
          ...assistantMessage,
          ...toolResults,
        ];

        // Continue to next round
        continue;
      }

      // No tool calls - return final response
      const finalUsage: LLMUsage = {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      };

      console.log('[UnifiedLLMClient] Final response:', {
        contentLength: adapterResponse.content.length,
        usage: finalUsage,
        toolCallCount: toolCallsTracking.length,
      });

      return {
        content: adapterResponse.content,
        reasoning: adapterResponse.reasoning,
        usage: finalUsage,
        toolsCalled: toolCallsTracking.length > 0 ? toolCallsTracking : undefined,
      };
    }

    // Max rounds reached
    const finalUsage: LLMUsage = {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    };

    console.log('[UnifiedLLMClient] Max tool call rounds reached');

    return {
      content: 'Maximum tool call rounds reached',
      usage: finalUsage,
      toolsCalled: toolCallsTracking.length > 0 ? toolCallsTracking : undefined,
    };
  }

  /**
   * Streaming chat method
   * Yields text chunks as they arrive from the LLM
   */
  async *stream(
    modelId: string,
    messages: ChatMessage[],
    options?: {
      tools?: ToolDefinition[];
      temperature?: number;
      maxTokens?: number;
      userId?: string;
    }
  ): AsyncGenerator<string, void, unknown> {
    console.log('[UnifiedLLMClient] Stream request for model:', modelId);

    // Load model configuration (with userId for provider secret lookup)
    const config = await modelManager.getModelConfig(modelId, options?.userId);

    if (!config) {
      console.error('[UnifiedLLMClient] Model not found:', modelId);
      throw new Error(`Model not found: ${modelId}`);
    }

    console.log('[UnifiedLLMClient] Streaming from provider:', config.provider);

    // Check if model supports streaming
    if (!config.supports_streaming) {
      console.warn('[UnifiedLLMClient] Model does not support streaming, falling back to non-streaming');
      const response = await this.chatSimple(config, this.getAdapter(config.provider), messages, options || {});
      yield response.content;
      return;
    }

    // Get appropriate adapter
    const adapter = this.getAdapter(config.provider);

    // Format request
    const request: AdapterRequest = {
      messages,
      config,
      options: {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        tools: options?.tools,
        stream: true,
      },
    };

    const { url, headers, body } = adapter.formatRequest(request);

    console.log('[UnifiedLLMClient] Streaming from:', url);

    // Make streaming request
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(`Streaming request failed: ${response.status} ${response.statusText}`);
    }

    // Read streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split buffer by newlines (SSE format)
        const lines = buffer.split('\n');

        // Keep last incomplete line in buffer
        buffer = lines.pop() || '';

        // Process each complete line
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Parse chunk using adapter
          const text = adapter.parseStreamChunk(trimmed);
          if (text) {
            yield text;
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const text = adapter.parseStreamChunk(buffer.trim());
        if (text) {
          yield text;
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('[UnifiedLLMClient] Stream complete');
  }

  /**
   * Extract error message from API response body
   * Handles different error formats from different providers
   */
  private extractErrorMessage(responseBody: unknown): string {
    // Try common error formats
    if (typeof responseBody === 'object' && responseBody !== null) {
      const body = responseBody as Record<string, unknown>;

      // Anthropic format: { error: { type: "...", message: "..." } }
      if (body.error && typeof body.error === 'object') {
        const error = body.error as Record<string, unknown>;
        if (error.message && typeof error.message === 'string') {
          return error.message;
        }
      }

      // OpenAI format: { error: "message" }
      if (body.error && typeof body.error === 'string') {
        return body.error;
      }

      // Simple message field
      if (body.message && typeof body.message === 'string') {
        return body.message;
      }

      // Return full body as JSON string if no message found
      return JSON.stringify(responseBody);
    }

    return String(responseBody);
  }
}

// Export singleton instance
export const unifiedLLMClient = new UnifiedLLMClient();

console.log('[UnifiedLLMClient] Unified LLM client loaded and ready');
