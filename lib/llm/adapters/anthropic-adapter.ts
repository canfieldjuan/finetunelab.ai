// Anthropic Provider Adapter
// Handles Anthropic Claude API format
// Date: 2025-10-14

import type { ChatMessage, ToolDefinition } from '../openai';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import { BaseProviderAdapter, type AdapterRequest, type AdapterResponse } from './base-adapter';

// ============================================================================
// Anthropic Adapter
// Handles Anthropic Claude API (different format from OpenAI)
// ============================================================================

export class AnthropicAdapter extends BaseProviderAdapter {
  readonly name = 'Anthropic';

  /**
   * Build authorization headers for Anthropic API
   * Uses x-api-key header instead of Bearer token
   */
  buildAuthHeaders(config: ModelConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };

    if (config.api_key) {
      headers['x-api-key'] = config.api_key;
    }

    // Add custom headers if provided
    if (config.auth_headers) {
      Object.assign(headers, config.auth_headers);
    }

    return headers;
  }

  /**
   * Format request for Anthropic API
   * Endpoint: /messages (not /chat/completions like OpenAI)
   */
  formatRequest(request: AdapterRequest): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    const { messages, config, options } = request;

    const url = this.buildUrl(config.base_url, '/messages');
    const headers = this.buildAuthHeaders(config);

    // Filter system messages (Anthropic handles system differently)
    const systemMessage = messages.find(m => m.role === 'system')?.content || undefined;
    const userAssistantMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');

    // Build request body
    const body: Record<string, unknown> = {
      model: config.model_id,
      messages: this.formatMessages(userAssistantMessages),
      max_tokens: options.maxTokens ?? config.max_output_tokens ?? 2000,
      temperature: options.temperature ?? config.default_temperature ?? 0.7,
    };

    // Add system message with cache control (enables prompt caching)
    if (systemMessage) {
      body.system = [
        {
          type: 'text',
          text: systemMessage,
          cache_control: { type: 'ephemeral' },
        },
      ];
    }

    // Add tools if provided and supported
    if (options.tools && options.tools.length > 0 && config.supports_functions) {
      const formattedTools = this.formatTools(options.tools);
      // Add cache control to the last tool for prompt caching
      if (formattedTools.length > 0) {
        formattedTools[formattedTools.length - 1].cache_control = { type: 'ephemeral' };
      }
      body.tools = formattedTools;
    }

    // Add streaming flag if requested
    if (options.stream && config.supports_streaming) {
      body.stream = true;
    }

    // Add extended thinking if requested (Claude feature)
    if (options.enableThinking) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: 10000, // Allow up to 10K tokens for thinking
      };
    }

    console.log('[AnthropicAdapter] Request:', {
      url,
      model: config.model_id,
      messageCount: userAssistantMessages.length,
      toolCount: options.tools?.length || 0,
      stream: options.stream || false,
      hasSystem: !!systemMessage,
    });

    return { url, headers, body };
  }

  /**
   * Format messages for Anthropic API
   * Converts our standard format to Anthropic format
   * Filters out messages with empty/null content (Anthropic requirement)
   */
  private formatMessages(messages: ChatMessage[]): Array<{
    role: 'user' | 'assistant';
    content: string | unknown[];
  }> {
    return messages
      .filter(msg => {
        const hasContent = msg.content !== null &&
                          msg.content !== undefined &&
                          msg.content.trim().length > 0;
        if (!hasContent) {
          console.warn('[AnthropicAdapter] Skipping message with empty content:', {
            role: msg.role,
            content: msg.content,
          });
        }
        return hasContent;
      })
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content as string,
      }));
  }

  /**
   * Format tools for Anthropic API
   * Anthropic uses input_schema instead of parameters
   */
  private formatTools(tools: ToolDefinition[]): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
    cache_control?: { type: string };
  }> {
    return tools.map(tool => {
      let inputSchema = tool.function.parameters as unknown;

      // Ensure input_schema has a type property (default to object)
      if (
        !inputSchema ||
        typeof inputSchema !== 'object' ||
        Array.isArray(inputSchema) ||
        !('type' in (inputSchema as Record<string, unknown>))
      ) {
        inputSchema = { type: 'object' } as Record<string, unknown>;
      }

      // If type exists but is not a string, default to 'object'
      const schemaObj = inputSchema as Record<string, unknown>;
      if (typeof schemaObj.type !== 'string') {
        schemaObj.type = 'object';
      }

      return {
        name: tool.function.name,
        description: tool.function.description,
        input_schema: schemaObj,
      };
    });
  }

  /**
   * Parse Anthropic API response into standardized format
   */
  async parseResponse(response: Response, responseBody: unknown): Promise<AdapterResponse> {
    if (!response.ok) {
      await this.handleResponseError(response);
    }

    const body = responseBody as { content?: unknown[]; usage?: { input_tokens?: number; output_tokens?: number } };

    // Extract text content from content blocks
    const textBlock = Array.isArray(body.content)
      ? body.content.find((block: unknown) =>
          typeof block === 'object' && block !== null && (block as { type?: string }).type === 'text'
        ) as { type?: string; text?: string } | undefined
      : undefined;
    let rawContent = textBlock?.text || '';

    // Extract thinking/reasoning from API-level extended thinking mode
    const thinkingBlock = Array.isArray(body.content)
      ? body.content.find((block: unknown) =>
          typeof block === 'object' && block !== null && (block as { type?: string }).type === 'thinking'
        ) as { type?: string; thinking?: string } | undefined
      : undefined;
    let reasoning = thinkingBlock?.thinking || undefined;

    // ALSO extract thinking tags from the text content itself (for models that include <thinking> tags)
    const thinkingTagRegex = /<thinking>([\s\S]*?)<\/thinking>/gi;
    const thinkingMatches = rawContent.match(thinkingTagRegex);

    if (thinkingMatches && thinkingMatches.length > 0) {
      // Extract thinking content from tags
      const thinkingContent = thinkingMatches
        .map(match => match.replace(/<\/?thinking>/gi, '').trim())
        .join('\n\n');

      // Add to reasoning (append if API-level thinking exists)
      if (reasoning) {
        reasoning = reasoning + '\n\n--- Model Thinking ---\n\n' + thinkingContent;
      } else {
        reasoning = thinkingContent;
      }

      // Remove thinking tags from main content
      rawContent = rawContent.replace(thinkingTagRegex, '').trim();

      console.log('[AnthropicAdapter] Extracted thinking from tags:', thinkingContent.length, 'chars');
    }

    const content = rawContent;

    // Extract usage metrics including cache tokens
    const usage = body.usage
      ? {
          input_tokens: body.usage.input_tokens || 0,
          output_tokens: body.usage.output_tokens || 0,
          cache_creation_input_tokens: (body.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens,
          cache_read_input_tokens: (body.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens,
        }
      : undefined;

    // Extract tool calls if present
    const toolUseBlock = Array.isArray(body.content)
      ? body.content.find((block: unknown) =>
          typeof block === 'object' && block !== null && (block as { type?: string }).type === 'tool_use'
        ) as { id?: string; name?: string; input?: Record<string, unknown> } | undefined
      : undefined;

    const toolCalls = toolUseBlock
      ? [
          {
            id: toolUseBlock.id ?? '',
            name: toolUseBlock.name ?? 'tool_use',
            arguments: toolUseBlock.input || {},
          },
        ]
      : undefined;

    console.log('[AnthropicAdapter] Parsed response:', {
      contentLength: content.length,
      reasoningLength: reasoning?.length || 0,
      usage,
      toolCallCount: toolCalls?.length || 0,
    });

    return {
      content,
      reasoning,
      usage,
      toolCalls,
    };
  }

  /**
   * Parse streaming chunk from Anthropic API
   * Format: event: content_block_delta\ndata: {"delta":{"text":"..."}}
   */
  parseStreamChunk(chunk: string): string | null {
    // Anthropic sends SSE events with event type and data
    // We're looking for: event: content_block_delta
    // followed by: data: {"type":"content_block_delta","delta":{"text":"..."}}

    if (!chunk.includes('content_block_delta')) {
      return null;
    }

    // Extract data line
    const dataMatch = chunk.match(/data: (.+)/);
    if (!dataMatch) {
      return null;
    }

    try {
      const data = JSON.parse(dataMatch[1]);

      // Check if this is a text delta
      if (data.type === 'content_block_delta' && data.delta?.text) {
        return data.delta.text;
      }

      return null;
    } catch (error) {
      console.error('[AnthropicAdapter] Failed to parse stream chunk:', chunk, error);
      return null;
    }
  }
}

console.log('[AnthropicAdapter] Anthropic adapter loaded');
