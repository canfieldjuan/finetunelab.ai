// Ollama Provider Adapter
// Handles Ollama local model API format
// Date: 2025-10-14

import type { ChatMessage } from '../openai';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import { BaseProviderAdapter, type AdapterRequest, type AdapterResponse } from './base-adapter';

// ============================================================================
// Ollama Adapter
// Handles Ollama API (different format, typically local models)
// ============================================================================

export class OllamaAdapter extends BaseProviderAdapter {
  readonly name = 'Ollama';

  /**
   * Build authorization headers for Ollama API
   * Ollama typically doesn't require authentication for local instances
   */
  buildAuthHeaders(config: ModelConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add custom headers if provided (for remote Ollama instances)
    if (config.auth_headers) {
      Object.assign(headers, config.auth_headers);
    }

    return headers;
  }

  /**
   * Format request for Ollama API
   * Endpoint: /api/chat (for chat models) or /api/generate (for completion)
   */
  formatRequest(request: AdapterRequest): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    const { messages, config, options } = request;

    // Use /api/chat for multi-turn conversations
    const url = this.buildUrl(config.base_url, '/api/chat');
    const headers = this.buildAuthHeaders(config);

    // Build request body
    const body: Record<string, unknown> = {
      model: config.model_id,
      messages: this.formatMessages(messages),
      stream: options.stream ?? false,
      options: {
        temperature: options.temperature ?? config.default_temperature ?? 0.7,
        num_predict: options.maxTokens ?? config.max_output_tokens ?? 2000,
      },
    };

    console.log('[OllamaAdapter] Request:', {
      url,
      model: config.model_id,
      messageCount: messages.length,
      stream: options.stream || false,
    });

    return { url, headers, body };
  }

  /**
   * Format messages for Ollama API
   * Ollama uses role/content format similar to OpenAI
   */
  private formatMessages(messages: ChatMessage[]): Array<{
    role: string;
    content: string;
  }> {
    return messages.map(msg => ({
      role: msg.role === 'tool' ? 'assistant' : msg.role, // Map tool to assistant
      content: msg.content || '',
    }));
  }

  /**
   * Parse Ollama API response into standardized format
   */
  async parseResponse(response: Response, responseBody: unknown): Promise<AdapterResponse> {
    if (!response.ok) {
      await this.handleResponseError(response);
    }

    // Narrow responseBody to a record so we can safely access fields
    const rb = (responseBody as Record<string, unknown>) || {};

    // Extract content from Ollama response (ensure string)
    const msgContent = (rb.message as Record<string, unknown> | undefined)?.content;
    const content = typeof msgContent === 'string'
      ? msgContent
      : (typeof rb.response === 'string' ? rb.response : '');

    // Ollama doesn't always provide token counts - check fields safely
    const promptEval = typeof rb.prompt_eval_count === 'number' ? rb.prompt_eval_count : undefined;
    const evalCount = typeof rb.eval_count === 'number' ? rb.eval_count : undefined;

    const usage = (promptEval !== undefined || evalCount !== undefined)
      ? {
          input_tokens: promptEval ?? 0,
          output_tokens: evalCount ?? 0,
        }
      : undefined;

    console.log('[OllamaAdapter] Parsed response:', {
      contentLength: content.length,
      usage,
    });

    return {
      content,
      usage,
    };
  }

  /**
   * Parse streaming chunk from Ollama API
   * Format: {"model":"...","message":{"role":"assistant","content":"..."}}
   */
  parseStreamChunk(chunk: string): string | null {
    try {
      const data = JSON.parse(chunk);

      // Check if this is a message chunk
      if (data.message?.content) {
        return data.message.content;
      }

      // Check if this is a response chunk (for /api/generate)
      if (data.response) {
        return data.response;
      }

      return null;
    } catch (error) {
      console.error('[OllamaAdapter] Failed to parse stream chunk:', chunk, error);
      return null;
    }
  }
}

console.log('[OllamaAdapter] Ollama adapter loaded');
