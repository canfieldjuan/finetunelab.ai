// API route for chat completions with streaming support
import { NextRequest } from 'next/server';
import { streamOpenAIResponse, runOpenAIWithToolCalls } from '@/lib/llm/openai';
import type { ChatMessage, ToolDefinition } from '@/lib/llm/openai';
import { streamAnthropicResponse, runAnthropicWithToolCalls } from '@/lib/llm/anthropic';
import { graphragService } from '@/lib/graphrag';
import { executeTool } from '@/lib/tools/toolManager';
import type { EnhancedPrompt, SearchSource, SearchMetadata } from '@/lib/graphrag';
import { supabase } from '@/lib/supabaseClient';
import { loadLLMConfig } from '@/lib/config/llmConfig';
import { unifiedLLMClient } from '@/lib/llm/unified-client';

// Use Node.js runtime instead of Edge for OpenAI SDK compatibility
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Parse request body with error handling for aborted requests
    let messages, memory, tools, conversationId, modelId;
    try {
      ({ messages, memory, tools, conversationId, modelId } = await req.json());
    } catch (jsonError) {
      console.log('[API] Request aborted or invalid JSON:', jsonError instanceof Error ? jsonError.message : 'Unknown error');
      // Return 499 (Client Closed Request) for aborted requests
      return new Response('Request aborted', { status: 499 });
    }

    // Extract user ID from request (from auth/memory)
    let userId: string | null = null;
    try {
      // Get user ID from memory if available
      userId = memory?.userId || null;
    } catch (error) {
      console.log('[API] Could not get user ID for GraphRAG', error);
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 });
    }
    
    console.log('[API] Request with', messages.length, 'messages,', tools?.length || 0, 'tools');
    
    // Inject memory context as system message if provided
    let enhancedMessages = messages;
    if (memory && (Object.keys(memory.userPreferences || {}).length > 0 || 
                   Object.keys(memory.conversationMemories || {}).length > 0)) {
      const memoryContext = `Memory Context:
User Preferences: ${JSON.stringify(memory.userPreferences, null, 2)}
Conversation Context: ${JSON.stringify(memory.conversationMemories, null, 2)}`;
      
      console.log('[API] Adding memory context to messages');
      enhancedMessages = [
        { role: 'system', content: memoryContext },
        ...messages
      ];
    }

    // Inject conversation history from Supabase (last 20 messages)
    if (conversationId && userId) {
      try {
        const { data: recentMessages } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (recentMessages && recentMessages.length > 0) {
          const historyContext = recentMessages
            .reverse()
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');

          console.log('[API] Adding conversation history:', recentMessages.length, 'messages');
          enhancedMessages = [
            { role: 'system', content: `Recent conversation history:\n${historyContext}` },
            ...enhancedMessages
          ];
        }
      } catch (error) {
        console.error('[API] Error loading conversation history:', error);
        // Continue without history on error
      }
    }

    // GraphRAG enhancement - inject document context for all queries
    // The GraphRAG service returns contextUsed: false if no relevant docs found
    // This allows tools and GraphRAG context to work together for hybrid queries
    let graphRAGMetadata: { sources?: SearchSource[]; metadata?: SearchMetadata } | null = null;
    if (userId) {
      try {
        const userMessage = messages[messages.length - 1]?.content;
        if (userMessage && typeof userMessage === 'string') {
          // Always attempt GraphRAG enhancement
          // Service will return contextUsed: false if no relevant docs found
          const enhanced: EnhancedPrompt = await graphragService.enhancePrompt(
            userId,
            userMessage,
            {
              minConfidence: 0.7, // Filter low-confidence results
            }
          );

          if (enhanced.contextUsed) {
            console.log('[API] GraphRAG context added from', enhanced.sources?.length, 'sources');
            console.log('[API] Original message:', userMessage.slice(0, 100));
            console.log('[API] Enhanced message preview:', enhanced.prompt.slice(0, 200) + '...');
            
            // Replace the last message with enhanced version
            enhancedMessages[enhancedMessages.length - 1] = {
              role: 'user',
              content: enhanced.prompt
            };

            graphRAGMetadata = {
              sources: enhanced.sources,
              metadata: enhanced.metadata
            };
          } else {
            console.log('[API] GraphRAG found no relevant context for query');
          }
        }
      } catch (error) {
        console.error('[API] GraphRAG enhancement error:', error);
        // Continue without GraphRAG on error
      }
    }

    // ========================================================================
    // MODEL SELECTION LOGIC
    // Priority: 1) Request modelId, 2) Conversation model, 3) Default from config
    // ========================================================================
    let selectedModelId: string | null = null;
    let useUnifiedClient = false;

    // Option 1: Use modelId from request (new dynamic model registry)
    if (modelId) {
      console.log('[API] Using model from request:', modelId);
      selectedModelId = modelId;
      useUnifiedClient = true;
    }
    // Option 2: Get model from conversation (if exists)
    else if (conversationId && userId) {
      try {
        const { data: conversation } = await supabase
          .from('conversations')
          .select('llm_model_id')
          .eq('id', conversationId)
          .single();

        if (conversation?.llm_model_id) {
          console.log('[API] Using model from conversation:', conversation.llm_model_id);
          selectedModelId = conversation.llm_model_id;
          useUnifiedClient = true;
        }
      } catch (error) {
        console.log('[API] Could not load conversation model:', error);
      }
    }

    // ========================================================================
    // BACKWARD COMPATIBILITY: Fall back to old config-based provider selection
    // ========================================================================
    const llmConfig = loadLLMConfig();
    const provider = llmConfig.provider || 'openai';
    let model: string;
    let temperature: number;
    let maxTokens: number;
    // Use shared types for function signatures
    let streamLLMResponse: (
      messages: ChatMessage[],
      model: string,
      temperature: number,
      maxTokens: number,
      tools?: ToolDefinition[]
    ) => AsyncGenerator<string, void, unknown>;
    let runLLMWithToolCalls: (
      messages: ChatMessage[],
      model: string,
      temperature: number,
      maxTokens: number,
      tools: ToolDefinition[],
      toolCallHandler?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
    ) => Promise<string | { content: string; usage: { input_tokens: number; output_tokens: number }; toolsCalled?: Array<{name: string; success: boolean; error?: string}> }>;
    if (provider === 'anthropic') {
      model = llmConfig.anthropic?.model || 'claude-3-5-sonnet-20241022';
      streamLLMResponse = streamAnthropicResponse;
      runLLMWithToolCalls = runAnthropicWithToolCalls;
      temperature = llmConfig.anthropic?.temperature ?? 0.7;
      maxTokens = llmConfig.anthropic?.max_tokens ?? 2000;
    } else {
      model = llmConfig.openai?.model || 'gpt-4o-mini';
      streamLLMResponse = streamOpenAIResponse;
      runLLMWithToolCalls = runOpenAIWithToolCalls;
      temperature = llmConfig.openai?.temperature ?? 0.7;
      maxTokens = llmConfig.openai?.max_tokens ?? 2000;
    }

    // Tool-call aware chat completion (provider-aware)
    const toolCallHandler = async (toolName: string, args: Record<string, unknown>) => {
      // Use conversationId if available, else empty string
      const convId = conversationId || '';
      const result = await executeTool(toolName, args, convId);
      if (result.error) return { error: result.error };
      return result.data;
    };

    const encoder = new TextEncoder();

    // Branch: Use non-streaming for tool-enabled requests, streaming for simple chats
    if (tools && tools.length > 0) {
      // NON-STREAMING PATH: Execute tools and get complete response
      console.log('[API] Using non-streaming tool-aware path');

      let llmResponse;

      // Use UnifiedLLMClient if model is selected from registry
      if (useUnifiedClient && selectedModelId) {
        console.log('[API] Using UnifiedLLMClient with model:', selectedModelId);
        llmResponse = await unifiedLLMClient.chat(
          selectedModelId,
          enhancedMessages,
          {
            tools,
            temperature,
            maxTokens,
            toolCallHandler,
          }
        );
      } else {
        // Backward compatibility: Use old provider-specific code
        console.log('[API] Using legacy provider-specific path');
        llmResponse = await runLLMWithToolCalls(
          enhancedMessages,
          model,
          temperature,
          maxTokens,
          tools,
          toolCallHandler
        );
      }

      // METRIC: Extract content, usage, and tool tracking based on response structure
      let finalResponse: string;
      let tokenUsage: { input_tokens: number; output_tokens: number } | null = null;
      let toolsCalled: Array<{name: string; success: boolean; error?: string}> | null = null;
      // Both OpenAI and Anthropic now return LLMResponse { content, usage, toolsCalled }
      if (typeof llmResponse === 'object' && 'content' in llmResponse && 'usage' in llmResponse) {
        finalResponse = llmResponse.content;
        tokenUsage = llmResponse.usage;
        toolsCalled = (llmResponse as { toolsCalled?: Array<{name: string; success: boolean; error?: string}> }).toolsCalled || null;
        console.log('[API] Token usage:', tokenUsage.input_tokens, 'in,', tokenUsage.output_tokens, 'out');
        if (toolsCalled) {
          const successCount = toolsCalled.filter(t => t.success).length;
          console.log('[API] Tools called:', toolsCalled.length, 'total,', successCount, 'succeeded');
        }
      } else {
        // Fallback for legacy string responses
        finalResponse = llmResponse as string;
      }

      // Create stream that "fake streams" the complete response
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send GraphRAG metadata if available
            if (graphRAGMetadata) {
              const citations = graphRAGMetadata.sources
                ? graphragService.formatCitations(graphRAGMetadata.sources)
                : [];
              const metaData = `data: ${JSON.stringify({
                type: 'graphrag_metadata',
                citations,
                contextsUsed: graphRAGMetadata.sources?.length || 0
              })}\n\n`;
              controller.enqueue(encoder.encode(metaData));
            }

            // METRIC: Send token usage metadata if available
            if (tokenUsage) {
              const tokenData = `data: ${JSON.stringify({
                type: 'token_usage',
                input_tokens: tokenUsage.input_tokens,
                output_tokens: tokenUsage.output_tokens
              })}\n\n`;
              controller.enqueue(encoder.encode(tokenData));
            }

            // METRIC: Send tool tracking metadata if available
            if (toolsCalled && toolsCalled.length > 0) {
              const toolData = `data: ${JSON.stringify({
                type: 'tools_metadata',
                tools_called: toolsCalled
              })}\n\n`;
              controller.enqueue(encoder.encode(toolData));
            }

            // Fake stream the complete response character-by-character for smooth UX
            const chunkSize = 3; // Send 3 characters at a time
            for (let i = 0; i < finalResponse.length; i += chunkSize) {
              const chunk = finalResponse.slice(i, i + chunkSize);
              const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
              controller.enqueue(encoder.encode(data));
              // Small delay to simulate streaming
              await new Promise(resolve => setTimeout(resolve, 10));
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('[API] Non-streaming error:', error);
            const errorData = `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // STREAMING PATH: Regular chat without tools
      console.log('[API] Using streaming path (no tools)');
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send GraphRAG metadata if available
            if (graphRAGMetadata) {
              const citations = graphRAGMetadata.sources
                ? graphragService.formatCitations(graphRAGMetadata.sources)
                : [];
              const metaData = `data: ${JSON.stringify({
                type: 'graphrag_metadata',
                citations,
                contextsUsed: graphRAGMetadata.sources?.length || 0
              })}\n\n`;
              controller.enqueue(encoder.encode(metaData));
            }

            // Stream LLM output (plain text chunks)
            // Use UnifiedLLMClient if model is selected from registry
            if (useUnifiedClient && selectedModelId) {
              console.log('[API] Streaming with UnifiedLLMClient, model:', selectedModelId);
              for await (const chunk of unifiedLLMClient.stream(
                selectedModelId,
                enhancedMessages,
                {
                  temperature,
                  maxTokens,
                }
              )) {
                const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            } else {
              // Backward compatibility: Use old provider-specific streaming
              console.log('[API] Streaming with legacy provider-specific path');
              for await (const chunk of streamLLMResponse(
                enhancedMessages,
                model,
                temperature,
                maxTokens
              )) {
                const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            console.error('[API] Streaming error:', error);
            const errorData = `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
