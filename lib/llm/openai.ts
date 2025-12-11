// OpenAI provider implementation
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// Lazy initialization - only create client when needed (server-side)
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// Configuration from environment variables
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');
const DEFAULT_MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10);

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// METRIC: Usage data interface (matches Anthropic interface)
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

// METRIC: Response with usage data (matches Anthropic interface)
export interface LLMResponse {
  content: string;
  reasoning?: string; // Extended thinking/intermediate steps from Claude models
  usage: LLMUsage;
  toolsCalled?: ToolCallMetadata[];
}

export async function* streamOpenAIResponse(
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL,
  temperature: number = DEFAULT_TEMPERATURE,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  tools?: ToolDefinition[]
): AsyncGenerator<string, void, unknown> {
  try {
    const client = getOpenAIClient();
    const stream = await client.chat.completions.create({
      model,
      messages: messages as ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
      stream: true,
      ...(tools && tools.length > 0 ? { tools: tools as ChatCompletionTool[] } : {}),
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      // Yield text content
      if (delta?.content) {
        yield delta.content;
      }
      
      // Note: Tool calls in streaming are accumulated across chunks
      // For now, we only stream text content
      // Tool execution will be handled in a non-streaming flow
    }
  } catch (error) {
    console.error('OpenAI streaming error:', error);
    throw error;
  }
}

export async function getOpenAIResponse(
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL,
  temperature: number = DEFAULT_TEMPERATURE,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  tools?: ToolDefinition[]
): Promise<string> {
  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model,
      messages: messages as ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
      ...(tools && tools.length > 0 ? { tools: tools as ChatCompletionTool[] } : {}),
    });

    return completion.choices[0]?.message?.content || 'No response generated';
  } catch (error) {
    console.error('OpenAI error:', error);
    throw error;
  }
}

// New: Tool-call aware OpenAI chat completion
export async function runOpenAIWithToolCalls(
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL,
  temperature: number = DEFAULT_TEMPERATURE,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  tools?: ToolDefinition[],
  toolCallHandler?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
): Promise<LLMResponse> {
  let currentMessages = messages;
  // METRIC: Accumulate token usage across all tool call rounds
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  // METRIC: Track tool calls
  const toolCallsTracking: ToolCallMetadata[] = [];

  const client = getOpenAIClient();

  for (let i = 0; i < 3; i++) { // up to 3 tool call rounds
    console.log(`[OpenAI] [DEBUG] Round ${i + 1}: Calling OpenAI with ${currentMessages.length} messages`);
    if (tools && tools.length > 0) {
      // Avoid `any` usage - infer names safely
      console.log('[OpenAI] [DEBUG] Tools available:', tools.map(t => t.function?.name).join(', '));
    }

    const completion = await client.chat.completions.create({
      model,
      messages: currentMessages as ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
      ...(tools && tools.length > 0 ? { tools: tools as ChatCompletionTool[] } : {}),
    });

    // METRIC: Accumulate usage from this round
    if (completion.usage) {
      totalInputTokens += completion.usage.prompt_tokens || 0;
      totalOutputTokens += completion.usage.completion_tokens || 0;
    }

    const msg = completion.choices[0]?.message;
    console.log('[OpenAI ToolCall Debug] Full OpenAI response:', JSON.stringify(completion, null, 2));

    // If tool calls present, execute them
    if (msg?.tool_calls && toolCallHandler) {
      console.log(`[OpenAI] [DEBUG] Tool calls detected: ${msg.tool_calls.length}`);
  const toolResults = [];

      for (const call of msg.tool_calls) {
        if (call.type === 'function' && call.function) {
          const toolName = call.function.name;
          // Parse arguments safely - OpenAI may return a JSON string or an object
          let args: Record<string, unknown> = {};
          try {
            if (typeof call.function.arguments === 'string') {
              args = JSON.parse(call.function.arguments);
            } else if (typeof call.function.arguments === 'object' && call.function.arguments !== null) {
              args = call.function.arguments as Record<string, unknown>;
            }
          } catch (e) {
            console.warn('[OpenAI] Failed to parse tool arguments:', e);
            args = {};
          }

          console.log(`[OpenAI] [DEBUG] Tool selected: ${toolName} with args:`, args);

          // Track of web_search is done via toolCallsTracking below (no local flag needed)

          // METRIC: Track tool call execution
          try {
            const result = await toolCallHandler(toolName, args);

            // Check if result indicates error (safe narrowing)
            let callError: string | undefined;
            if (result && typeof result === 'object' && 'error' in result) {
              const r = result as Record<string, unknown>;
              callError = r.error ? String(r.error) : undefined;
            } else {
              callError = undefined;
            }

            toolCallsTracking.push({
              name: toolName,
              success: !callError,
              error: callError,
            });

            toolResults.push({
              role: 'tool' as const,
              content: typeof result === 'string' ? result : JSON.stringify(result),
              tool_call_id: call.id,
            });
          } catch (error) {
            // METRIC: Track tool call failure
            toolCallsTracking.push({
              name: toolName,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });

            // Still push result for LLM to handle error
            toolResults.push({
              role: 'tool' as const,
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
              tool_call_id: call.id,
            });
          }
        }
      }

      // Continue conversation with tool results
      currentMessages = [
        ...currentMessages,
        { ...msg, content: msg.content || null } as ChatMessage,
        ...toolResults as ChatMessage[],
      ];
      continue;
    }

    // METRIC: If no tool calls, return content with usage
    const usage: LLMUsage = {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    };
    console.log('[OpenAI] Token usage:', usage.input_tokens, 'in,', usage.output_tokens, 'out');

    // METRIC: Log tool tracking if any tools were called
    if (toolCallsTracking.length > 0) {
      const successCount = toolCallsTracking.filter(t => t.success).length;
      console.log('[OpenAI] Tools called:', toolCallsTracking.length, 'total,', successCount, 'succeeded');
    }

    // Check if web_search was called but model returned no content
    let finalContent = msg?.content || '';
    if (!finalContent && toolCallsTracking.some(t => t.name === 'web_search')) {
      finalContent = '🔍 Deep research in progress. This may take 3-10 minutes depending on complexity. I will provide comprehensive results when the research is complete.';
      console.log('[OpenAI] Web search called but no assistant content - using fallback message');
    }

    return {
      content: finalContent,
      usage,
      toolsCalled: toolCallsTracking.length > 0 ? toolCallsTracking : undefined,
    };
  }

  // METRIC: Return after max rounds with accumulated usage
  const usage: LLMUsage = {
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
  };
  console.log('[OpenAI] Token usage:', usage.input_tokens, 'in,', usage.output_tokens, 'out');

  // METRIC: Log tool tracking if any tools were called
  if (toolCallsTracking.length > 0) {
    const successCount = toolCallsTracking.filter(t => t.success).length;
    console.log('[OpenAI] Tools called:', toolCallsTracking.length, 'total,', successCount, 'succeeded');
  }

  // Check if web_search was called before hitting max rounds
  let maxRoundsContent = '';
  if (toolCallsTracking.some(t => t.name === 'web_search')) {
    maxRoundsContent = '🔍 Deep research in progress. This may take 3-10 minutes depending on complexity. I will provide comprehensive results when the research is complete.';
    console.log('[OpenAI] Max rounds hit after web_search - using fallback message');
  }

  return {
    content: maxRoundsContent,
    usage,
    toolsCalled: toolCallsTracking.length > 0 ? toolCallsTracking : undefined,
  };
}
