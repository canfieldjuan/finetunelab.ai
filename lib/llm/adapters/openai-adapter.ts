// OpenAI Provider Adapter
// Also supports vLLM, Azure OpenAI, and other OpenAI-compatible APIs
// Date: 2025-10-14

import type { ChatMessage } from '../openai';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import { getVllmRuntimeMetadata } from '@/lib/models/vllm-runtime';
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

    // OpenRouter requires HTTP-Referer and X-Title headers
    if (config.provider === 'openrouter') {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://finetunelab.ai';
      headers['HTTP-Referer'] = baseUrl;
      headers['X-Title'] = 'FineTuneLab';
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
    } else if (config.provider === 'runpod' && config.base_url.includes('api.runpod.ai/v2')) {
      // RunPod Serverless: base_url is the complete endpoint URL (e.g., https://api.runpod.ai/v2/{id}/runsync)
      // Do not append any path - serverless endpoints are NOT OpenAI-compatible vLLM servers
      endpoint = '';
    } else if (!config.base_url.includes('/v1')) {
      endpoint = '/v1/chat/completions';
    }

    // For RunPod Serverless (empty endpoint), use base_url directly without appending
    const url = endpoint === ''
      ? config.base_url.replace(/\/$/, '')
      : this.buildUrl(config.base_url, endpoint);
    const headers = this.buildAuthHeaders(config);

    // Build request body
    // For vLLM/Ollama/RunPod: Use served_model_name (the name vLLM/Ollama was told to serve the model as)
    // For other providers: Use model_id (the standard model identifier)
    const modelName = (config.provider === 'vllm' || config.provider === 'ollama' || config.provider === 'runpod')
      ? (config.served_model_name || config.model_id)
      : config.model_id;

    console.log('[OpenAIAdapter] Preparing request for model:', modelName, 'provider:', config.provider);
    if (modelName !== config.model_id) {
      console.log('[OpenAIAdapter] Using served_model_name instead of model_id');
    }

    // GPT-5 models only support temperature of 1.0
    const isGpt5 = config.model_id.startsWith('gpt-5');
    const temperature = isGpt5 ? 1.0 : (options.temperature ?? config.default_temperature ?? 0.7);

    const body: Record<string, unknown> = {
      model: modelName,
      messages: this.formatMessages(messages),
      temperature,
    };

    if (!isGpt5) {
      const topP = options.topP ?? config.default_top_p;
      if (typeof topP === 'number') {
        body.top_p = topP;
      }
      if (typeof options.frequencyPenalty === 'number') {
        body.frequency_penalty = options.frequencyPenalty;
      }
      if (typeof options.presencePenalty === 'number') {
        body.presence_penalty = options.presencePenalty;
      }
    }

    // GPT-5 models require max_completion_tokens instead of max_tokens
    const maxTokensValue = options.maxTokens ?? config.max_output_tokens ?? 2000;
    if (isGpt5) {
      body.max_completion_tokens = maxTokensValue;
    } else {
      body.max_tokens = maxTokensValue;
    }

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
  async parseResponse(
    response: Response,
    responseBody: unknown,
    request?: AdapterRequest
  ): Promise<AdapterResponse> {
    if (!response.ok) {
      await this.handleResponseError(response);
    }

    const rb = (responseBody as Record<string, unknown>) || {};

    const choices = Array.isArray(rb.choices) ? (rb.choices as unknown[]) : [];
    const choice = choices[0] as Record<string, unknown> | undefined;
    if (!choice) {
      console.error('[OpenAIAdapter] No choices in response:', rb);
      throw new Error('No choices in OpenAI response');
    }

    const message = (choice.message as Record<string, unknown> | undefined) || {};

    // Extract content
    let content = typeof message.content === 'string' ? message.content : '';

    // Extract usage metrics safely
    let usage;
    if (rb.usage && typeof rb.usage === 'object') {
      const u = rb.usage as Record<string, unknown>;
      const inputTokens = typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0;
      const outputTokens = typeof u.completion_tokens === 'number' ? u.completion_tokens : 0;
      // OpenAI reports automatically-cached prompt tokens under
      // usage.prompt_tokens_details.cached_tokens, and prompt_tokens already INCLUDES them.
      // Report input_tokens as the full prompt_tokens (so total_tokens = input + output stays
      // correct downstream) and surface the cached subset separately as cache_read_input_tokens.
      // The cost split (full rate on the non-cached portion, discounted rate on the cached
      // portion) is applied centrally in calculateCost (lib/tracing/pricing-config.ts).
      const promptDetails = u.prompt_tokens_details as Record<string, unknown> | undefined;
      const cachedTokens =
        promptDetails && typeof promptDetails.cached_tokens === 'number'
          ? promptDetails.cached_tokens
          : 0;
      usage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        ...(cachedTokens > 0 ? { cache_read_input_tokens: cachedTokens } : {}),
      };
    }

    // Extract tool calls if present
    let toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] | undefined = undefined;
    const rawToolCalls = message.tool_calls;
    if (Array.isArray(rawToolCalls)) {
      toolCalls = rawToolCalls.map(tc => {
        const call = tc as Record<string, unknown>;
        const func = call.function as Record<string, unknown> | undefined;
        const argsRaw = func?.arguments;
        let parsedArgs: Record<string, unknown> = {};
        if (typeof argsRaw === 'string') {
          try {
            parsedArgs = JSON.parse(argsRaw);
          } catch {
            parsedArgs = {};
          }
        } else if (typeof argsRaw === 'object' && argsRaw !== null) {
          parsedArgs = argsRaw as Record<string, unknown>;
        }

        return {
          id: typeof call.id === 'string' ? call.id : String(call.id ?? ''),
          name: typeof func?.name === 'string' ? func!.name : '',
          arguments: parsedArgs,
        };
      });
    }

    const vllmRuntime = getVllmRuntimeMetadata(request?.config.metadata);
    if (
      (!toolCalls || toolCalls.length === 0) &&
      vllmRuntime.parse_qwen_xml_tool_calls &&
      (request?.options.tools?.length ?? 0) > 0 &&
      content.includes('<tool_call>')
    ) {
      const recoveredToolCalls = this.parseQwenXmlToolCalls(content);
      if (recoveredToolCalls?.length) {
        toolCalls = recoveredToolCalls;
        content = this.stripQwenXmlToolCalls(content);
      }
    }

    console.log('[OpenAIAdapter] Parsed response:', {
      contentLength: content.length,
      usage,
      toolCallCount: toolCalls?.length || 0,
    });

    // Capture request metadata
    const requestMetadata = {
      apiEndpoint: response.url,
      providerRequestId: response.headers.get('x-request-id') || response.headers.get('x-amzn-requestid') || undefined,
      requestHeadersSanitized: undefined, // Headers not available in response object
    };

    return {
      content,
      usage,
      toolCalls,
      requestMetadata,
    };
  }

  private stripQwenXmlToolCalls(content: string): string {
    const withoutClosedBlocks = content.replace(/<tool_call>\s*[\s\S]*?\s*<\/tool_call>/g, '');
    const danglingOpenIndex = withoutClosedBlocks.lastIndexOf('<tool_call>');
    const withoutDanglingBlock = danglingOpenIndex === -1
      ? withoutClosedBlocks
      : withoutClosedBlocks.slice(0, danglingOpenIndex);

    return withoutDanglingBlock
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private parseQwenXmlToolCalls(content: string): Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }> | undefined {
    const calls: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }> = [];
    const blocks: string[] = [];
    const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      blocks.push(match[1]);
    }

    const lastOpenIndex = content.lastIndexOf('<tool_call>');
    const lastCloseIndex = content.lastIndexOf('</tool_call>');
    if (lastOpenIndex !== -1 && lastOpenIndex > lastCloseIndex) {
      const danglingBlock = content.slice(lastOpenIndex + '<tool_call>'.length).trim();
      if (danglingBlock) {
        blocks.push(danglingBlock);
      }
    }

    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block);
        const name = typeof parsed.name === 'string' ? parsed.name : '';
        const parsedArgs = parsed.arguments;
        const args = parsedArgs && typeof parsedArgs === 'object' && !Array.isArray(parsedArgs)
          ? parsedArgs as Record<string, unknown>
          : {};

        if (name) {
          calls.push({
            id: `qwen-xml-tool-${calls.length}`,
            name,
            arguments: args,
          });
        }
      } catch (error) {
        console.warn('[OpenAIAdapter] Failed to parse Qwen XML tool call:', error);
      }
    }

    return calls.length > 0 ? calls : undefined;
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
