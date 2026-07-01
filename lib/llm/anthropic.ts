import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ToolUseBlock, TextBlock, ToolUnion, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages/index';
import type { ChatMessageContent } from './openai';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Anthropic provider implementation
// This file contains the implementation for Anthropic Claude API integration.

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: ChatMessageContent | null;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON schema
  };
}

type ToolSource = ToolDefinition[] | (() => ToolDefinition[] | undefined);

interface AnthropicGenerationOptions {
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

function resolveTools(tools?: ToolSource): ToolDefinition[] | undefined {
  return typeof tools === 'function' ? tools() : tools;
}

function mapToAnthropicTools(tools?: ToolDefinition[]): ToolUnion[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  // Map ToolDefinition to Anthropic ToolUnion (function tool)
  return tools.map((tool) => {
    let inputSchema = tool.function.parameters;
    // Ensure input_schema has a type property (default to object)
    if (
      !inputSchema ||
      typeof inputSchema !== 'object' ||
      Array.isArray(inputSchema) ||
      !('type' in inputSchema)
    ) {
      inputSchema = { type: 'object' };
    }
    // If type exists but is not a string, default to 'object'
    if (typeof (inputSchema as Record<string, unknown>).type !== 'string') {
      (inputSchema as Record<string, unknown>).type = 'object';
    }
    return {
      name: tool.function.name,
      description: tool.function.description,
      input_schema: inputSchema,
      type: 'function',
    };
  }) as unknown as ToolUnion[];
}

function isToolUseBlock(block: unknown): block is ToolUseBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    'type' in block &&
    (block as Record<string, unknown>).type === 'tool_use' &&
    'name' in block &&
    'input' in block
  );
}
function isTextBlock(block: unknown): block is TextBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    'type' in block &&
    (block as Record<string, unknown>).type === 'text' &&
    'text' in block
  );
}

function parseDataUrl(value: string): { mediaType: string; base64: string } | null {
  const match = /^data:([^;,]+);base64,([a-zA-Z0-9+/=]+)$/u.exec(value);
  if (!match) return null;
  return { mediaType: match[1], base64: match[2] };
}

function formatAnthropicContent(content: ChatMessageContent | null): MessageParam['content'] {
  if (!Array.isArray(content)) return content || '';

  return content.flatMap((part): Array<Record<string, unknown>> => {
    if (part.type === 'text') {
      return part.text.trim().length > 0 ? [{ type: 'text', text: part.text }] : [];
    }

    const parsed = parseDataUrl(part.image_url.url);
    if (parsed) {
      return [{
        type: 'image',
        source: {
          type: 'base64',
          media_type: parsed.mediaType,
          data: parsed.base64,
        },
      }];
    }

    return [{
      type: 'image',
      source: {
        type: 'url',
        url: part.image_url.url,
      },
    }];
  }) as unknown as MessageParam['content'];
}

// Streaming response from Anthropic Claude
export async function* streamAnthropicResponse(
  messages: ChatMessage[],
  model: string = 'claude-3-5-sonnet-20241022',
  temperature: number = 0.7,
  maxTokens: number = 2000,
  tools?: ToolDefinition[],
  generationOptions?: AnthropicGenerationOptions
): AsyncGenerator<string, void, unknown> {
  const anthropicMessages: MessageParam[] = messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: formatAnthropicContent(msg.content),
    }));
  const mappedTools = mapToAnthropicTools(tools);
  const stream = anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: anthropicMessages,
    stream: true,
    ...(generationOptions?.topP !== undefined && generationOptions.topP < 1 ? { top_p: generationOptions.topP } : {}),
    ...(mappedTools ? { tools: mappedTools } : {}),
  });
  for await (const part of stream) {
    if (part.type === 'content_block_delta' && 'text' in part.delta) {
      yield part.delta.text;
    }
  }
}

// METRIC: Usage data interface
export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
}

// METRIC: Tool call tracking
export interface ToolCallMetadata {
  name: string;
  success: boolean;
  error?: string;
}

// METRIC: Response with usage data
export interface LLMResponse {
  content: string;
  usage: LLMUsage;
  toolsCalled?: ToolCallMetadata[];
}

// Complete chat with tool-call support
export async function runAnthropicWithToolCalls(
  messages: ChatMessage[],
  model: string = 'claude-3-5-sonnet-20241022',
  temperature: number = 0.7,
  maxTokens: number = 2000,
  tools: ToolSource = [],
  toolCallHandler?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>,
  generationOptions?: AnthropicGenerationOptions
): Promise<LLMResponse> {
  let anthropicMessages: MessageParam[] = messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: formatAnthropicContent(msg.content),
    }));
  // METRIC: Track tool calls
  const toolCallsTracking: ToolCallMetadata[] = [];
  const mapCurrentTools = () => mapToAnthropicTools(resolveTools(tools));

  const mappedTools = mapCurrentTools();
  let response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: anthropicMessages,
    ...(generationOptions?.topP !== undefined && generationOptions.topP < 1 ? { top_p: generationOptions.topP } : {}),
    ...(mappedTools ? { tools: mappedTools } : {}),
  });
  // Check for tool_use blocks in the response
  const toolUseBlock = response.content?.find(isToolUseBlock);
  if (toolUseBlock && toolCallHandler) {
    // METRIC: Track tool call execution
    try {
      // Call the tool handler
      const toolResult = await toolCallHandler(
        toolUseBlock.name,
        toolUseBlock.input as Record<string, unknown>
      );

      // Check if result indicates error
      const hasError = toolResult && typeof toolResult === 'object' && 'error' in toolResult;
      toolCallsTracking.push({
        name: toolUseBlock.name,
        success: !hasError,
        error: hasError ? String((toolResult as Record<string, unknown>).error) : undefined,
      });

      // Append tool result as a user message with tool_result content block
      const toolResultBlock: ToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: toolUseBlock.id,
        content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
      };

      anthropicMessages = [
        ...anthropicMessages,
        {
          role: 'user',
          content: [toolResultBlock],
        },
      ];
      const followUpMappedTools = mapCurrentTools();
      response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: anthropicMessages,
        ...(generationOptions?.topP !== undefined && generationOptions.topP < 1 ? { top_p: generationOptions.topP } : {}),
        ...(followUpMappedTools ? { tools: followUpMappedTools } : {}),
      });
    } catch (error) {
      // METRIC: Track tool call failure
      toolCallsTracking.push({
        name: toolUseBlock.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      // Rethrow to maintain existing error handling
      throw error;
    }
  }
  // Return the final assistant message
  const textBlock = response.content?.find(isTextBlock);

  // METRIC: Extract token usage from Anthropic response
  const usage: LLMUsage = {
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
  };
  console.log('[Anthropic] Token usage:', usage.input_tokens, 'in,', usage.output_tokens, 'out');

  // METRIC: Log tool tracking if any tools were called
  if (toolCallsTracking.length > 0) {
    const successCount = toolCallsTracking.filter(t => t.success).length;
    console.log('[Anthropic] Tools called:', toolCallsTracking.length, 'total,', successCount, 'succeeded');
  }

  return {
    content: textBlock?.text || '',
    usage,
    toolsCalled: toolCallsTracking.length > 0 ? toolCallsTracking : undefined,
  };
}
