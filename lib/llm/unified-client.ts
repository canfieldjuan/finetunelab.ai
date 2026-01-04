// Unified LLM Client
// Single interface for all LLM providers
// Date: 2025-10-14

import type { ChatMessage, ToolDefinition, LLMResponse, LLMUsage, ToolCallMetadata } from './openai';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import type { RequestMetadata } from '@/lib/tracing/types';
import { modelManager } from '@/lib/models/model-manager.service';
import { OpenAIAdapter } from './adapters/openai-adapter';
import { AnthropicAdapter } from './adapters/anthropic-adapter';
import { OllamaAdapter } from './adapters/ollama-adapter';
import { HuggingFaceAdapter } from './adapters/huggingface-adapter';
import { RunPodAdapter } from './adapters/runpod-adapter';
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
      ['runpod', new OpenAIAdapter()], // RunPod vLLM pods use OpenAI-compatible API
      ['azure', new OpenAIAdapter()], // Azure OpenAI uses OpenAI-compatible API
      ['fireworks', new OpenAIAdapter()], // Fireworks.ai uses OpenAI-compatible API
      ['openrouter', new OpenAIAdapter()], // OpenRouter uses OpenAI-compatible API
      ['together', new OpenAIAdapter()], // Together.ai uses OpenAI-compatible API
      ['groq', new OpenAIAdapter()], // Groq uses OpenAI-compatible API
      ['custom', new OpenAIAdapter()], // Custom endpoints typically use OpenAI format
    ]);

    console.log('[UnifiedLLMClient] Initialized with', this.adapters.size, 'adapters');
  }

  /**
   * Get the appropriate adapter for a model
   * Special handling for RunPod: detect serverless vs vLLM pods by URL
   */
  private getAdapter(provider: string, config?: ModelConfig): ProviderAdapter {
    // Special case: RunPod serverless uses different API format than vLLM pods
    if (provider.toLowerCase() === 'runpod' && config) {
      if (config.base_url.includes('api.runpod.ai/v2')) {
        // RunPod Serverless: custom format
        return new RunPodAdapter();
      } else {
        // RunPod vLLM Pod (proxy.runpod.net): OpenAI-compatible
        return new OpenAIAdapter();
      }
    }

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
      enableThinking?: boolean;
    }
  ): Promise<LLMResponse> {
    console.log('[UnifiedLLMClient] Chat request for model:', modelId, 'userId:', options?.userId || 'not provided');

    // Load model configuration from database (with userId for provider secret lookup)
    const config = await modelManager.getModelConfig(modelId, options?.userId);

    if (!config) {
      console.error('[UnifiedLLMClient] Model not found:', modelId);
      throw new Error(`Model not found: ${modelId}`);
    }

    console.log('[UnifiedLLMClient] Using provider:', config.provider, 'model:', config.model_id, 'has_api_key:', !!config.api_key);

    // Get appropriate adapter
    const adapter = this.getAdapter(config.provider, config);

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
      enableThinking?: boolean;
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
        enableThinking: options.enableThinking,
      },
    };

    const { url, headers, body } = adapter.formatRequest(request);

    console.log('[UnifiedLLMClient] Sending request to:', url);

    // Make API call with extended timeout for serverless/slow providers
    const isServerless = url.includes('runpod.net') || url.includes('runpod.io');
    const isHuggingFace = url.includes('huggingface.co');
    const timeoutMs = (isServerless || isHuggingFace) ? 120000 : 60000; // 2 minutes for serverless/HF, 1 minute otherwise

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs/1000}s. ${(isServerless || isHuggingFace) ? 'Endpoint may be cold-starting or processing. Try again in a minute.' : 'Check endpoint availability.'}`);
      }
      throw error;
    }

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
      requestMetadata: adapterResponse.requestMetadata,
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
      enableThinking?: boolean;
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
          enableThinking: options.enableThinking,
        },
      };

      const { url, headers, body } = adapter.formatRequest(request);

      console.log('[UnifiedLLMClient] Making request to:', url);
      console.log('[UnifiedLLMClient] Request body keys:', Object.keys(body));

      // Make API call with extended timeout for serverless/slow providers
      const isServerless = url.includes('runpod.net') || url.includes('runpod.io');
      const isHuggingFace = url.includes('huggingface.co');
      const timeoutMs = (isServerless || isHuggingFace) ? 120000 : 60000; // 2 minutes for serverless/HF, 1 minute otherwise
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeoutMs/1000}s. ${(isServerless || isHuggingFace) ? 'Endpoint may be cold-starting or processing. Try again in a minute.' : 'Check endpoint availability.'}`);
        }
        throw error;
      }

      console.log('[UnifiedLLMClient] Got response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      // Parse response body
      let responseBody;
      const text = await response.text();
      console.log('[UnifiedLLMClient] Response status:', response.status, 'text length:', text.length);

      if (!text || text.length === 0) {
        console.error('[UnifiedLLMClient] Empty response from server');
        console.error('[UnifiedLLMClient] Provider:', config.provider, 'URL:', url);
        console.error('[UnifiedLLMClient] Model:', config.model_id);
        console.error('[UnifiedLLMClient] Response headers:', Object.fromEntries(response.headers.entries()));
        console.error('[UnifiedLLMClient] Request was sent to:', url);
        
        // Check if this is a serverless endpoint that might be cold-starting
        if (url.includes('runpod.net') || url.includes('runpod.io')) {
          throw new Error(`RunPod endpoint returned empty response. This usually means: 1) The endpoint is cold-starting (wait 30-60s and retry), 2) The model failed to load, or 3) The endpoint URL is incorrect. Status: ${response.status}`);
        }
        
        throw new Error(`Server returned empty response (status: ${response.status}, provider: ${config.provider}). Check if the endpoint is running and accessible.`);
      }

      // If response looks like HTML, log it for debugging
      if (text.trim().startsWith('<')) {
        console.error('[UnifiedLLMClient] Server returned HTML instead of JSON (status:', response.status, ')');
        console.error('[UnifiedLLMClient] HTML content:', text.substring(0, 1000));
        throw new Error(`Server returned HTML error page (status: ${response.status}). This usually means authentication failed or the endpoint URL is wrong.`);
      }

      try {
        responseBody = JSON.parse(text);
      } catch (error) {
        console.error('[UnifiedLLMClient] Failed to parse response as JSON:', error);
        console.error('[UnifiedLLMClient] Response text:', text.substring(0, 500));
        throw error;
      }

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

            // Check if result indicates error (safe narrowing - avoid `any` cast)
            let callError: string | undefined;
            if (result && typeof result === 'object' && 'error' in result) {
              const r = result as Record<string, unknown>;
              callError = r.error ? String(r.error) : undefined;
            } else {
              callError = undefined;
            }

            toolCallsTracking.push({
              name: toolCall.name,
              success: !callError,
              error: callError,
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
        // For OpenAI: Must include assistant message with tool_calls even if no content
        // For Anthropic: Can skip if no content (Anthropic requirement)
        const isOpenAI = config.provider === 'openai';

        const assistantMessage = (adapterResponse.content || isOpenAI)
          ? [{
              role: 'assistant' as const,
              content: adapterResponse.content || null,
              tool_calls: adapterResponse.toolCalls?.map(tc => ({
                id: tc.id,
                type: 'function' as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            }]
          : [];

        if (!adapterResponse.content && !isOpenAI) {
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
      onMetadata?: (metadata: RequestMetadata) => void;
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
      const response = await this.chatSimple(config, this.getAdapter(config.provider, config), messages, options || {});
      yield response.content;
      return;
    }

    // Get appropriate adapter
    const adapter = this.getAdapter(config.provider, config);

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
      throw new Error(`Streaming request failed: ${response.status} ${response.statusText}`);
    }

    // Capture metadata if callback provided
    if (options?.onMetadata) {
      try {
        // Sanitize headers (remove auth)
        const sanitizedHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
          if (!key.toLowerCase().includes('auth') && !key.toLowerCase().includes('key')) {
            sanitizedHeaders[key] = value;
          } else {
            sanitizedHeaders[key] = '[REDACTED]';
          }
        }

        const metadata = {
          apiEndpoint: url,
          providerRequestId: response.headers.get('x-request-id') || response.headers.get('x-amzn-requestid') || undefined,
          requestHeadersSanitized: sanitizedHeaders,
        };

        console.log('[UnifiedLLMClient] Capturing request metadata:', {
          endpoint: metadata.apiEndpoint,
          providerId: metadata.providerRequestId,
          headerKeys: Object.keys(metadata.requestHeadersSanitized || {}),
        });

        options.onMetadata(metadata);
      } catch (err) {
        console.error('[UnifiedLLMClient] Error capturing metadata:', err);
      }
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
