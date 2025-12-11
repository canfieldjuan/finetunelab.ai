import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ToolUseBlock, TextBlock, ToolUnion, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages/index';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Anthropic provider implementation
// This file contains the implementation for Anthropic Claude API integration.

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON schema
  };
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

// Streaming response from Anthropic Claude
export async function* streamAnthropicResponse(
  messages: ChatMessage[],
  model: string = 'claude-3-5-sonnet-20241022',
  temperature: number = 0.7,
  maxTokens: number = 2000,
  tools?: ToolDefinition[]
): AsyncGenerator<string, void, unknown> {
  const anthropicMessages: MessageParam[] = messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content || '',
    }));
  const mappedTools = mapToAnthropicTools(tools);
  const stream = anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: anthropicMessages,
    stream: true,
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
  tools: ToolDefinition[] = [],
  toolCallHandler?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
): Promise<LLMResponse> {
  let anthropicMessages: MessageParam[] = messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content || '',
    }));
  const mappedTools = mapToAnthropicTools(tools);
  // METRIC: Track tool calls
  const toolCallsTracking: ToolCallMetadata[] = [];

  let response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: anthropicMessages,
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
      response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: anthropicMessages,
        ...(mappedTools ? { tools: mappedTools } : {}),
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
