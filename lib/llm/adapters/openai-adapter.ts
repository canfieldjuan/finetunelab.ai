// OpenAI Provider Adapter
// Also supports vLLM, Azure OpenAI, and other OpenAI-compatible APIs
// Date: 2025-10-14

import type { ChatMessage, ToolDefinition } from '../openai';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import { BaseProviderAdapter, type AdapterRequest, type AdapterResponse } from './base-adapter';

// ============================================================================
// OpenAI Adapter
// Handles OpenAI API format (also used by vLLM, LM Studio, etc.)
// ============================================================================

export class OpenAIAdapter extends BaseProviderAdapter {
  readonly name = 'OpenAI';

  /**
   * Build authorization headers for OpenAI API
   * Supports both Bearer tokens and API key authentication
   */
  buildAuthHeaders(config: ModelConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.api_key) {
      if (config.auth_type === 'api_key' || config.provider === 'azure') {
        headers['api-key'] = config.api_key;
      } else {
        headers['Authorization'] = `Bearer ${config.api_key}`;
      }
    }

    // Add custom headers if provided
    if (config.auth_headers) {
      Object.assign(headers, config.auth_headers);
    }

    return headers;
  }

  /**
   * Format request for OpenAI API
   * Endpoint: /chat/completions (or /v1/chat/completions)
   */
  formatRequest(request: AdapterRequest): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    const { messages, config, options } = request;

    // Build endpoint URL
    let endpoint = '/chat/completions';

    // Azure OpenAI uses different URL structure
    if (config.provider === 'azure') {
      endpoint = `/openai/deployments/${config.model_id}/chat/completions?api-version=2024-02-15-preview`;
    } else if (!config.base_url.includes('/v1')) {
      endpoint = '/v1/chat/completions';
    }

    const url = this.buildUrl(config.base_url, endpoint);
    const headers = this.buildAuthHeaders(config);

    // Build request body
    // For vLLM/Ollama: Use served_model_name (the name vLLM/Ollama was told to serve the model as)
    // For other providers: Use model_id (the standard model identifier)
    const modelName = (config.provider === 'vllm' || config.provider === 'ollama')
      ? (config.served_model_name || config.model_id)
      : config.model_id;

    const body: Record<string, unknown> = {
      model: modelName,
      messages: this.formatMessages(messages),
      temperature: options.temperature ?? config.default_temperature ?? 0.7,
      max_tokens: options.maxTokens ?? config.max_output_tokens ?? 2000,
    };

    // Add tools if provided and supported
    if (options.tools && options.tools.length > 0 && config.supports_functions) {
      body.tools = options.tools;
    }

    // Add streaming flag if requested
    if (options.stream && config.supports_streaming) {
      body.stream = true;
    }

    console.log('[OpenAIAdapter] Request:', {
      url,
      model: modelName,
      messageCount: messages.length,
      toolCount: options.tools?.length || 0,
      stream: options.stream || false,
    });

    return { url, headers, body };
  }

  /**
   * Format messages for OpenAI API
   * Converts our standard format to OpenAI format
   */
  private formatMessages(messages: ChatMessage[]): Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown;
    tool_call_id?: string;
    name?: string;
  }> {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
      ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
      ...(msg.name ? { name: msg.name } : {}),
    }));
  }

  /**
   * Parse OpenAI API response into standardized format
   */
  async parseResponse(response: Response, responseBody: any): Promise<AdapterResponse> {
    if (!response.ok) {
      await this.handleResponseError(response);
    }

    const choice = responseBody.choices?.[0];
    if (!choice) {
      console.error('[OpenAIAdapter] No choices in response:', responseBody);
      throw new Error('No choices in OpenAI response');
    }

    const message = choice.message;

    // Extract content
    const content = message?.content || '';

    // Extract usage metrics
    const usage = responseBody.usage
      ? {
          input_tokens: responseBody.usage.prompt_tokens || 0,
          output_tokens: responseBody.usage.completion_tokens || 0,
        }
      : undefined;

    // Extract tool calls if present
    const toolCalls = message?.tool_calls?.map((call: any) => ({
      id: call.id,
      name: call.function?.name,
      arguments: JSON.parse(call.function?.arguments || '{}'),
    }));

    console.log('[OpenAIAdapter] Parsed response:', {
      contentLength: content.length,
      usage,
      toolCallCount: toolCalls?.length || 0,
    });

    return {
      content,
      usage,
      toolCalls,
    };
  }

  /**
   * Parse streaming chunk from OpenAI API
   * Format: data: {"id":"...","object":"chat.completion.chunk",...}
   */
  parseStreamChunk(chunk: string): string | null {
    // OpenAI sends lines like: data: {...}
    if (!chunk.startsWith('data: ')) {
      return null;
    }

    const jsonStr = chunk.substring(6).trim();

    // Check for end signal
    if (jsonStr === '[DONE]') {
      return null;
    }

    try {
      const data = JSON.parse(jsonStr);
      const delta = data.choices?.[0]?.delta;

      // Return content if present
      if (delta?.content) {
        return delta.content;
      }

      return null;
    } catch (error) {
      console.error('[OpenAIAdapter] Failed to parse stream chunk:', chunk, error);
      return null;
    }
  }
}

console.log('[OpenAIAdapter] OpenAI adapter loaded');
