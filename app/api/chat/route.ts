// API route for chat completions with streaming support
import { NextRequest } from 'next/server';
import { streamOpenAIResponse, runOpenAIWithToolCalls } from '@/lib/llm/openai';
import type { ChatMessage, ToolDefinition } from '@/lib/llm/openai';
import { streamAnthropicResponse, runAnthropicWithToolCalls } from '@/lib/llm/anthropic';
import { graphragService, graphragConfig } from '@/lib/graphrag';
import type { EmbedderConfig } from '@/lib/graphrag/graphiti/client';
import { executeTool } from '@/lib/tools/toolManager';
import type { EnhancedPrompt, SearchSource, SearchMetadata, GraphRAGRetrievalMetadata } from '@/lib/graphrag';
import { supabase } from '@/lib/supabaseClient';
import { loadLLMConfig } from '@/lib/config/llmConfig';
import { unifiedLLMClient } from '@/lib/llm/unified-client';
import { modelManager } from '@/lib/models/model-manager.service';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import { estimateGraphRAGTokens } from '@/lib/context';
import { gatherConversationContext } from '@/lib/context/context-provider.service';
import type { ContextInjectionResult } from '@/lib/context/types';
import { validateApiKey } from '@/lib/auth/api-key-validator';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { categorizeError } from '@/lib/batch-testing/error-categorizer';
import { saveBasicJudgment } from '@/lib/batch-testing/evaluation-integration';
import { evaluateWithLLMJudge, shouldEvaluateMessage } from '@/lib/evaluation/llm-judge-integration';
import { calculateBasicQualityScore } from '@/lib/batch-testing/evaluation-integration';
import crypto from 'crypto';
import { traceService } from '@/lib/tracing/trace.service';
import type { TraceContext } from '@/lib/tracing/types';
import { recordUsageEvent } from '@/lib/usage/checker';
import { generateSessionTag } from '@/lib/session-tagging/generator';

// Use Node.js runtime instead of Edge for OpenAI SDK compatibility
export const runtime = 'nodejs';

type WebSearchDocument = {
  title?: string;
  url?: string;
  summary?: string;
  snippet?: string;
  source?: string;
  publishedAt?: string;
};

type WebSearchToolPayload = {
  results?: WebSearchDocument[];
  status?: string;
  jobId?: string | number;
};

function isWebSearchDocument(value: unknown): value is WebSearchDocument {
  return typeof value === 'object' && value !== null;
}

function isWebSearchToolPayload(value: unknown): value is WebSearchToolPayload {
  if (!value || typeof value !== 'object') return false;
  const { results } = value as { results?: unknown };
  if (results !== undefined) {
    if (!Array.isArray(results) || !results.every(isWebSearchDocument)) {
      return false;
    }
  }
  return true;
}

function isToolDefinition(value: unknown): value is ToolDefinition {
  if (!value || typeof value !== 'object') return false;
  const tool = value as Partial<ToolDefinition>;
  if (tool.type !== 'function') return false;
  const fn = tool.function;
  return !!fn && typeof fn === 'object' && typeof fn.name === 'string';
}

export async function POST(req: NextRequest) {
  // Declare variables outside try block for error handling access
  let isWidgetMode = false;
  let isBatchTestMode = false;
  let widgetConversationId: string | null = null;
  let supabaseAdmin: SupabaseClient | null = null;
  let selectedModelId: string | null = null;
  let provider: string | null = null;
  // Track last web_search tool results for progressive doc summaries (SSE)
  let lastWebSearchDocs: WebSearchDocument[] | null = null;
  // Track deep research job id explicitly (do not rely on model text echo)
  let lastDeepResearchJobId: string | null = null;
  const exportSigningSecret = process.env.EXPORT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  // Trace context for LLM operation tracing
  let traceContext: TraceContext | null = null;

  function base64urlEncode(buf: Buffer): string {
    return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  function signExportPayload(payload: Record<string, unknown>): string | null {
    try {
      const json = JSON.stringify(payload);
      const payloadB64 = base64urlEncode(Buffer.from(json, 'utf-8'));
      const sig = crypto.createHmac('sha256', exportSigningSecret).update(payloadB64).digest('hex');
      return `${payloadB64}.${sig}`;
    } catch {
      return null;
    }
  }

  try {
    // Parse request body with error handling for aborted requests
    let messages: ChatMessage[] = [];
    let memory: { userId?: string; userPreferences?: Record<string, unknown>; conversationMemories?: Record<string, unknown> } | null = null;
    let rawTools: unknown;
    let conversationId: string | null = null;
    let modelId: string | null = null;
    let widgetSessionId: string | null = null;
    let forceNonStreaming: boolean | undefined;
    let runId: string | null = null;
    let benchmarkId: string | null = null;
    let requestUserId: string | null = null;
    let enableDeepResearch: boolean | undefined;
    let contextInjectionEnabled: boolean | undefined;
    let enableThinking: boolean | undefined;
    try {
      ({
        messages,
        memory,
        tools: rawTools,
        conversationId,
        modelId,
        widgetSessionId,
        forceNonStreaming,
        runId,
        benchmarkId,
        userId: requestUserId,
        enableDeepResearch,
        contextInjectionEnabled,
        enableThinking,
      } = await req.json());
    } catch (jsonError) {
      console.log('[API] Request aborted or invalid JSON:', jsonError instanceof Error ? jsonError.message : 'Unknown error');
      // Return 499 (Client Closed Request) for aborted requests
      return new Response('Request aborted', { status: 499 });
    }

    const allowDeepResearch = enableDeepResearch === true;

    console.log('[API] ===== RECEIVED REQUEST =====');
    console.log('[API] contextInjectionEnabled:', contextInjectionEnabled);
    console.log('[API] typeof contextInjectionEnabled:', typeof contextInjectionEnabled);
    console.log('[API] contextInjectionEnabled === false:', contextInjectionEnabled === false);
    console.log('[API] contextInjectionEnabled !== false:', contextInjectionEnabled !== false);
    console.log('[API] requestUserId:', requestUserId ? 'present' : 'missing');

    // Normalize model UUID for DB writes (allow human-readable names for routing logic)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const llmModelIdForDb: string | null = modelId && uuidRegex.test(modelId) ? modelId : null;

    let tools = Array.isArray(rawTools) ? rawTools.filter(isToolDefinition) : [];

    // Remove query_knowledge_graph tool if context injection is disabled
    if (contextInjectionEnabled === false) {
      tools = tools.filter((tool: ToolDefinition) => tool.function.name !== 'query_knowledge_graph');
      console.log('[API] Context injection OFF: Removed query_knowledge_graph tool');
    }

    const activeTools = tools.length > 0 ? tools : undefined;

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
    let widgetSessionTag: string | null = null;

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
      // Normal mode: Get user ID from request body
      console.log('[API] Normal mode: Getting user from request body');
      userId = requestUserId || memory?.userId || null;
      console.log('[API] Normal mode: userId:', userId || 'not provided');
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 });
    }

    console.log('[API] Request with', messages.length, 'messages,', tools.length, 'tools');
    if (tools.length > 0) {
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
          .select('id, session_id')
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
              // Only store UUIDs; ignore human-readable model names for this column
              llm_model_id: llmModelIdForDb,
              run_id: runId || null,
            })
            .select()
            .single();

          conversation = result.data;
          convError = result.error;

          // Handle race condition: If unique constraint violated, fetch the existing conversation
          if (convError?.code === '23505') {
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
        widgetSessionTag = conversation.session_id || null;
        
        // Generate session tag if missing (first message)
        if (!widgetSessionTag && userId && llmModelIdForDb) {
          try {
            const sessionTag = await generateSessionTag(userId, llmModelIdForDb);
            if (sessionTag) {
              await supabaseAdmin!
                .from('conversations')
                .update({
                  session_id: sessionTag.session_id,
                  experiment_name: sessionTag.experiment_name
                })
                .eq('id', conversation.id);
              widgetSessionTag = sessionTag.session_id;
              console.log('[API] Generated session tag:', widgetSessionTag);
            }
          } catch (error) {
            console.error('[API] Failed to generate session tag:', error);
          }
        }
        
        conversationId = conversation.id; // Set conversationId for conversation history loading
        console.log('[API] Widget mode: Conversation created:', widgetConversationId, 'Session tag:', widgetSessionTag);
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
        content: `You are a helpful assistant for Fine Tune Lab. You have access to the user's uploaded documents through a knowledge graph.

When the user's message includes "Relevant Context from Knowledge Graph", USE that information to answer their question. The knowledge graph contains documents they've uploaded specifically for you to reference.

When discussing Fine Tune Lab, use first-person pronouns (say "we offer" not "they offer").

Be conversational and helpful. Provide detailed explanations when needed, especially for users new to LLM training.

If knowledge graph context is provided, acknowledge it and use it to give accurate, contextual answers based on their documents.`
      },
      ...messages
    ];

    // Collect additional system context to append (not prepend)
    let additionalSystemContext = '';

    // Inject memory context if provided (only if context injection enabled)
    if (memory && contextInjectionEnabled !== false &&
        (Object.keys(memory.userPreferences || {}).length > 0 ||
         Object.keys(memory.conversationMemories || {}).length > 0)) {
      const memoryContext = `Memory Context:
User Preferences: ${JSON.stringify(memory.userPreferences, null, 2)}
Conversation Context: ${JSON.stringify(memory.conversationMemories, null, 2)}`;

      console.log('[API] Adding memory context to messages');
      additionalSystemContext += `\n\n${memoryContext}`;
    }

    // Inject conversation history from Supabase (only if context injection enabled)
    if (conversationId && userId && contextInjectionEnabled !== false) {
      try {
        const { data: recentMessages } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(10); // Reduced from 20 to 10 for memory efficiency

        if (recentMessages && recentMessages.length > 0) {
          // Limit each message to prevent memory explosion
          const MAX_MESSAGE_LENGTH = parseInt(process.env.CHAT_HISTORY_MAX_MESSAGE_LENGTH || '500', 10);
          const MAX_TOTAL_LENGTH = parseInt(process.env.CHAT_HISTORY_MAX_TOTAL_LENGTH || '3000', 10); // Total history cap
          
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
          additionalSystemContext += `\n\nRecent conversation history:\n${historyContext}`;
        }
      } catch (error) {
        console.error('[API] Error loading conversation history:', error);
        // Continue without history on error
      }
    }

    // Context Provider - inject user context before GraphRAG
    // Only inject if user has enabled it (default: true for backwards compatibility)
    let contextInjection: ContextInjectionResult | null = null;
    console.log('[API] ===== CONTEXT INJECTION CHECK =====');
    console.log('[API] contextInjectionEnabled VALUE:', contextInjectionEnabled);
    console.log('[API] contextInjectionEnabled TYPE:', typeof contextInjectionEnabled);
    console.log('[API] Condition check: userId && contextInjectionEnabled !== false');
    console.log('[API] userId:', !!userId);
    console.log('[API] contextInjectionEnabled !== false:', contextInjectionEnabled !== false);
    console.log('[API] Will inject context:', !!(userId && contextInjectionEnabled !== false));

    if (userId && contextInjectionEnabled !== false) {
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

          // Append context to additional system context
          additionalSystemContext += `\n\n${contextInjection.systemMessage}`;
        }
      } catch (error) {
        console.error('[API] Error gathering context:', error);
        // Continue without context on error
      }
    }

    // Apply all accumulated system context to the base system message
    if (additionalSystemContext) {
      enhancedMessages[0] = {
        role: 'system',
        content: enhancedMessages[0].content + additionalSystemContext
      };
    }

    // GraphRAG enhancement - inject document context for all queries
    // The GraphRAG service returns contextUsed: false if no relevant docs found
    // This allows tools and GraphRAG context to work together for hybrid queries
    // Only inject if context injection is enabled (respects user toggle)
    let graphRAGMetadata: { sources?: SearchSource[]; metadata?: GraphRAGRetrievalMetadata; estimatedTokens?: number } | null = null;
    console.log('[API] ===== GRAPHRAG INJECTION CHECK =====');
    console.log('[API] contextInjectionEnabled VALUE:', contextInjectionEnabled);
    console.log('[API] contextInjectionEnabled TYPE:', typeof contextInjectionEnabled);
    console.log('[API] Condition check: userId && contextInjectionEnabled !== false');
    console.log('[API] userId:', !!userId);
    console.log('[API] contextInjectionEnabled !== false:', contextInjectionEnabled !== false);
    console.log('[API] Will inject GraphRAG:', !!(userId && contextInjectionEnabled !== false));

    if (userId && contextInjectionEnabled !== false) {
      try {
        // Fetch user's embedding settings for GraphRAG
        let embedderConfig: EmbedderConfig | undefined;
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          const settingsClient = createClient(supabaseUrl, supabaseServiceKey);

          const { data: settings } = await settingsClient
            .from('user_settings')
            .select('embedding_provider, embedding_base_url, embedding_model, embedding_api_key')
            .eq('user_id', userId)
            .single();

          if (settings?.embedding_provider && settings.embedding_provider !== 'openai') {
            embedderConfig = {
              provider: settings.embedding_provider as 'openai' | 'runpod',
              baseUrl: settings.embedding_base_url || undefined,
              model: settings.embedding_model || undefined,
              apiKey: settings.embedding_api_key || undefined,
            };
            console.log('[API] Using custom embedder:', embedderConfig.provider);
          }
        } catch (settingsErr) {
          console.log('[API] Could not fetch embedding settings, using defaults');
        }

        const userMessage = messages[messages.length - 1]?.content;
        if (userMessage && typeof userMessage === 'string') {
          // Always attempt GraphRAG enhancement
          // Service will return contextUsed: false if no relevant docs found
          const enhanced: EnhancedPrompt = await graphragService.enhancePrompt(
            userId,
            userMessage,
            {
              minConfidence: graphragConfig.search.threshold,
              embedderConfig,
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

    // In widget mode, if the selectedModelId is not a UUID (likely a friendly alias),
    // prefer the legacy provider path to avoid unified registry lookups causing 404s.
    if (isWidgetMode && selectedModelId && !uuidRegex.test(String(selectedModelId))) {
      console.log('[API] [MODEL-SELECT] Widget alias detected, disabling unified client for fallback:', selectedModelId);
      useUnifiedClient = false;
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
      maxTokens = llmConfig.anthropic?.max_tokens ?? parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000', 10);
    } else {
      model = llmConfig.openai?.model || 'gpt-4o-mini';
      streamLLMResponse = streamOpenAIResponse;
      runLLMWithToolCalls = runOpenAIWithToolCalls;
      temperature = llmConfig.openai?.temperature ?? 0.7;
      maxTokens = llmConfig.openai?.max_tokens ?? parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10);
    }

    // Tool-call aware chat completion (provider-aware)
    let lastDeepResearchQuery: string | null = null;
    const toolCallHandler = async (toolName: string, args: Record<string, unknown>) => {
      // Use conversationId if available, else empty string
      const convId = conversationId || '';

      // ========================================================================
      // TRACE: Start tool call span
      // ========================================================================
      let toolTraceContext: TraceContext | undefined;
      
      // Only trace if we have a parent trace context (from LLM call)
      if (traceContext) {
        try {
          toolTraceContext = await traceService.createChildSpan(
            traceContext,
            `tool.${toolName}`,
            'tool_call'
          );
          console.log(`[Trace] Started tool call trace: ${toolName}`);
        } catch (traceErr) {
          // Log but don't block - tracing failures should never break functionality
          console.error('[Trace] Failed to start tool trace:', traceErr);
        }
      }

      // Enforce deep research toggle server-side.
      // Without this, models can start deep research even when UI toggle is off.
      if (toolName === 'web_search' && !allowDeepResearch) {
        const wantsResearch = args.research === true || args.deepResearchConfirmed === true;
        if (wantsResearch) {
          args = {
            ...args,
            research: false,
            deepResearchConfirmed: false,
          };
        }
      }

      const result = await executeTool(toolName, args, convId, undefined, userId || undefined);
      // Capture web_search results for SSE previews (standard search path only)
      try {
        if (toolName === 'web_search' && isWebSearchToolPayload(result.data)) {
          const { results, status, jobId } = result.data;
          if (Array.isArray(results)) {
            lastWebSearchDocs = results;
          }
          // Capture deep research job id directly when present
          if ((status === 'deep_research_started' || status === 'research_started') && jobId) {
            lastDeepResearchJobId = String(jobId);
            if (typeof args.query === 'string') {
              lastDeepResearchQuery = args.query;
            }
            console.log('[API] Captured deep research job id from tool result:', lastDeepResearchJobId);
          }
        }
      } catch (capErr) {
        console.log('[API] Could not capture web_search results for SSE:', capErr);
      }
      
      // ========================================================================
      // TRACE: End tool call span
      // ========================================================================
      if (toolTraceContext) {
        try {
          if (result.error) {
            // Tool call failed
            await traceService.endTrace(toolTraceContext, {
              endTime: new Date(),
              status: 'failed',
              errorMessage: String(result.error),
              errorType: 'ToolExecutionError',
              metadata: {
                toolName,
                args: JSON.stringify(args).slice(0, 1000), // Limit to 1000 chars
              },
            });
            console.log(`[Trace] Ended tool call trace (failed): ${toolName}`);
          } else {
            // Tool call succeeded
            await traceService.endTrace(toolTraceContext, {
              endTime: new Date(),
              status: 'completed',
              outputData: result.data,
              metadata: {
                toolName,
                args: JSON.stringify(args).slice(0, 1000), // Limit to 1000 chars
                resultType: typeof result.data,
                hasResults: result.data !== null && result.data !== undefined,
              },
            });
            console.log(`[Trace] Ended tool call trace (success): ${toolName}`);
          }
        } catch (traceErr) {
          console.error('[Trace] Failed to end tool trace:', traceErr);
        }
      }
      
      if (result.error) return { error: result.error };
      return result.data;
    };

    const encoder = new TextEncoder();
    let actualModelConfig: ModelConfig | null = null; // Store model config to get actual provider

    // ========================================================================
    // THINKING MODE: Add <think> tag for reasoning models (Qwen3, etc.)
    // When enabled, prepend <think> to the last user message to trigger
    // step-by-step reasoning with <think>...</think> output blocks
    // ========================================================================
    // COMMENTED OUT FOR DEBUGGING - No thinking instructions
    // if (enableThinking) {
    //   console.log('[API] Thinking mode enabled - adding <think> instruction');
    //   // Add thinking instruction to system prompt
    //   const thinkingInstruction = `\n\nIMPORTANT: You have thinking mode enabled. Before answering, reason through the problem step-by-step inside <think>...</think> tags. Show your complete reasoning process, then provide your final answer after the </think> tag.`;
    //
    //   if (enhancedMessages.length > 0 && enhancedMessages[0].role === 'system') {
    //     enhancedMessages[0] = {
    //       ...enhancedMessages[0],
    //       content: enhancedMessages[0].content + thinkingInstruction
    //     };
    //   }
    // }

    // Branch: Use non-streaming for tool-enabled requests (except OpenAI which supports streaming + tools)
    // OpenAI can stream with tools, Anthropic cannot yet
    const requiresNonStreaming = forceNonStreaming || (tools.length > 0 && provider !== 'openai');
    
    if (requiresNonStreaming) {
      // NON-STREAMING PATH: Execute tools and get complete response
      console.log('[API] Using non-streaming tool-aware path');
      console.log('[API] Route decision: tools=', tools.length > 0, 'forceNonStreaming=', !!forceNonStreaming, 'provider=', provider);

      // METRIC: Start latency tracking
      const startTime = Date.now();
      console.log('[API] [LATENCY] Request started at:', startTime);

      let llmResponse;
      let messageMetadata: { model_name: string; provider: string; model_id: string; timestamp: string } | undefined;

      // Use UnifiedLLMClient if model is selected from registry
      console.log('[API] [MODEL-SELECT] useUnifiedClient:', useUnifiedClient, 'selectedModelId:', selectedModelId);
      if (useUnifiedClient && selectedModelId) {
        console.log('[API] ✓✓✓ Using UnifiedLLMClient with model:', selectedModelId);

        // Load model config to get actual provider for metadata
        actualModelConfig = await modelManager.getModelConfig(selectedModelId, userId || undefined);
        if (actualModelConfig) {
          console.log('[API] Model config loaded - actual provider:', actualModelConfig.provider);
        }

        // Create metadata object for persistence
        messageMetadata = {
          model_name: actualModelConfig?.name || selectedModelId,
          provider: actualModelConfig?.provider || provider,
          model_id: selectedModelId,
          timestamp: new Date().toISOString(),
          // Add GraphRAG metadata if available
          ...(graphRAGMetadata?.metadata && {
            graphrag: {
              graph_used: graphRAGMetadata.metadata.graph_used,
              nodes_retrieved: graphRAGMetadata.metadata.nodes_retrieved,
              context_chunks_used: graphRAGMetadata.metadata.context_chunks_used,
              retrieval_time_ms: graphRAGMetadata.metadata.retrieval_time_ms,
              context_relevance_score: graphRAGMetadata.metadata.context_relevance_score,
              answer_grounded_in_graph: graphRAGMetadata.metadata.answer_grounded_in_graph,
              retrieval_method: graphRAGMetadata.metadata.searchMethod,
            }
          })
        };

        // Calculate safe max_tokens based on model's context window
        let safeMaxTokens = maxTokens;
        if (actualModelConfig?.context_length) {
          // Estimate input tokens (rough: 1 token ≈ 4 chars)
          const inputText = enhancedMessages.map(m => m.content).join(' ');
          const estimatedInputTokens = Math.ceil(inputText.length / 4);

          // Calculate available space for output
          const availableTokens = actualModelConfig.context_length - estimatedInputTokens;

          // Use the minimum of requested and available, with safety margin
          const safetyMargin = 100; // Reserve tokens for tool calls, formatting, etc.
          safeMaxTokens = Math.min(maxTokens, Math.max(100, availableTokens - safetyMargin));

          console.log('[API] Context calculation:', {
            modelContextLength: actualModelConfig.context_length,
            estimatedInputTokens,
            availableTokens,
            requestedMaxTokens: maxTokens,
            adjustedMaxTokens: safeMaxTokens
          });
        }

        // Generate session tag for regular chat if needed
        let regularChatSessionTag: string | null = null;
        if (!isWidgetMode && !isBatchTestMode && conversationId && userId) {
          console.log('[API] [SESSION_TAG] Checking session tag generation conditions:', {
            isWidgetMode,
            isBatchTestMode,
            conversationId,
            userId,
            selectedModelId
          });
          
          try {
            // Create service role client but filter by user_id for security
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
            const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
            
            const { data: conversation, error: convError } = await supabaseAuth
              .from('conversations')
              .select('session_id, llm_model_id')
              .eq('id', conversationId)
              .eq('user_id', userId)  // Security: Ensure user owns this conversation
              .single();
            
            console.log('[API] [SESSION_TAG] Fetched conversation:', {
              conversation_id: conversationId,
              session_id: conversation?.session_id,
              llm_model_id: conversation?.llm_model_id,
              error: convError?.message
            });
            
            // Update llm_model_id if missing (first message in conversation)
            let modelIdToUse = conversation?.llm_model_id;
            if (conversation && !conversation.llm_model_id && selectedModelId) {
              console.log('[API] [SESSION_TAG] Setting llm_model_id on conversation:', selectedModelId);
              const { error: updateError } = await supabaseAuth
                .from('conversations')
                .update({ llm_model_id: selectedModelId })
                .eq('id', conversationId)
                .eq('user_id', userId);  // Security: Ensure user owns this conversation
              
              if (updateError) {
                console.error('[API] [SESSION_TAG] Failed to update llm_model_id:', updateError);
              } else {
                modelIdToUse = selectedModelId;
                console.log('[API] [SESSION_TAG] Successfully set llm_model_id');
              }
            }
            
            if (conversation && !conversation.session_id && modelIdToUse) {
              console.log('[API] [SESSION_TAG] Generating session tag with:', { userId, modelIdToUse });
              const sessionTag = await generateSessionTag(userId, modelIdToUse);
              console.log('[API] [SESSION_TAG] Generated session tag:', sessionTag);
              
              if (sessionTag) {
                const { error: tagError } = await supabaseAuth
                  .from('conversations')
                  .update({
                    session_id: sessionTag.session_id,
                    experiment_name: sessionTag.experiment_name
                  })
                  .eq('id', conversationId)
                  .eq('user_id', userId);  // Security: Ensure user owns this conversation
                
                if (tagError) {
                  console.error('[API] [SESSION_TAG] Failed to update session tag:', tagError);
                } else {
                  regularChatSessionTag = sessionTag.session_id;
                  console.log('[API] [SESSION_TAG] Successfully set session tag:', regularChatSessionTag);
                }
              }
            } else {
              console.log('[API] [SESSION_TAG] Skipping generation:', {
                hasConversation: !!conversation,
                hasSessionId: !!conversation?.session_id,
                hasModelId: !!modelIdToUse
              });
              
              if (conversation?.session_id) {
                regularChatSessionTag = conversation.session_id;
                console.log('[API] [SESSION_TAG] Using existing session tag:', regularChatSessionTag);
              }
            }
          } catch (error) {
            console.error('[API] [SESSION_TAG] Error in session tag flow:', error);
          }
        } else {
          console.log('[API] [SESSION_TAG] Conditions not met for session tag generation:', {
            isWidgetMode,
            isBatchTestMode,
            hasConversationId: !!conversationId,
            hasUserId: !!userId
          });
        }

        // Start trace for LLM operation
        traceContext = await traceService.startTrace({
          spanName: 'llm.completion',
          operationType: 'llm_call',
          modelName: selectedModelId,
          modelProvider: actualModelConfig?.provider || provider || undefined,
          conversationId: widgetConversationId || conversationId || undefined,
          sessionTag: widgetSessionTag || regularChatSessionTag || undefined,
        });

        try {
          llmResponse = await unifiedLLMClient.chat(
            selectedModelId,
            enhancedMessages,
            {
              tools: activeTools,
              temperature,
              maxTokens: safeMaxTokens,
              userId: userId || undefined,
              toolCallHandler,
            }
          );
        } catch (modelError) {
          // Capture error in trace
          if (traceContext && modelError instanceof Error) {
            await traceService.captureError(traceContext, modelError);
          }

          // Handle model-not-found errors gracefully
          const errorMsg = modelError instanceof Error ? modelError.message : String(modelError);

          if (errorMsg.includes('Model not found') || errorMsg.includes('Cannot coerce the result')) {
            console.error('[API] Model not found:', selectedModelId);
            if (isWidgetMode) {
              console.log('[API] Widget mode: Falling back to legacy default model');
              // Fallback to legacy provider path using default configured model
              llmResponse = await runLLMWithToolCalls(
                enhancedMessages,
                model,
                temperature,
                maxTokens,
                tools,
                toolCallHandler
              );
              // Load model config for metadata (legacy path)
              try {
                actualModelConfig = await modelManager.getModelConfig(model, userId || undefined);
              } catch {}
              messageMetadata = {
                model_name: actualModelConfig?.name || model,
                provider: actualModelConfig?.provider || provider,
                model_id: model,
                timestamp: new Date().toISOString(),
                // Add GraphRAG metadata if available
                ...(graphRAGMetadata?.metadata && {
                  graphrag: {
                    graph_used: graphRAGMetadata.metadata.graph_used,
                    nodes_retrieved: graphRAGMetadata.metadata.nodes_retrieved,
                    context_chunks_used: graphRAGMetadata.metadata.context_chunks_used,
                    retrieval_time_ms: graphRAGMetadata.metadata.retrieval_time_ms,
                    context_relevance_score: graphRAGMetadata.metadata.context_relevance_score,
                    answer_grounded_in_graph: graphRAGMetadata.metadata.answer_grounded_in_graph,
                    retrieval_method: graphRAGMetadata.metadata.searchMethod,
                  }
                })
              };
            } else {
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
          }

          // Handle authentication errors (401)
          if (errorMsg.includes('status: 401') || errorMsg.includes('authentication failed')) {
            console.error('[API] Authentication error for model:', selectedModelId);
            const providerName = actualModelConfig?.provider || 'the provider';
            return new Response(
              JSON.stringify({
                error: `Authentication failed - API key missing or invalid`,
                details: `Please add your ${providerName} API key in Settings > API Keys. The model requires authentication but no valid API key was found.`
              }),
              {
                status: 401,
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

        // Load model config for metadata (legacy path)
        // Try to get config from registry, fallback to using model string as-is
        try {
          actualModelConfig = await modelManager.getModelConfig(model, userId || undefined);
          if (actualModelConfig) {
            console.log('[API] [LEGACY] Model config loaded - actual provider:', actualModelConfig.provider);
          }
        } catch (error) {
          console.log('[API] [LEGACY] Could not load model config, using model string:', model);
        }

        // Create metadata object for persistence (legacy path)
        messageMetadata = {
          model_name: actualModelConfig?.name || model,
          provider: actualModelConfig?.provider || provider,
          model_id: model,
          timestamp: new Date().toISOString(),
          // Add GraphRAG metadata if available
          ...(graphRAGMetadata?.metadata && {
            graphrag: {
              graph_used: graphRAGMetadata.metadata.graph_used,
              nodes_retrieved: graphRAGMetadata.metadata.nodes_retrieved,
              context_chunks_used: graphRAGMetadata.metadata.context_chunks_used,
              retrieval_time_ms: graphRAGMetadata.metadata.retrieval_time_ms,
              context_relevance_score: graphRAGMetadata.metadata.context_relevance_score,
              answer_grounded_in_graph: graphRAGMetadata.metadata.answer_grounded_in_graph,
              retrieval_method: graphRAGMetadata.metadata.searchMethod,
            }
          })
        };
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
      // Only show a deep research placeholder if a deep research job actually started.
      if (!finalResponse || finalResponse.trim().length === 0) {
        if (lastDeepResearchJobId) {
          finalResponse = `deep_research_started jobId: ${lastDeepResearchJobId}`;
        } else if (toolsCalled && toolsCalled.length > 0) {
          // If tools were called but no content generated, create a helpful summary
          const successCount = toolsCalled.filter(t => t.success).length;
          const failureCount = toolsCalled.filter(t => !t.success).length;
          const toolNames = toolsCalled.map(t => t.name).join(', ');
          
          finalResponse = `✓ Executed ${toolsCalled.length} tool(s): ${toolNames}\n\n`;
          if (failureCount > 0) {
            finalResponse += `⚠️ ${failureCount} tool(s) failed. Please check the results above.\n\n`;
          }
          finalResponse += `The operation completed. You can now proceed with your next request.`;
          
          console.log('[API] Generated tool execution summary:', finalResponse);
        } else {
          finalResponse = 'No content was generated by the model.';
        }
      }

      // METRIC: Calculate latency
      const latency_ms = Date.now() - startTime;
      console.log('[API] [LATENCY] Request completed in', latency_ms, 'ms');

      // ========================================================================
      // WIDGET MODE / BATCH TEST MODE: Save messages to database
      // ========================================================================
      if ((isWidgetMode || isBatchTestMode) && userId && widgetConversationId) {
        console.log('[API]', isWidgetMode ? 'Widget mode' : 'Batch test mode', ': Saving messages to database');
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

              // Record chat message usage (fire-and-forget, only for user messages)
              recordUsageEvent({
                userId: userId,
                metricType: 'chat_message',
                value: 1,
                resourceType: 'message',
                resourceId: widgetConversationId,
                metadata: {
                  conversation_id: widgetConversationId,
                  is_widget_mode: isWidgetMode || false,
                  is_batch_test_mode: isBatchTestMode || false,
                }
              }).catch(err => {
                console.error('[API] Failed to record chat usage:', err);
                // Don't fail the request if usage recording fails
              });
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
              ...(messageMetadata && { metadata: messageMetadata }),
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

            // End trace with success metrics
            if (traceContext && assistantMsgData?.id) {
              await traceService.endTrace(traceContext, {
                endTime: new Date(),
                status: 'completed',
                inputTokens: tokenUsage?.input_tokens,
                outputTokens: tokenUsage?.output_tokens,
              });
            }

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

            // Execute benchmark validators if benchmarkId is provided
            console.log('[API] Validator check:', { benchmarkId, hasAssistantMsgData: !!assistantMsgData, userId, condition: !!(benchmarkId && assistantMsgData && userId) });
            if (benchmarkId && assistantMsgData && userId) {
              try {
                console.log('[API] ✅ Executing benchmark validators:', benchmarkId);
                const { executeValidators } = await import('@/lib/evaluation/validators/executor');

                // Execute validators asynchronously (non-blocking)
                // Pass supabaseAdmin for authenticated operations (RLS bypass)
                executeValidators(
                  benchmarkId,
                  assistantMsgData.id,
                  finalResponse,
                  null, // contentJson - could parse if needed in future
                  userId,
                  supabaseAdmin  // Pass authenticated client
                ).catch(err => {
                  console.error('[API] Validator execution error (non-blocking):', err);
                });
              } catch (error) {
                console.error('[API] Error loading validator executor:', error);
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

              // 1. Basic heuristic judgment (fast, always runs)
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

              // 2. LLM judge evaluation (deep quality analysis, sampled)
              // Calculate heuristic score to determine if we should run LLM judge
              const heuristicScore = calculateBasicQualityScore(finalResponse);
              const shouldEvaluate = shouldEvaluateMessage(
                heuristicScore,
                finalResponse.length,
                0.1 // 10% sample rate by default (configurable via LLM_JUDGE_SAMPLE_RATE env)
              );

              if (shouldEvaluate) {
                evaluateWithLLMJudge({
                  messageId: assistantMsgData.id,
                  conversationId: widgetConversationId,
                  userId: userId || 'unknown',
                  prompt: userPrompt,
                  response: finalResponse,
                  modelId: selectedModelId || 'unknown',
                }).catch(err => {
                  console.error('[API] LLM Judge error (non-blocking):', err);
                });
              }
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
              model_name: actualModelConfig?.name || selectedModelId || model,
              provider: actualProvider
            });
            const modelData = `data: ${JSON.stringify({
              type: 'model_metadata',
              model_id: selectedModelId || model,
              model_name: actualModelConfig?.name || selectedModelId || model,
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
                  const payloadBase: Record<string, unknown> = { exp, cid: conversationId, savedOnly: true };
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
                query: lastDeepResearchQuery || null,
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
              await new Promise(resolve => setTimeout(resolve, parseInt(process.env.CHAT_STREAMING_CHUNK_DELAY_MS || '20', 10)));
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

      // Create metadata object for persistence (streaming path)
      const messageMetadata = {
        model_name: (actualModelConfig as unknown as { name?: string })?.name || selectedModelId || model || 'unknown',
        provider: (actualModelConfig as unknown as { provider?: string })?.provider || provider || 'unknown',
        model_id: selectedModelId || model || 'unknown',
        timestamp: new Date().toISOString(),
        // Add GraphRAG metadata if available
        ...(graphRAGMetadata?.metadata && {
          graphrag: {
            graph_used: graphRAGMetadata.metadata.graph_used,
            nodes_retrieved: graphRAGMetadata.metadata.nodes_retrieved,
            context_chunks_used: graphRAGMetadata.metadata.context_chunks_used,
            retrieval_time_ms: graphRAGMetadata.metadata.retrieval_time_ms,
            context_relevance_score: graphRAGMetadata.metadata.context_relevance_score,
            answer_grounded_in_graph: graphRAGMetadata.metadata.answer_grounded_in_graph,
            retrieval_method: graphRAGMetadata.metadata.searchMethod,
          }
        })
      };

      // Generate session tag for regular chat if needed (streaming path)
      let regularChatSessionTag: string | null = null;
      if (!isWidgetMode && !isBatchTestMode && conversationId && userId) {
        console.log('[API] [SESSION_TAG] [STREAMING] Checking session tag generation conditions:', {
          isWidgetMode,
          isBatchTestMode,
          conversationId,
          userId,
          selectedModelId
        });
        
        try {
          // Create service role client but filter by user_id for security
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
          
          const { data: conversation, error: convError } = await supabaseAuth
            .from('conversations')
            .select('session_id, llm_model_id')
            .eq('id', conversationId)
            .eq('user_id', userId)  // Security: Ensure user owns this conversation
            .single();
          
          console.log('[API] [SESSION_TAG] [STREAMING] Fetched conversation:', {
            conversation_id: conversationId,
            session_id: conversation?.session_id,
            llm_model_id: conversation?.llm_model_id,
            error: convError?.message
          });
          
          // Update llm_model_id if missing (first message in conversation)
          let modelIdToUse = conversation?.llm_model_id;
          if (conversation && !conversation.llm_model_id && selectedModelId) {
            console.log('[API] [SESSION_TAG] [STREAMING] Setting llm_model_id on conversation:', selectedModelId);
            const { error: updateError } = await supabaseAuth
              .from('conversations')
              .update({ llm_model_id: selectedModelId })
              .eq('id', conversationId)
              .eq('user_id', userId);  // Security: Ensure user owns this conversation
            
            if (updateError) {
              console.error('[API] [SESSION_TAG] [STREAMING] Failed to update llm_model_id:', updateError);
            } else {
              modelIdToUse = selectedModelId;
              console.log('[API] [SESSION_TAG] [STREAMING] Successfully set llm_model_id');
            }
          }
          
          if (conversation && !conversation.session_id && modelIdToUse) {
            console.log('[API] [SESSION_TAG] [STREAMING] Generating session tag with:', { userId, modelIdToUse });
            const sessionTag = await generateSessionTag(userId, modelIdToUse);
            console.log('[API] [SESSION_TAG] [STREAMING] Generated session tag:', sessionTag);
            
            if (sessionTag) {
              const { error: tagError } = await supabaseAuth
                .from('conversations')
                .update({
                  session_id: sessionTag.session_id,
                  experiment_name: sessionTag.experiment_name
                })
                .eq('id', conversationId)
                .eq('user_id', userId);  // Security: Ensure user owns this conversation
              
              if (tagError) {
                console.error('[API] [SESSION_TAG] [STREAMING] Failed to update session tag:', tagError);
              } else {
                regularChatSessionTag = sessionTag.session_id;
                console.log('[API] [SESSION_TAG] [STREAMING] Successfully set session tag:', regularChatSessionTag);
              }
            }
          } else {
            console.log('[API] [SESSION_TAG] [STREAMING] Skipping generation:', {
              hasConversation: !!conversation,
              hasSessionId: !!conversation?.session_id,
              hasModelId: !!modelIdToUse
            });
            
            if (conversation?.session_id) {
              regularChatSessionTag = conversation.session_id;
              console.log('[API] [SESSION_TAG] [STREAMING] Using existing session tag:', regularChatSessionTag);
            }
          }
        } catch (error) {
          console.error('[API] [SESSION_TAG] [STREAMING] Error in session tag flow:', error);
        }
      } else {
        console.log('[API] [SESSION_TAG] [STREAMING] Conditions not met for session tag generation:', {
          isWidgetMode,
          isBatchTestMode,
          hasConversationId: !!conversationId,
          hasUserId: !!userId
        });
      }

      // Start trace for streaming LLM operation
      traceContext = await traceService.startTrace({
        spanName: 'llm.completion.stream',
        operationType: 'llm_call',
        modelName: selectedModelId || model || undefined,
        modelProvider: (actualModelConfig as unknown as { provider?: string })?.provider || provider || undefined,
        conversationId: widgetConversationId || conversationId || undefined,
        sessionTag: widgetSessionTag || regularChatSessionTag || undefined,
      });

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
              model_name: actualModelConfig?.name || selectedModelId || model,
              provider: actualProvider
            });
            const modelData = `data: ${JSON.stringify({
              type: 'model_metadata',
              model_id: selectedModelId || model,
              model_name: actualModelConfig?.name || selectedModelId || model,
              provider: actualProvider
            })}\n\n`;
            controller.enqueue(encoder.encode(modelData));

            // Stream LLM output (plain text chunks)
            // Accumulate response for widget mode message saving
            let accumulatedResponse = '';
            const toolCallsTracking: Array<{name: string; success: boolean; error?: string}> = [];

            // Check if we need tool-aware streaming (OpenAI only)
            const needsToolStreaming = tools.length > 0 && provider === 'openai';

            if (needsToolStreaming) {
              // Use tool-aware streaming for OpenAI  
              // Note: streamOpenAIResponse handles tools but doesn't execute them during streaming
              // Tools are executed in the non-streaming path only
              console.log('[API] Using OpenAI streaming (tools will be executed in non-streaming mode)');
              const { streamOpenAIResponse } = await import('@/lib/llm/openai');
              
              for await (const chunk of streamOpenAIResponse(
                enhancedMessages,
                model,
                temperature,
                maxTokens,
                activeTools
              )) {
                accumulatedResponse += chunk;
                const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            } else {
              // Regular streaming (no tools or non-OpenAI)
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
                  if (isWidgetMode) {
                    console.log('[API] Widget mode (streaming): Falling back to legacy default model');
                    for await (const chunk of streamLLMResponse(
                      enhancedMessages,
                      model,
                      temperature,
                      maxTokens,
                      activeTools
                    )) {
                      accumulatedResponse += chunk;
                      const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
                      controller.enqueue(encoder.encode(data));
                    }
                    // After fallback streaming, continue to closing logic (no early return)
                  } else {
                    const errorData = `data: ${JSON.stringify({
                      error: `Model not found. Please select a different model from the dropdown. The selected model no longer exists or you don't have access to it.`
                    })}\n\n`;
                    controller.enqueue(encoder.encode(errorData));
                    controller.close();
                    return;
                  }
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
                maxTokens,
                activeTools
              )) {
                console.log('[API] [DEBUG] Streaming chunk (legacy), length:', chunk.length);
                accumulatedResponse += chunk;
                const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }
            } // End needsToolStreaming else block

            console.log('[API] [DEBUG] Streaming complete. Total accumulated response length:', accumulatedResponse.length);
            console.log('[API] [DEBUG] Response preview:', accumulatedResponse.substring(0, 200));

            // ========================================================================
            // WIDGET MODE / BATCH TEST MODE: Save messages to database after streaming
            // ========================================================================
            if ((isWidgetMode || isBatchTestMode) && userId && widgetConversationId && accumulatedResponse) {
              console.log('[API]', isWidgetMode ? 'Widget mode' : 'Batch test mode', '(streaming): Saving messages to database');
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

                  // Record chat message usage (fire-and-forget, only for user messages)
                  recordUsageEvent({
                    userId: userId,
                    metricType: 'chat_message',
                    value: 1,
                    resourceType: 'message',
                    resourceId: widgetConversationId,
                    metadata: {
                      conversation_id: widgetConversationId,
                      is_widget_mode: isWidgetMode || false,
                      is_batch_test_mode: isBatchTestMode || false,
                      is_streaming: true,
                    }
                  }).catch(err => {
                    console.error('[API] Failed to record chat usage (streaming):', err);
                    // Don't fail the request if usage recording fails
                  });
                }

                // Save assistant message with latency and token estimates
                const { data: streamMsgData } = await supabaseAdmin!
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
                    ...(messageMetadata && { metadata: messageMetadata }),
                  })
                  .select('id')
                  .single();
                console.log('[API] Widget mode (streaming): Assistant message saved with metrics');

                // End trace with streaming metrics
                if (traceContext && streamMsgData?.id) {
                  await traceService.endTrace(traceContext, {
                    endTime: new Date(),
                    status: 'completed',
                    inputTokens: estimatedInputTokens,
                    outputTokens: estimatedOutputTokens,
                  });
                }
              } catch (error) {
                console.error('[API] Widget mode (streaming): Error saving messages:', error);
                // Continue even if message saving fails
              }
            }

            // If nothing was accumulated (unexpected), send a short placeholder to avoid blank UI
            if (!accumulatedResponse || accumulatedResponse.trim().length === 0) {
              const placeholder = 'No content was generated by the model. This usually means the model only called tools without providing a response. Check the tool execution results above.';
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
