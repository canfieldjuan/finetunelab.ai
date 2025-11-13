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
import { modelManager } from '@/lib/models/model-manager.service';
import { estimateGraphRAGTokens } from '@/lib/context';
import { gatherConversationContext } from '@/lib/context/context-provider.service';
import type { ContextInjectionResult } from '@/lib/context/types';
import { validateApiKey } from '@/lib/auth/api-key-validator';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { categorizeError } from '@/lib/batch-testing/error-categorizer';
import { saveBasicJudgment } from '@/lib/batch-testing/evaluation-integration';
import crypto from 'crypto';

// Use Node.js runtime instead of Edge for OpenAI SDK compatibility
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Declare variables outside try block for error handling access
  let isWidgetMode = false;
  let isBatchTestMode = false;
  let widgetConversationId: string | null = null;
  let supabaseAdmin: SupabaseClient | null = null;
  let selectedModelId: string | null = null;
  let provider: string | null = null;
  // Track last web_search tool results for progressive doc summaries (SSE)
  let lastWebSearchDocs: Array<{
    title?: string;
    url?: string;
    summary?: string;
    snippet?: string;
    source?: string;
    publishedAt?: string;
  }> | null = null;
  // Track deep research job id explicitly (do not rely on model text echo)
  let lastDeepResearchJobId: string | null = null;
  const exportSigningSecret = process.env.EXPORT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  function base64urlEncode(buf: Buffer): string {
    return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  function signExportPayload(payload: Record<string, unknown>): string | null {
    try {
      const json = JSON.stringify(payload);
      const payloadB64 = base64urlEncode(Buffer.from(json, 'utf-8'));
      const sig = crypto.createHmac('sha256', exportSigningSecret).update(payloadB64).digest('hex');
      return `${payloadB64}.${sig}`;
      return `${payloadB64}.${sig}`;
    } catch {
      return null;
    }
  }

  try {
    // Parse request body with error handling for aborted requests
    let messages, memory, tools, conversationId, modelId, widgetSessionId, forceNonStreaming, runId, benchmarkId;
    try {
      ({ messages, memory, tools, conversationId, modelId, widgetSessionId, forceNonStreaming, runId, benchmarkId } = await req.json());
    } catch (jsonError) {
      console.log('[API] Request aborted or invalid JSON:', jsonError instanceof Error ? jsonError.message : 'Unknown error');
      // Return 499 (Client Closed Request) for aborted requests
      return new Response('Request aborted', { status: 499 });
    }

    // ========================================================================
    // WIDGET MODE DETECTION & API KEY VALIDATION
    // ========================================================================
    const apiKey = req.headers.get('X-API-Key');
    const authHeader = req.headers.get('Authorization');
    
    // Batch test mode: Has widgetSessionId + Authorization header but NO X-API-Key
    isBatchTestMode = !!(widgetSessionId && authHeader && !apiKey);
    
    // Widget mode: Has X-API-Key + widgetSessionId (takes precedence over batch test)
    isWidgetMode = !!(apiKey && widgetSessionId);
    widgetConversationId = null;

    console.log('[API] Widget mode:', isWidgetMode, 'Batch test mode:', isBatchTestMode, 'API key present:', !!apiKey, 'Session ID:', widgetSessionId);

    // Extract user ID from request (from auth/memory or widget API key)
    let userId: string | null = null;

    if (isWidgetMode && apiKey) {
      // Widget mode: Validate API key and extract user_id
      console.log('[API] Widget mode: Validating API key');
      const validationResult = await validateApiKey(apiKey);

      if (!validationResult.isValid || !validationResult.userId) {
        console.error('[API] Widget API key validation failed:', validationResult.errorMessage);
        return new Response(JSON.stringify({ error: validationResult.errorMessage || 'Invalid API key' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      userId = validationResult.userId;
      console.log('[API] Widget mode: API key validated, user_id:', userId);
    } else if (isBatchTestMode && authHeader) {
      // Batch test mode: Validate session token and extract user_id
      console.log('[API] Batch test mode: Validating session token');
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user }, error: sessionError } = await supabase.auth.getUser();
      
      if (sessionError || !user) {
        console.error('[API] Batch test mode: Session validation failed:', sessionError?.message);
        return new Response(JSON.stringify({ error: 'Invalid session token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      userId = user.id;
      console.log('[API] Batch test mode: Session validated, user_id:', userId);
      
      // Use service role for RLS bypass (same as widget mode)
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    } else {
      // Normal mode: Get user ID from memory
      try {
        userId = memory?.userId || null;
      } catch (error) {
        console.log('[API] Could not get user ID for GraphRAG', error);
      }
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 });
    }

    console.log('[API] Request with', messages.length, 'messages,', tools?.length || 0, 'tools');
    if (tools && tools.length > 0) {
      console.log('[API] [DEBUG] Tools available to LLM:', tools.map((t: ToolDefinition) => t.function.name).join(', '));
    }

    // ========================================================================
    // WIDGET MODE: Create service role client for RLS bypass
    // Note: Batch test mode already created service role client above
    // ========================================================================
    if (isWidgetMode) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    }

    // ========================================================================
    // WIDGET MODE OR BATCH TEST MODE: Create conversation and store messages
    // ========================================================================
    if ((isWidgetMode || isBatchTestMode) && userId && widgetSessionId) {
      console.log('[API]', isWidgetMode ? 'Widget mode' : 'Batch test mode', ': Getting or creating conversation for session:', widgetSessionId);
      try {
        // Check if conversation already exists for this widget session
        let { data: conversation, error: convError } = await supabaseAdmin!
          .from('conversations')
          .select()
          .eq('widget_session_id', widgetSessionId)
          .maybeSingle();

        // If no conversation exists, create one
        if (!conversation) {
          console.log('[API] Widget mode: Creating new conversation');
          // Generate title from first user message
          const userMessage = messages[messages.length - 1]?.content;
          const title = typeof userMessage === 'string'
            ? userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '')
            : 'Widget Chat';

          const result = await supabaseAdmin!
            .from('conversations')
            .insert({
              user_id: userId,
              title: title,
              widget_session_id: widgetSessionId,
              is_widget_session: true,
              llm_model_id: modelId || null,
              run_id: runId || null,
            })
            .select()
            .single();

          conversation = result.data;
          convError = result.error;

          // Handle race condition: If unique constraint violated, fetch the existing conversation
          if (convError && convError.code === '23505') {
            console.log('[API] Widget mode: Conversation already exists (race condition), fetching it');
            const fetchResult = await supabaseAdmin!
              .from('conversations')
              .select()
              .eq('widget_session_id', widgetSessionId)
              .single();

            conversation = fetchResult.data;
            convError = fetchResult.error;
          }
        } else {
          console.log('[API] Widget mode: Using existing conversation:', conversation.id);
        }

        if (convError || !conversation) {
          console.error('[API] Widget mode: Failed to create conversation:', convError);
          return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        widgetConversationId = conversation.id;
        conversationId = conversation.id; // Set conversationId for conversation history loading
        console.log('[API] Widget mode: Conversation created:', widgetConversationId);
      } catch (error) {
        console.error('[API] Widget mode: Error creating conversation:', error);
        return new Response(JSON.stringify({ error: 'Conversation creation error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Add base system prompt for casual, direct responses
    let enhancedMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a friendly, helpful assistant for Fine Tune Lab.

CRITICAL: When discussing Fine Tune Lab, ALWAYS use first-person pronouns:
- Say "we offer" NOT "they offer" or "Fine Tune Lab offers"
- Say "our platform" NOT "the platform" or "their platform"
- Say "we provide" NOT "they provide"
You ARE part of the Fine Tune Lab team, not an external observer.

FORMATTING: Do NOT use bold formatting (**text**) in numbered lists. Use plain text instead.
Example: "1. Supervised Learning: explanation" NOT "1. **Supervised Learning**: explanation"

TOOL USAGE GUIDELINES:

When using the web_search tool:
- For research/analysis queries (explain, analyze, compare, evaluate): Enable deepSearch automatically
- Synthesize information from ALL sources - don't just list snippets
- With deepSearch: Use the fullContent field to extract specific details, quotes, and data
- Provide detailed, comprehensive analysis with examples and context
- Use clear markdown structure (headers, sections, bullet points with explanations)
- Minimum 3-4 well-developed paragraphs for research queries
- Cite sources using [Title](url) format

When using evaluation_metrics or dataset_manager tools:
- Present data with clear narrative explanations
- Include statistical context (trends, comparisons, significance)
- Highlight actionable insights and recommendations
- Use markdown tables for data visualization
- Structure analytical responses as:
  1. Executive Summary (2-3 sentences)
  2. Detailed Analysis (with data/evidence)
  3. Key Insights/Takeaways
  4. Actionable Recommendations

Be conversational and helpful. Provide detailed explanations when users ask about features or capabilities, especially for users who may be new to LLM training. Include relevant follow-up questions or suggestions to help guide them. Skip unnecessary formalities but be thorough in your explanations.`
      },
      ...messages
    ];

    // Inject memory context as system message if provided
    if (memory && (Object.keys(memory.userPreferences || {}).length > 0 || 
                   Object.keys(memory.conversationMemories || {}).length > 0)) {
      const memoryContext = `Memory Context:
User Preferences: ${JSON.stringify(memory.userPreferences, null, 2)}
Conversation Context: ${JSON.stringify(memory.conversationMemories, null, 2)}`;
      
      console.log('[API] Adding memory context to messages');
      // Insert memory context after base system prompt
      enhancedMessages = [
        enhancedMessages[0], // Keep the base casual system prompt
        { role: 'system', content: memoryContext },
        ...enhancedMessages.slice(1) // Add the rest of the messages
      ];
    }

    // Inject conversation history from Supabase (last 10 messages, with character limit)
    if (conversationId && userId) {
      try {
        const { data: recentMessages } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(10); // Reduced from 20 to 10 for memory efficiency

        if (recentMessages && recentMessages.length > 0) {
          // Limit each message to 500 characters to prevent memory explosion
          const MAX_MESSAGE_LENGTH = 500;
          const MAX_TOTAL_LENGTH = 3000; // Total history capped at 3KB
          
          let historyContext = '';
          let totalLength = 0;
          
          for (const msg of recentMessages.reverse()) {
            const content = msg.content?.slice(0, MAX_MESSAGE_LENGTH) || '';
            const truncated = msg.content?.length > MAX_MESSAGE_LENGTH ? '...' : '';
            const entry = `${msg.role}: ${content}${truncated}\n`;
            
            if (totalLength + entry.length > MAX_TOTAL_LENGTH) {
              historyContext += '...[earlier messages omitted for memory efficiency]';
              break;
            }
            
            historyContext += entry;
            totalLength += entry.length;
          }

          console.log('[API] Adding conversation history:', recentMessages.length, 'messages,', totalLength, 'chars');
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

    // Context Provider - inject user context before GraphRAG
    let contextInjection: ContextInjectionResult | null = null;
    if (userId) {
      try {
        const userMessage = messages[messages.length - 1]?.content;
        if (userMessage && typeof userMessage === 'string') {
          console.log('[API] Gathering conversation context...');

          contextInjection = await gatherConversationContext(
            userId,
            userMessage,
            {
              maxTokens: 500,
            }
          );

          console.log('[API] Context types:', contextInjection.contextTypes);
          console.log('[API] Estimated tokens:', contextInjection.estimatedTokens);

          // Inject as system message at start
          enhancedMessages = [
            { role: 'system', content: contextInjection.systemMessage },
            ...enhancedMessages
          ];
        }
      } catch (error) {
        console.error('[API] Error gathering context:', error);
        // Continue without context on error
      }
    }

    // GraphRAG enhancement - inject document context for all queries
    // The GraphRAG service returns contextUsed: false if no relevant docs found
    // This allows tools and GraphRAG context to work together for hybrid queries
    let graphRAGMetadata: { sources?: SearchSource[]; metadata?: SearchMetadata; estimatedTokens?: number } | null = null;
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
            const estimatedTokens = estimateGraphRAGTokens(enhanced.sources?.length || 0);
            console.log('[API] GraphRAG context added from', enhanced.sources?.length, 'sources');
            console.log('[API] Estimated GraphRAG tokens:', estimatedTokens);
            console.log('[API] Original message:', userMessage.slice(0, 100));
            console.log('[API] Enhanced message preview:', enhanced.prompt.slice(0, 200) + '...');

            // Replace the last message with enhanced version
            enhancedMessages[enhancedMessages.length - 1] = {
              role: 'user',
              content: enhanced.prompt
            };

            graphRAGMetadata = {
              sources: enhanced.sources,
              metadata: enhanced.metadata,
              estimatedTokens
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
    selectedModelId = null;
    let useUnifiedClient = false;

    console.log('[API] [MODEL-SELECT] modelId from request:', modelId, 'type:', typeof modelId);
    console.log('[API] [MODEL-SELECT] conversationId:', conversationId, 'userId:', userId);

    // Option 1: Use modelId from request (new dynamic model registry)
    if (modelId) {
      console.log('[API] ✓ Using model from request:', modelId);
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
    provider = llmConfig.provider || 'openai';
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
      const result = await executeTool(toolName, args, convId, undefined, userId || undefined);
      // Capture web_search results for SSE previews (standard search path only)
      try {
        if (toolName === 'web_search' && result && typeof result === 'object' && 'data' in result) {
          const data: any = (result as any).data;
          if (data && typeof data === 'object' && Array.isArray((data as any).results)) {
            lastWebSearchDocs = (data as any).results;
          }
          // Capture deep research job id directly when present
          if (data && typeof data === 'object' && data.status === 'deep_research_started' && data.jobId) {
            lastDeepResearchJobId = String(data.jobId);
            console.log('[API] Captured deep research job id from tool result:', lastDeepResearchJobId);
          }
        }
      } catch (capErr) {
        console.log('[API] Could not capture web_search results for SSE:', capErr);
      }
      if (result.error) return { error: result.error };
      return result.data;
    };

    const encoder = new TextEncoder();
    let actualModelConfig: any = null; // Store model config to get actual provider

    // Branch: Use non-streaming for tool-enabled requests, streaming for simple chats
    if ((tools && tools.length > 0) || forceNonStreaming) {
      // NON-STREAMING PATH: Execute tools and get complete response
      console.log('[API] Using non-streaming tool-aware path');
      console.log('[API] Route decision: tools=', !!tools, 'forceNonStreaming=', !!forceNonStreaming);

      // METRIC: Start latency tracking
      const startTime = Date.now();
      console.log('[API] [LATENCY] Request started at:', startTime);

      let llmResponse;

      // Use UnifiedLLMClient if model is selected from registry
      console.log('[API] [MODEL-SELECT] useUnifiedClient:', useUnifiedClient, 'selectedModelId:', selectedModelId);
      if (useUnifiedClient && selectedModelId) {
        console.log('[API] ✓✓✓ Using UnifiedLLMClient with model:', selectedModelId);

        // Load model config to get actual provider for metadata
        actualModelConfig = await modelManager.getModelConfig(selectedModelId, userId || undefined);
        if (actualModelConfig) {
          console.log('[API] Model config loaded - actual provider:', actualModelConfig.provider);
        }

        try {
          llmResponse = await unifiedLLMClient.chat(
            selectedModelId,
            enhancedMessages,
            {
              tools,
              temperature,
              maxTokens,
              userId: userId || undefined,
              toolCallHandler,
            }
          );
        } catch (modelError) {
          // Handle model-not-found errors gracefully
          const errorMsg = modelError instanceof Error ? modelError.message : String(modelError);
          if (errorMsg.includes('Model not found') || errorMsg.includes('Cannot coerce the result')) {
            console.error('[API] Model not found:', selectedModelId);
            return new Response(
              JSON.stringify({
                error: `Model not found. Please select a different model from the dropdown.`,
                details: `The selected model (ID: ${selectedModelId.slice(0, 8)}...) no longer exists or you don't have access to it.`
              }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          }
          // Re-throw other errors
          throw modelError;
        }
      } else {
        // Backward compatibility: Use old provider-specific code
        console.log('[API] ❌ Using legacy provider-specific path - model:', model);
        console.log('[API] ❌ Why legacy? useUnifiedClient:', useUnifiedClient, 'selectedModelId:', selectedModelId);
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
      let reasoning: string | undefined;
      let tokenUsage: { input_tokens: number; output_tokens: number } | null = null;
      let toolsCalled: Array<{name: string; success: boolean; error?: string}> | null = null;
      // Both OpenAI and Anthropic now return LLMResponse { content, usage, toolsCalled, reasoning }
      if (typeof llmResponse === 'object' && 'content' in llmResponse && 'usage' in llmResponse) {
        finalResponse = llmResponse.content;
        reasoning = (llmResponse as { reasoning?: string }).reasoning;
        tokenUsage = llmResponse.usage;
        toolsCalled = (llmResponse as { toolsCalled?: Array<{name: string; success: boolean; error?: string}> }).toolsCalled || null;
        console.log('[API] Token usage:', tokenUsage.input_tokens, 'in,', tokenUsage.output_tokens, 'out');
        if (reasoning) {
          console.log('[API] Reasoning/thinking:', reasoning.length, 'chars');
        }
        if (toolsCalled) {
          const successCount = toolsCalled.filter(t => t.success).length;
          console.log('[API] Tools called:', toolsCalled.length, 'total,', successCount, 'succeeded');
        }
      } else {
        // Fallback for legacy string responses
        finalResponse = llmResponse as string;
      }

      // Ensure we never stream an empty assistant message
      // If tools were involved (especially web_search for deep research), provide a clear placeholder
      if (!finalResponse || finalResponse.trim().length === 0) {
        const webSearchUsed = Array.isArray(toolsCalled)
          ? toolsCalled.some(t => t?.name === 'web_search')
          : (Array.isArray(tools) && tools.some((t: any) => t?.function?.name === 'web_search'));
        finalResponse = webSearchUsed
          ? 'Deep research started. I will update you when it\'s ready.'
          : 'No content was generated by the model.';
      }

      // METRIC: Calculate latency
      const latency_ms = Date.now() - startTime;
      console.log('[API] [LATENCY] Request completed in', latency_ms, 'ms');

      // ========================================================================
      // WIDGET MODE: Save messages to database
      // ========================================================================
      if (isWidgetMode && userId && widgetConversationId) {
        console.log('[API] Widget mode: Saving messages to database');
        try {
          // Save user message
          const userMessageContent = messages[messages.length - 1]?.content;
          if (userMessageContent && typeof userMessageContent === 'string') {
            const { error: userMsgError } = await supabaseAdmin!
              .from('messages')
              .insert({
                conversation_id: widgetConversationId,
                user_id: userId,
                role: 'user',
                content: userMessageContent,
              });

            if (userMsgError) {
              console.error('[API] Widget mode: Failed to save user message:', userMsgError);
            } else {
              console.log('[API] Widget mode: User message saved');
            }
          }

          // Save assistant message with metrics
          const { data: assistantMsgData, error: assistantMsgError} = await supabaseAdmin!
            .from('messages')
            .insert({
              conversation_id: widgetConversationId,
              user_id: userId,
              role: 'assistant',
              content: finalResponse,
              latency_ms: latency_ms,
              ...(tokenUsage && { input_tokens: tokenUsage.input_tokens }),
              ...(tokenUsage && { output_tokens: tokenUsage.output_tokens }),
              ...(toolsCalled && { tools_called: toolsCalled }),
              ...(toolsCalled && { tool_success: toolsCalled.every(t => t.success) }),
              ...(selectedModelId && { model_id: selectedModelId }),
              ...(provider && { provider: provider }),
            })
            .select('id')
            .single();

          if (assistantMsgError) {
            console.error('[API] Widget mode: Failed to save assistant message:', assistantMsgError);
          } else {
            console.log('[API] Widget mode: Assistant message saved');
            console.log('[API] [METRICS] Saved message with metrics:', {
              latency_ms,
              input_tokens: tokenUsage?.input_tokens,
              output_tokens: tokenUsage?.output_tokens,
              tools_called: toolsCalled?.length || 0,
              tool_success: toolsCalled?.every(t => t.success)
            });

            // Log context injection for analytics
            if (contextInjection && userId && widgetConversationId && assistantMsgData) {
              try {
                await supabaseAdmin!
                  .from('context_injection_logs')
                  .insert({
                    user_id: userId,
                    conversation_id: widgetConversationId,
                    message_id: assistantMsgData.id,
                    context_types: contextInjection.contextTypes,
                    estimated_tokens: contextInjection.estimatedTokens,
                  });
              } catch (error) {
                console.error('[API] Error logging context injection:', error);
                // Non-critical, continue
              }
            }

            // Save detailed tool call records if tools were used
            if (toolsCalled && toolsCalled.length > 0 && assistantMsgData) {
              const messageId = assistantMsgData.id;
              console.log('[API] [TOOL_TRACKING] Saving', toolsCalled.length, 'tool calls for message:', messageId);

              const toolCallRecords = toolsCalled.map(tool => ({
                message_id: messageId,
                tool_name: tool.name,
                input_json: {}, // Future: capture tool input
                output_json: {}, // Future: capture tool output
                success: tool.success,
                duration_ms: null, // Future: capture duration
                error_message: tool.error || null
              }));

              const { error: toolCallError } = await supabaseAdmin!
                .from('tool_calls')
                .insert(toolCallRecords);

              if (toolCallError) {
                console.error('[API] Failed to save tool calls:', toolCallError);
              } else {
                console.log('[API] [TOOL_TRACKING] Saved', toolCallRecords.length, 'tool call records');
              }
            }

            // Save quality judgment (fire-and-forget, non-blocking)
            if (assistantMsgData) {
              const userMessage = messages[messages.length - 1];
              const userPrompt = typeof userMessage?.content === 'string' ? userMessage.content : '';

              saveBasicJudgment({
                messageId: assistantMsgData.id,
                conversationId: widgetConversationId,
                userId: userId || 'unknown',
                prompt: userPrompt,
                response: finalResponse,
                modelId: selectedModelId || 'unknown',
                provider: provider || 'unknown',
                benchmarkId: benchmarkId || undefined  // Link to benchmark if provided
              }).catch(err => {
                console.error('[API] Evaluation error (non-blocking):', err);
              });
            }
          }
        } catch (error) {
          console.error('[API] Widget mode: Error saving messages:', error);
          // Continue even if message saving fails
        }
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
                contextsUsed: graphRAGMetadata.sources?.length || 0,
                graphrag_tokens: graphRAGMetadata.estimatedTokens || 0
              })}\n\n`;
              controller.enqueue(encoder.encode(metaData));
            }

            // METRIC: Send model attribution metadata
            // Use actual provider from model config if available, otherwise fall back to legacy provider
            const actualProvider = actualModelConfig?.provider || provider;
            console.log('[API] [NON-STREAMING] Sending model metadata:', {
              model_id: selectedModelId || model,
              provider: actualProvider
            });
            const modelData = `data: ${JSON.stringify({
              type: 'model_metadata',
              model_id: selectedModelId || model,
              provider: actualProvider
            })}\n\n`;
            controller.enqueue(encoder.encode(modelData));

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

            // Send reasoning/thinking metadata if available
            if (reasoning) {
              const reasoningData = `data: ${JSON.stringify({
                type: 'reasoning_metadata',
                reasoning: reasoning
              })}\n\n`;
              controller.enqueue(encoder.encode(reasoningData));
            }

            // Phase 3: Progressive per-document summaries (emit previews before streaming full answer)
            if (lastWebSearchDocs && Array.isArray(lastWebSearchDocs) && lastWebSearchDocs.length > 0) {
              try {
                const previewCount = Math.min(3, lastWebSearchDocs.length);
                for (let i = 0; i < previewCount; i++) {
                  const doc = lastWebSearchDocs[i] || {};
                  const docEvt = `data: ${JSON.stringify({
                    type: 'doc_summary',
                    index: i + 1,
                    title: doc.title || null,
                    url: doc.url || null,
                    summary: doc.summary || doc.snippet || null,
                    source: doc.source || null,
                    publishedAt: doc.publishedAt || null,
                  })}\n\n`;
                  controller.enqueue(encoder.encode(docEvt));
                }
              } catch (docErr) {
                console.log('[API] SSE doc_summary emit error (ignored):', docErr);
              }
            }

            // Export links (signed, short-lived) injected as assistant content lines if possible
            // Only show export links if web search was actually used in this conversation
            if (lastWebSearchDocs && Array.isArray(lastWebSearchDocs) && lastWebSearchDocs.length > 0) {
              try {
                // Only build links if we have a conversationId (scope) and can sign
                if (conversationId) {
                  const exp = Date.now() + 10 * 60 * 1000; // 10 minutes
                  const payloadBase = { exp, cid: conversationId, savedOnly: true } as any;
                  // CSV link
                  const tCsv = signExportPayload({ ...payloadBase, format: 'csv', uid: null });
                  // Markdown link
                  const tMd = signExportPayload({ ...payloadBase, format: 'md', uid: null });
                  if (tCsv && tMd) {
                    const csvUrl = `/api/search-summaries/export?sig=${tCsv}`;
                    const mdUrl = `/api/search-summaries/export?sig=${tMd}`;
                    const line = `data: ${JSON.stringify({ content: `\nDownload web search summaries: [CSV](${csvUrl}) | [Markdown](${mdUrl})\n` })}\n\n`;
                    controller.enqueue(encoder.encode(line));
                  }
                }
              } catch (e) {
                console.log('[API] Export link emit error (ignored):', e);
              }
            }

            // OBSERVABILITY: Emit research progress start if deep research was initiated
            // Prefer explicit job id captured from tool invocation; fallback to parsing final text
            let jobId = lastDeepResearchJobId || undefined;
            if (!jobId && typeof finalResponse === 'string' && finalResponse.includes('deep_research_started')) {
              const jobIdMatch = finalResponse.match(/jobId['":\s]+([a-f0-9-]+)/i);
              jobId = jobIdMatch ? jobIdMatch[1] : undefined;
            }
            if (jobId) {
              const progressData = `data: ${JSON.stringify({
                type: 'research_progress',
                status: 'started',
                jobId,
                currentStep: 'Starting research...',
                totalSteps: 4,
                completedSteps: 0,
              })}\n\n`;
              controller.enqueue(encoder.encode(progressData));
            }

            // Fake stream the complete response in larger chunks for performance
            const chunkSize = 100; // Send 100 characters at a time (was 3, caused freeze with large conversations)
            for (let i = 0; i < finalResponse.length; i += chunkSize) {
              const chunk = finalResponse.slice(i, i + chunkSize);
              const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
              controller.enqueue(encoder.encode(data));
              // Small delay to simulate streaming
              await new Promise(resolve => setTimeout(resolve, 20));
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
      const streamStartTime = Date.now(); // Track latency for streaming
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
                contextsUsed: graphRAGMetadata.sources?.length || 0,
                graphrag_tokens: graphRAGMetadata.estimatedTokens || 0
              })}\n\n`;
              controller.enqueue(encoder.encode(metaData));
            }

            // METRIC: Send model attribution metadata
            // Use actual provider from model config if available, otherwise fall back to legacy provider
            const actualProvider = actualModelConfig?.provider || provider;
            console.log('[API] [STREAMING] Sending model metadata:', {
              model_id: selectedModelId || model,
              provider: actualProvider
            });
            const modelData = `data: ${JSON.stringify({
              type: 'model_metadata',
              model_id: selectedModelId || model,
              provider: actualProvider
            })}\n\n`;
            controller.enqueue(encoder.encode(modelData));

            // Stream LLM output (plain text chunks)
            // Accumulate response for widget mode message saving
            let accumulatedResponse = '';

            // Use UnifiedLLMClient if model is selected from registry
            if (useUnifiedClient && selectedModelId) {
              console.log('[API] Streaming with UnifiedLLMClient, model:', selectedModelId);
              try {
                for await (const chunk of unifiedLLMClient.stream(
                  selectedModelId,
                  enhancedMessages,
                  {
                    temperature,
                    maxTokens,
                    userId: userId || undefined,
                  }
                )) {
                  console.log('[API] [DEBUG] Streaming chunk, length:', chunk.length);
                  accumulatedResponse += chunk;
                  const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
                  controller.enqueue(encoder.encode(data));
                }
              } catch (modelError) {
                // Handle model-not-found errors gracefully
                const errorMsg = modelError instanceof Error ? modelError.message : String(modelError);
                if (errorMsg.includes('Model not found') || errorMsg.includes('Cannot coerce the result')) {
                  console.error('[API] Model not found during streaming:', selectedModelId);
                  const errorData = `data: ${JSON.stringify({
                    error: `Model not found. Please select a different model from the dropdown. The selected model no longer exists or you don't have access to it.`
                  })}\n\n`;
                  controller.enqueue(encoder.encode(errorData));
                  controller.close();
                  return;
                }
                // Re-throw other errors
                throw modelError;
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
                console.log('[API] [DEBUG] Streaming chunk (legacy), length:', chunk.length);
                accumulatedResponse += chunk;
                const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }

            console.log('[API] [DEBUG] Streaming complete. Total accumulated response length:', accumulatedResponse.length);
            console.log('[API] [DEBUG] Response preview:', accumulatedResponse.substring(0, 200));

            // ========================================================================
            // WIDGET MODE: Save messages to database after streaming
            // ========================================================================
            if (isWidgetMode && userId && widgetConversationId && accumulatedResponse) {
              console.log('[API] Widget mode (streaming): Saving messages to database');
              try {
                const streamLatencyMs = Date.now() - streamStartTime;
                console.log('[API] [LATENCY] Streaming completed in', streamLatencyMs, 'ms');
                
                // Estimate token usage (rough approximation: ~4 chars per token)
                const estimatedOutputTokens = Math.ceil(accumulatedResponse.length / 4);
                const userMessageContent = messages[messages.length - 1]?.content;
                const estimatedInputTokens = typeof userMessageContent === 'string' 
                  ? Math.ceil(userMessageContent.length / 4)
                  : 0;
                
                console.log('[API] Estimated tokens:', estimatedInputTokens, 'in,', estimatedOutputTokens, 'out');
                
                // Save user message
                if (userMessageContent && typeof userMessageContent === 'string') {
                  await supabaseAdmin!
                    .from('messages')
                    .insert({
                      conversation_id: widgetConversationId,
                      user_id: userId,
                      role: 'user',
                      content: userMessageContent,
                    });
                  console.log('[API] Widget mode (streaming): User message saved');
                }

                // Save assistant message with latency and token estimates
                await supabaseAdmin!
                  .from('messages')
                  .insert({
                    conversation_id: widgetConversationId,
                    user_id: userId,
                    role: 'assistant',
                    content: accumulatedResponse,
                    latency_ms: streamLatencyMs,
                    input_tokens: estimatedInputTokens,
                    output_tokens: estimatedOutputTokens,
                    ...(selectedModelId && { model_id: selectedModelId }),
                    ...(provider && { provider: provider }),
                  });
                console.log('[API] Widget mode (streaming): Assistant message saved with metrics');
              } catch (error) {
                console.error('[API] Widget mode (streaming): Error saving messages:', error);
                // Continue even if message saving fails
              }
            }

            // If nothing was accumulated (unexpected), send a short placeholder to avoid blank UI
            if (!accumulatedResponse || accumulatedResponse.trim().length === 0) {
              const placeholder = 'No content was generated by the model.';
              const data = `data: ${JSON.stringify({ content: placeholder })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
            console.log('[API] [DEBUG] Sending [DONE] marker');
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

    // Categorize and save error for batch testing/analytics
    const { category, severity } = categorizeError(error);
    console.log('[API] Error categorized:', { category, severity });

    // Save error to database if we have conversation context
    if (isWidgetMode && widgetConversationId && supabaseAdmin) {
      try {
        await supabaseAdmin.from('errors').insert({
          conversation_id: widgetConversationId,
          error_type: category,
          error_message: error instanceof Error ? error.message : String(error),
          stack_trace: error instanceof Error ? error.stack : null,
          severity: severity,
          metadata_json: {
            model_id: selectedModelId,
            provider: provider,
            is_batch_test: isWidgetMode
          }
        });
        console.log('[API] Error logged to database:', category);
      } catch (dbError) {
        console.error('[API] Failed to log error to database:', dbError);
      }
    }

    return new Response('Internal server error', { status: 500 });
  }
}
