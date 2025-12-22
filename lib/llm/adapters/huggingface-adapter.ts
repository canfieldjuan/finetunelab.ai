// HuggingFace Provider Adapter
// Handles HuggingFace Inference API format
// Date: 2025-10-14

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
   * Format request for HuggingFace Router API (OpenAI-compatible)
   * Endpoint: /chat/completions
   * 
   * NOTE: As of 2024, HuggingFace deprecated api-inference.huggingface.co
   * All models now use router.huggingface.co/v1
   * Custom fine-tuned models are NOT supported by the Router API
   */
  formatRequest(request: AdapterRequest): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    const { messages, config, options } = request;

    // Validate base_url - reject deprecated endpoints
    const baseUrl = config.base_url;
    if (baseUrl.includes('api-inference.huggingface.co')) {
      console.error('[HuggingFaceAdapter] ❌ DEPRECATED ENDPOINT DETECTED');
      console.error('[HuggingFaceAdapter] api-inference.huggingface.co is no longer supported');
      console.error('[HuggingFaceAdapter] Update model config to use: https://router.huggingface.co/v1');
      throw new Error('HuggingFace Inference API (api-inference.huggingface.co) has been deprecated. Please use the Router API (router.huggingface.co/v1) instead.');
    }

    const headers = this.buildAuthHeaders(config);

    // HuggingFace auto-routes models to available providers
    // Use model_id as-is (supports explicit provider suffix if user specifies)
    const modelId = config.model_id;

    console.log('[HuggingFaceAdapter] Preparing request for model:', modelId);

    // Warn if model ID looks like a display name (contains spaces)
    if (modelId.includes(' ')) {
      console.warn('[HuggingFaceAdapter] ⚠️ WARNING: Model ID contains spaces:', modelId);
      console.warn('[HuggingFaceAdapter] This likely indicates a display name was used instead of the HuggingFace Repo ID.');
      console.warn('[HuggingFaceAdapter] Please update the model configuration to use a valid Repo ID (e.g., "Qwen/Qwen2.5-3B-Instruct").');
    }

    // Detect if model supports chat format or needs completion format
    const useChatFormat = this.isChatModel(modelId, config.is_chat_model);

    // HuggingFace Router only supports /chat/completions endpoint
    // For base models, we wrap the prompt as a user message
    const url = `${baseUrl}/chat/completions`;

    // Build request body
    // For chat models: use messages array (OpenAI format)
    // For base/completion models: wrap prompt in a user message
    let body: Record<string, unknown>;
    if (useChatFormat) {
      body = {
        model: modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content || '',
        })),
        temperature: options.temperature ?? config.default_temperature ?? 0.7,
        max_tokens: options.maxTokens ?? config.max_output_tokens ?? 2000,
        stream: options.stream ?? false,
      };
    } else {
      // Base model - convert messages to single prompt string and wrap as user message
      // HuggingFace Router doesn't have /completions endpoint, so we use chat format
      const prompt = this.messagesToPrompt(messages);
      body = {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? config.default_temperature ?? 0.7,
        max_tokens: options.maxTokens ?? config.max_output_tokens ?? 2000,
        stream: options.stream ?? false,
      };
    }

    // EXTENSIVE DEBUG LOGGING
    const sanitizedHeaders = { ...headers };
    if (sanitizedHeaders['Authorization']) {
      sanitizedHeaders['Authorization'] = sanitizedHeaders['Authorization'].substring(0, 20) + '...';
    }

    console.log('[HuggingFaceAdapter] ========================================');
    console.log('[HuggingFaceAdapter] REQUEST DETAILS:');
    console.log('[HuggingFaceAdapter] Model ID:', modelId);
    console.log('[HuggingFaceAdapter] Base URL:', baseUrl);
    console.log('[HuggingFaceAdapter] Full URL:', url);
    console.log('[HuggingFaceAdapter] Use Chat Format:', useChatFormat);
    console.log('[HuggingFaceAdapter] Headers:', sanitizedHeaders);
    console.log('[HuggingFaceAdapter] Request body:', JSON.stringify(body, null, 2));
    console.log('[HuggingFaceAdapter] Message count:', messages.length);
    console.log('[HuggingFaceAdapter] Stream mode:', body.stream);
    console.log('[HuggingFaceAdapter] Temperature:', body.temperature);
    console.log('[HuggingFaceAdapter] Max tokens:', body.max_tokens);
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
