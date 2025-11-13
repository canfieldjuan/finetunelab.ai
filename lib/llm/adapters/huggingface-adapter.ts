// HuggingFace Provider Adapter
// Handles HuggingFace Inference API format
// Date: 2025-10-14

import type { ChatMessage, ToolDefinition } from '../openai';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import { BaseProviderAdapter, type AdapterRequest, type AdapterResponse } from './base-adapter';

// ============================================================================
// HuggingFace Adapter
// Handles HuggingFace Inference API (different format from OpenAI)
// ============================================================================

export class HuggingFaceAdapter extends BaseProviderAdapter {
  readonly name = 'HuggingFace';

  /**
   * Build authorization headers for HuggingFace API
   * Uses Bearer token authentication
   */
  buildAuthHeaders(config: ModelConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.api_key) {
      headers['Authorization'] = `Bearer ${config.api_key}`;
    }

    // Add custom headers if provided
    if (config.auth_headers) {
      Object.assign(headers, config.auth_headers);
    }

    return headers;
  }


  /**
   * Format request for HuggingFace Inference API (OpenAI-compatible)
   * Endpoint: /chat/completions
   */
  formatRequest(request: AdapterRequest): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    const { messages, config, options } = request;

    // HuggingFace OpenAI-compatible endpoint
    const url = `${config.base_url}/chat/completions`;
    const headers = this.buildAuthHeaders(config);

    // HuggingFace auto-routes models to available providers
    // Use model_id as-is (supports explicit provider suffix if user specifies)
    const modelId = config.model_id;

    // Build request body in OpenAI format
    const body: Record<string, unknown> = {
      model: modelId,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content || '',
      })),
      temperature: options.temperature ?? config.default_temperature ?? 0.7,
      max_tokens: options.maxTokens ?? config.max_output_tokens ?? 2000,
      stream: options.stream ?? false,
    };

    // EXTENSIVE DEBUG LOGGING
    const sanitizedHeaders = { ...headers };
    if (sanitizedHeaders['Authorization']) {
      sanitizedHeaders['Authorization'] = sanitizedHeaders['Authorization'].substring(0, 20) + '...';
    }

    console.log('[HuggingFaceAdapter] ========================================');
    console.log('[HuggingFaceAdapter] REQUEST DETAILS:');
    console.log('[HuggingFaceAdapter] Full URL:', url);
    console.log('[HuggingFaceAdapter] Base URL from config:', config.base_url);
    console.log('[HuggingFaceAdapter] Model ID:', modelId);
    console.log('[HuggingFaceAdapter] Headers:', sanitizedHeaders);
    console.log('[HuggingFaceAdapter] Request body:', JSON.stringify(body, null, 2));
    console.log('[HuggingFaceAdapter] Message count:', messages.length);
    console.log('[HuggingFaceAdapter] Stream mode:', body.stream);
    console.log('[HuggingFaceAdapter] Temperature:', body.temperature);
    console.log('[HuggingFaceAdapter] Max tokens:', body.max_tokens);
    console.log('[HuggingFaceAdapter] Auto-routing enabled (HF selects provider)');
    console.log('[HuggingFaceAdapter] ========================================');

    return { url, headers, body };
  }

  /**
   * Parse HuggingFace API response into standardized format
   * Now uses OpenAI-compatible response format
   */
  async parseResponse(response: Response, responseBody: unknown): Promise<AdapterResponse> {
    console.log('[HuggingFaceAdapter] ========================================');
    console.log('[HuggingFaceAdapter] RESPONSE DETAILS:');
    console.log('[HuggingFaceAdapter] Status:', response.status, response.statusText);
    console.log('[HuggingFaceAdapter] Response OK:', response.ok);
    console.log('[HuggingFaceAdapter] Response body type:', typeof responseBody);
    console.log('[HuggingFaceAdapter] Response body:', JSON.stringify(responseBody, null, 2));
    console.log('[HuggingFaceAdapter] ========================================');

    if (!response.ok) {
      await this.handleResponseError(response);
    }

    let content = '';
    let usage;

    // Parse OpenAI-compatible response format
    if (responseBody && typeof responseBody === 'object' && 'choices' in responseBody) {
      const body = responseBody as { choices?: Array<{ message?: { content?: string }; text?: string }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };

      if (body.choices && body.choices.length > 0) {
        const choice = body.choices[0];
        content = choice.message?.content || choice.text || '';
      }

      // Extract token usage if provided
      if (body.usage) {
        usage = {
          input_tokens: body.usage.prompt_tokens || 0,
          output_tokens: body.usage.completion_tokens || 0,
        };
      }
    }
    // Fallback: OLD format (generated_text) for backwards compatibility
    else if (Array.isArray(responseBody)) {
      content = (responseBody[0] as { generated_text?: string } | undefined)?.generated_text || '';
    } else if (responseBody && typeof responseBody === 'object' && 'generated_text' in responseBody) {
      content = (responseBody as { generated_text?: string }).generated_text || '';
    } else if (typeof responseBody === 'string') {
      content = responseBody;
    }

    console.log('[HuggingFaceAdapter] Parsed response:', {
      contentLength: content.length,
      usage,
    });

    return {
      content,
      usage,
    };
  }

  /**
   * Parse streaming chunk from HuggingFace API
   * Note: HuggingFace Inference API doesn't support streaming by default
   * This is a placeholder for future support
   */
  parseStreamChunk(): string | null {
    // HuggingFace Inference API typically doesn't stream
    // If streaming is supported, format would depend on specific endpoint
    console.warn('[HuggingFaceAdapter] Streaming not typically supported by HF Inference API');
    return null;
  }
}

console.log('[HuggingFaceAdapter] HuggingFace adapter loaded');
