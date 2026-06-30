// API route for chat completions with streaming support
import { NextRequest } from 'next/server';
import { streamOpenAIResponse, runOpenAIWithToolCalls } from '@/lib/llm/openai';
import type { ChatMessage, ToolDefinition } from '@/lib/llm/openai';
import { streamAnthropicResponse, runAnthropicWithToolCalls } from '@/lib/llm/anthropic';
import { graphragService, graphragConfig } from '@/lib/graphrag';
import type { EmbedderConfig } from '@/lib/graphrag/graphiti/client';
import { executePortalChatTool, recordToolExecution } from '@/lib/tools/toolManager';
import type { EnhancedPrompt, SearchSource, GraphRAGRetrievalMetadata } from '@/lib/graphrag';
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
import { categorizeError as categorizeBatchError } from '@/lib/batch-testing/error-categorizer';
import { categorizeError as categorizeTraceError } from '@/lib/tracing/error-categorizer';
import { saveBasicJudgment } from '@/lib/batch-testing/evaluation-integration';
import { evaluateWithLLMJudge, shouldEvaluateMessage } from '@/lib/evaluation/llm-judge-integration';
import { calculateBasicQualityScore } from '@/lib/batch-testing/evaluation-integration';
import crypto from 'crypto';
import { traceService } from '@/lib/tracing/trace.service';
import type { TraceContext, RequestMetadata } from '@/lib/tracing/types';
import { normalizeWebSearchResults } from '@/lib/tools/web-search/result-normalizer';
import type { WebSearchDocument } from '@/lib/tools/web-search/types';
import { buildUserMcpToolset, type McpUserToolset } from '@/lib/tools/mcp/user-toolset';
import { signImageStreamToken } from '@/lib/tools/image-gen/stream-token';
import { getSharedMcpClientManager } from '@/lib/tools/mcp/client';
import { resolveChatUser } from '@/lib/chat/resolve-chat-user';
import {
  appendAttachmentContextToLatestUserMessage,
  ChatAttachmentError,
  claimChatAttachmentsForTurn,
  normalizeChatConversationId,
  markChatAttachmentsAttached,
  normalizeChatAttachmentIds,
  releaseClaimedChatAttachments,
  resolveChatAttachmentsForTurn,
  type ChatAttachmentDto,
  type ResolvedChatAttachments,
} from '@/lib/chat/attachments';
import { normalizeGenerationSettings, type RawGenerationSettings } from '@/lib/llm/generation-settings';
// DEPRECATED: import { recordUsageEvent } from '@/lib/usage/checker';
import { generateSessionTag } from '@/lib/session-tagging/generator';
import { completeTraceWithFullData, completeTraceBasic } from './trace-completion-helper';

// Use Node.js runtime instead of Edge for OpenAI SDK compatibility
export const runtime = 'nodejs';

type RawWebSearchDocument = {
  title?: string;
  url?: string;
  summary?: string;
  snippet?: string;
  source?: string;
  publishedAt?: string;
};

type WebSearchToolPayload = {
  results?: RawWebSearchDocument[];
  status?: string;
  jobId?: string | number;
};

type AssistantMessageMetadata = {
  model_name?: string;
  provider?: string;
  model_id?: string;
  timestamp: string;
  web_search_results?: WebSearchDocument[];
  attachment_ids?: string[];
  attachments?: ChatAttachmentDto[];
};

function isWebSearchDocument(value: unknown): value is RawWebSearchDocument {
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

// Max time to spend discovering a user's MCP tools before proceeding without them,
// so a slow/hung MCP server never stalls the chat request.
const MCP_DISCOVERY_DEADLINE_MS = 8000;
const MCP_PER_SERVER_DISCOVERY_DEADLINE_MS = 3000;

/** Run a user-scoped MCP tool, shaped like executePortalChatTool's result. */
async function runMcpToolCall(
  toolset: McpUserToolset,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: string | null; executionTimeMs: number }> {
  const started = Date.now();
  try {
    const data = await toolset.execute(toolName, args);
    return { data, error: null, executionTimeMs: Date.now() - started };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: Date.now() - started,
    };
  }
}

export async function POST(req: NextRequest) {
  // Declare variables outside try block for error handling access
  let isWidgetMode = false;
  let isBatchTestMode = false;
  let widgetConversationId: string | null = null;
  let regularChatSessionTag: string | null = null;
  let supabaseAdmin: SupabaseClient | null = null;
  let selectedModelId: string | null = null;
  let provider: string | null = null;
  let claimedChatAttachmentScope: {
    supabase: SupabaseClient;
    userId: string;
    conversationId: string;
    attachmentIds: string[];
  } | null = null;
  // Track last web_search tool results for progressive doc summaries (SSE)
  let lastWebSearchDocs: WebSearchDocument[] | null = null;
  let lastWebSearchQuery: string | null = null;
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

  function withWebSearchMetadata(metadata: AssistantMessageMetadata | undefined): AssistantMessageMetadata | undefined {
    if (!lastWebSearchDocs || lastWebSearchDocs.length === 0) {
      return metadata;
    }

    return {
      ...(metadata ?? { timestamp: new Date().toISOString() }),
      web_search_results: lastWebSearchDocs,
    };
  }

  function emitAttachmentMetadata(
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder,
    attachments: ResolvedChatAttachments | null,
  ): void {
    if (!attachments) return;
    const attachmentData = `data: ${JSON.stringify({
      type: 'attachment_metadata',
      attachment_ids: attachments.ids,
      attachments: attachments.attachments,
    })}\n\n`;
    controller.enqueue(encoder.encode(attachmentData));
  }

  async function releaseChatAttachmentClaim(): Promise<void> {
    if (!claimedChatAttachmentScope) return;
    const scope = claimedChatAttachmentScope;
    claimedChatAttachmentScope = null;
    try {
      await releaseClaimedChatAttachments(scope);
    } catch (error) {
      console.error('[API] Failed to release chat attachment claim:', error);
    }
  }

  async function finalizeChatAttachmentClaim(messageId?: string | null): Promise<void> {
    if (!claimedChatAttachmentScope) return;
    const scope = claimedChatAttachmentScope;
    await markChatAttachmentsAttached({
      ...scope,
      messageId,
    });
    claimedChatAttachmentScope = null;
  }

  try {
    // Generate unique request ID for tracking
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[API] [${requestId}] ========== NEW REQUEST START ==========`);

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
    let generationSettings: RawGenerationSettings | undefined;
    let rawAttachmentIds: unknown;
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
        generationSettings,
        attachmentIds: rawAttachmentIds,
      } = await req.json());

      // DEBUG: Log what we received from the request
      console.log(`[API] [${requestId}] [DEBUG-REQUEST-BODY] modelId from request body:`, modelId);
      console.log(`[API] [${requestId}] [DEBUG-REQUEST-BODY] conversationId from request body:`, conversationId);
      console.log(`[API] [${requestId}] [DEBUG-REQUEST-BODY] widgetSessionId from request body:`, widgetSessionId);
    } catch (jsonError) {
      console.log('[API] Request aborted or invalid JSON:', jsonError instanceof Error ? jsonError.message : 'Unknown error');
      // Return 499 (Client Closed Request) for aborted requests
      return new Response('Request aborted', { status: 499 });
    }

    const allowDeepResearch = enableDeepResearch === true;
    const normalizedGenerationSettings = normalizeGenerationSettings(generationSettings);
    const requestedTemperature = normalizedGenerationSettings.temperature;
    const requestedMaxOutputTokens = normalizedGenerationSettings.maxOutputTokens;
    const requestedTopP = normalizedGenerationSettings.topP;
    const requestedFrequencyPenalty = normalizedGenerationSettings.frequencyPenalty;
    const requestedPresencePenalty = normalizedGenerationSettings.presencePenalty;

    console.log('[API] ===== RECEIVED REQUEST =====');
    console.log('[API] contextInjectionEnabled:', contextInjectionEnabled);
    console.log('[API] typeof contextInjectionEnabled:', typeof contextInjectionEnabled);
    console.log('[API] contextInjectionEnabled === false:', contextInjectionEnabled === false);
    console.log('[API] contextInjectionEnabled !== false:', contextInjectionEnabled !== false);
    console.log('[API] requestUserId:', requestUserId ? 'present' : 'missing');
    console.log('[API] rawTools type:', typeof rawTools, 'isArray:', Array.isArray(rawTools), 'length:', Array.isArray(rawTools) ? rawTools.length : 'N/A');

    // Normalize model UUID for DB writes (allow human-readable names for routing logic)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const llmModelIdForDb: string | null = modelId && uuidRegex.test(modelId) ? modelId : null;

    let tools = Array.isArray(rawTools) ? rawTools.filter(isToolDefinition) : [];
    console.log('[API] After isToolDefinition filter, tools count:', tools.length);

    // Remove query_knowledge_graph tool if context injection is disabled
    if (contextInjectionEnabled === false) {
      const beforeCount = tools.length;
      tools = tools.filter((tool: ToolDefinition) => tool.function.name !== 'query_knowledge_graph');
      console.log('[API] Context injection OFF: Removed query_knowledge_graph tool (before:', beforeCount, 'after:', tools.length, ')');
    }
    console.log('[API] Final tools count before trace:', tools.length);
    console.log('[API] Final tools names:', tools.map(t => t.function.name));

    // Keep tools as-is for trace logging (empty array is meaningful)
    let activeTools = tools.length > 0 ? tools : undefined;
    const offeredToolNames = new Set(tools.map((tool) => tool.function.name));

    // For traces, always pass tools array (even if empty) to show what was available
    let toolsForTrace = tools;

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
    // True only for a VERIFIED session user (batch session token or trusted
    // service-role caller), NOT a request-body claim and NOT a public widget key.
    // Gates per-user MCP loading so neither a claimed id nor a public widget can
    // trigger connecting to that user's servers / decrypted auth.
    let isAuthenticatedUser = false;

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
      // NOTE: a widget API key is PUBLIC (read from the page URL), so it does NOT
      // make the user MCP-eligible; we must never expose the owner's MCP servers
      // or decrypted auth through a public widget. MCP loads only for verified
      // session auth (set in the batch branches below).
      console.log('[API] Widget mode: API key validated, user_id:', userId);
    } else if (isBatchTestMode && authHeader) {
      // Batch test mode: Check if this is service role authentication
      const userIdHeader = req.headers.get('X-User-Id');
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      const bearerToken = bearerMatch?.[1];

      if (userIdHeader && bearerToken === serviceRoleKey) {
        // Service role authentication from scheduler/background worker
        console.log('[API] Batch test mode: Service role authentication, user_id:', userIdHeader);

        // Validate that the user exists before accepting the user_id
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleClient = createClient(supabaseUrl, serviceRoleKey);

        // Use auth.admin.getUserById to validate user exists (works without profiles table)
        const { data: authUser, error: authUserError } = await serviceRoleClient.auth.admin.getUserById(userIdHeader);

        if (authUserError || !authUser?.user) {
          console.error('[API] Batch test mode: Invalid user_id in X-User-Id header:', userIdHeader, authUserError?.message);
          return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        userId = userIdHeader;
        isAuthenticatedUser = true;
        supabaseAdmin = serviceRoleClient;
      } else {
        // Regular user session token validation
        console.log('[API] Batch test mode: Validating user session token');

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
        isAuthenticatedUser = true;
        console.log('[API] Batch test mode: Session validated, user_id:', userId);

        // Use service role for RLS bypass
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      }
    } else {
      // Normal mode. Prefer a VERIFIED Supabase session if the client sent one; a
      // verified session is what makes the user trusted (e.g. eligible to load their
      // MCP servers) and wins over any body-supplied id. Falls back to the
      // (unverified) body userId otherwise, preserving existing behavior (no MCP).
      const resolved = await resolveChatUser({
        authHeader,
        requestUserId,
        memoryUserId: memory?.userId ?? null,
        verifySession: async (header) => {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
          const sessionClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: header } },
          });
          const { data: { user }, error } = await sessionClient.auth.getUser();
          return user && !error ? { id: user.id } : null;
        },
      });
      userId = resolved.userId;
      isAuthenticatedUser = resolved.isAuthenticated;
      if (!isAuthenticatedUser) {
        // A body-supplied conversation id is also untrusted without a verified
        // session. Drop it so normal-mode anonymous calls cannot load history,
        // infer model settings, create signed exports, or tag traces for another
        // user's conversation.
        conversationId = null;
      }

      // Create service role client for DB operations (bypasses RLS)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    }

    // SECURITY: generate_image writes per-user data (an image_jobs row + a storage
    // object in the user's folder, both under the service role), so a truthy-but-
    // UNVERIFIED userId (e.g. public widget mode, where userId is the owner's id
    // but isAuthenticatedUser is false) must not be able to start jobs as the owner.
    // Gate both the OFFERING and the execution allowlist on a verified session,
    // mirroring the MCP gate below.
    if (!isAuthenticatedUser) {
      tools = tools.filter((tool: ToolDefinition) => tool.function.name !== 'generate_image');
      activeTools = tools.length > 0 ? tools : undefined;
      toolsForTrace = tools;
      offeredToolNames.delete('generate_image');
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 });
    }

    let requestedAttachmentIds: string[] = [];
    try {
      requestedAttachmentIds = normalizeChatAttachmentIds(rawAttachmentIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid attachmentIds';
      return new Response(JSON.stringify({ error: message }), {
        status: error instanceof ChatAttachmentError ? error.status : 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let resolvedChatAttachments: ResolvedChatAttachments | null = null;
    if (requestedAttachmentIds.length > 0) {
      const latestUserMessage = messages[messages.length - 1];
      if (!isAuthenticatedUser || isWidgetMode || isBatchTestMode || !userId || !conversationId || !supabaseAdmin) {
        return new Response(JSON.stringify({ error: 'Attachments require an authenticated non-widget chat conversation' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (!latestUserMessage || latestUserMessage.role !== 'user' || typeof latestUserMessage.content !== 'string') {
        return new Response(JSON.stringify({ error: 'Attachments must be sent with a user message' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        conversationId = normalizeChatConversationId(conversationId);
        resolvedChatAttachments = await resolveChatAttachmentsForTurn({
          supabase: supabaseAdmin,
          userId,
          conversationId,
          attachmentIds: requestedAttachmentIds,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load chat attachments';
        return new Response(JSON.stringify({ error: message }), {
          status: error instanceof ChatAttachmentError ? error.status : 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    console.log('[API] Request with', messages.length, 'messages,', tools.length, 'tools');
    if (tools.length > 0) {
      console.log('[API] [DEBUG] Tools available to LLM:', tools.map((t: ToolDefinition) => t.function.name).join(', '));
    }

    // The user's per-request MCP toolset (built below, after auth + admin client).
    let mcpToolset: McpUserToolset | null = null;

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
    // MCP: build the requesting user's tools at request time (per-user, NEVER
    // global; see PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md). Runs only for an
    // AUTHENTICATED user (not a body-claimed id), now that the admin client is set
    // for every auth path. Bounded per server plus a final route-level deadline,
    // so a slow or misconfigured MCP server can't stall or break chat. Offer the
    // definitions here; route the calls through the user-scoped toolset in
    // toolCallHandler.
    // ========================================================================
    if (isAuthenticatedUser && userId && supabaseAdmin) {
      try {
        const buildPromise = buildUserMcpToolset(userId, supabaseAdmin, getSharedMcpClientManager(), {
          perServerTimeoutMs: MCP_PER_SERVER_DISCOVERY_DEADLINE_MS,
        });
        // If the deadline wins the race the build promise is abandoned; swallow any
        // later rejection so it can't surface as an unhandled rejection.
        buildPromise.catch(() => {});
        const toolset = await Promise.race([
          buildPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), MCP_DISCOVERY_DEADLINE_MS)),
        ]);
        if (!toolset) {
          console.warn('[API] MCP discovery exceeded deadline; continuing without MCP tools');
        } else {
          mcpToolset = toolset;
          const mcpDefs = mcpToolset.definitions();
          if (mcpDefs.length > 0) {
            tools.push(
              ...mcpDefs.map((def) => ({
                type: 'function' as const,
                function: {
                  name: def.name,
                  description: def.description,
                  parameters: def.parameters as Record<string, unknown>,
                },
              })),
            );
            activeTools = tools.length > 0 ? tools : undefined;
            toolsForTrace = tools;
            console.log('[API] MCP: injected', mcpDefs.length, 'user MCP tool(s)');
          }
        }
      } catch (mcpErr) {
        console.error('[API] MCP toolset build failed (continuing without MCP tools):', mcpErr);
      }
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
              // Store modelId (UUID or name) for session tag generation
              llm_model_id: modelId || llmModelIdForDb,
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
        // Use modelId which contains the actual model identifier (UUID or name)
        console.log('[API] ========== AUTO SESSION TAGGING CHECK (WIDGET/BATCH MODE) ==========');
        console.log('[API] Widget session:', {
          conversationId: conversation.id,
          hasSessionId: !!widgetSessionTag,
          currentSessionId: widgetSessionTag,
          userId,
          modelId
        });

        if (!widgetSessionTag && userId && modelId) {
          try {
            console.log('[API] ✅ Conditions met - generating session tag for widget');
            console.log('[API] Params:', { userId, modelId });
            const sessionTag = await generateSessionTag(userId, modelId);
            console.log('[API] generateSessionTag returned:', sessionTag);

            if (sessionTag) {
              const { error: updateError } = await supabaseAdmin!
                .from('conversations')
                .update({
                  session_id: sessionTag.session_id,
                  experiment_name: sessionTag.experiment_name
                })
                .eq('id', conversation.id);

              if (updateError) {
                console.error('[API] ❌ Failed to update widget conversation:', updateError);
              } else {
                widgetSessionTag = sessionTag.session_id;
                console.log('[API] ✅ Widget session tag saved:', widgetSessionTag);
              }
            } else {
              console.log('[API] ⚠️ Session tag generation returned null (model may not be tracked)');
            }
          } catch (error) {
            console.error('[API] ❌ Widget mode: Failed to generate session tag:', error);
          }
        } else {
          console.log('[API] ⚠️ Conditions NOT met for widget session tag:', {
            hasSessionTag: !!widgetSessionTag,
            hasUserId: !!userId,
            hasModelId: !!modelId
          });
        }
        console.log('[API] ========== END AUTO SESSION TAGGING CHECK ==========');
        
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
    const enhancedMessages: ChatMessage[] = [
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
        } catch (_settingsErr) {
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
              traceContext: traceContext ?? undefined, // Pass trace context for child span creation
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

    if (resolvedChatAttachments) {
      appendAttachmentContextToLatestUserMessage(enhancedMessages, resolvedChatAttachments.context);
      try {
        await claimChatAttachmentsForTurn({
          supabase: supabaseAdmin!,
          userId: userId!,
          conversationId: conversationId!,
          attachmentIds: resolvedChatAttachments.ids,
        });
        claimedChatAttachmentScope = {
          supabase: supabaseAdmin!,
          userId: userId!,
          conversationId: conversationId!,
          attachmentIds: resolvedChatAttachments.ids,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to claim chat attachments';
        return new Response(JSON.stringify({ error: message }), {
          status: error instanceof ChatAttachmentError ? error.status : 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.log('[API] Injected chat attachment context:', {
        attachmentCount: resolvedChatAttachments.attachments.length,
        injectedChars: resolvedChatAttachments.injectedChars,
      });
    }

    async function rejectIfAttachmentContextExceedsWindow(
      modelConfig: ModelConfig | null | undefined,
    ): Promise<Response | null> {
      if (!resolvedChatAttachments || !modelConfig?.context_length) return null;

      const estimatedInputTokens = Math.ceil(
        enhancedMessages.map((message) => message.content || '').join(' ').length / 4,
      );
      const minimumOutputTokens = 100;
      if (estimatedInputTokens + minimumOutputTokens <= modelConfig.context_length) {
        return null;
      }

      await releaseChatAttachmentClaim();
      return new Response(JSON.stringify({
        error: 'Attachment context is too large for the selected model context window',
        details: {
          estimatedInputTokens,
          contextLength: modelConfig.context_length,
          minimumOutputTokens,
          attachmentCount: resolvedChatAttachments.attachments.length,
        },
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // MODEL SELECTION LOGIC
    // Priority: 1) Request modelId, 2) Conversation model, 3) Default from config
    // ========================================================================
    selectedModelId = null;
    let useUnifiedClient = false;

    console.log(`[API] [${requestId}] [MODEL-SELECT] modelId from request:`, modelId, 'type:', typeof modelId);
    console.log(`[API] [${requestId}] [MODEL-SELECT] conversationId:`, conversationId, 'userId:', userId);

    // Option 1: Use modelId from request (new dynamic model registry)
    if (modelId) {
      console.log(`[API] [${requestId}] ✓ Using model from request:`, modelId);
      selectedModelId = modelId;
      useUnifiedClient = true;
      console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-1] selectedModelId set from request:`, selectedModelId);
    }
    // Option 2: Get model from conversation (if exists)
    else if (conversationId && userId) {
      try {
        const { data: conversation } = await (supabaseAdmin || supabase)
          .from('conversations')
          .select('llm_model_id, session_id')
          .eq('id', conversationId)
          .single();

        if (conversation?.llm_model_id) {
          console.log(`[API] [${requestId}] Using model from conversation:`, conversation.llm_model_id);
          selectedModelId = conversation.llm_model_id;
          useUnifiedClient = true;
          console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-2] selectedModelId set from conversation:`, selectedModelId);
        }
      } catch (error) {
        console.log('[API] Could not load conversation model:', error);
      }
    }

    // Auto-generate session tag if missing (first message in regular chat)
    // This runs AFTER model selection, regardless of whether model came from request or conversation
    if (conversationId && userId && !isWidgetMode) {
      try {
        const { data: conversation } = await (supabaseAdmin || supabase)
          .from('conversations')
          .select('llm_model_id, session_id')
          .eq('id', conversationId)
          .single();

        console.log('[API] ========== AUTO SESSION TAGGING CHECK (REGULAR CHAT) ==========');
        console.log('[API] Conversation:', {
          id: conversationId,
          hasSessionId: !!conversation?.session_id,
          currentSessionId: conversation?.session_id,
          llmModelId: conversation?.llm_model_id,
          selectedModelId
        });

        if (conversation && !conversation.session_id && selectedModelId) {
          try {
            console.log('[API] ✅ Conditions met - generating session tag');
            console.log('[API] Params:', { userId, selectedModelId });
            const sessionTag = await generateSessionTag(userId, selectedModelId);
            console.log('[API] generateSessionTag returned:', sessionTag);

            if (sessionTag) {
              const updateData: Record<string, unknown> = {
                session_id: sessionTag.session_id,
                experiment_name: sessionTag.experiment_name
              };
              if (!conversation.llm_model_id) {
                updateData.llm_model_id = selectedModelId;
              }

              const { error: updateError } = await (supabaseAdmin || supabase)
                .from('conversations')
                .update(updateData)
                .eq('id', conversationId);

              if (updateError) {
                console.error('[API] ❌ Failed to update conversation:', updateError);
              } else {
                console.log('[API] ✅ Session tag saved successfully:', sessionTag.session_id);
                regularChatSessionTag = sessionTag.session_id;
              }
            } else {
              console.log('[API] ⚠️ Session tag generation returned null (model may not be tracked)');
            }
          } catch (error) {
            console.error('[API] ❌ Regular chat: Failed to generate session tag:', error);
          }
        } else {
          console.log('[API] ⚠️ Conditions NOT met for session tag generation:', {
            hasConversation: !!conversation,
            hasSessionId: !!conversation?.session_id,
            hasSelectedModelId: !!selectedModelId
          });
        }
        console.log('[API] ========== END AUTO SESSION TAGGING CHECK ==========');
      } catch (error) {
        console.log('[API] Could not load conversation for session tagging:', error);
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
      tools?: ToolDefinition[],
      generationOptions?: {
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
      }
    ) => AsyncGenerator<string, void, unknown>;
    let runLLMWithToolCalls: (
      messages: ChatMessage[],
      model: string,
      temperature: number,
      maxTokens: number,
      tools: ToolDefinition[],
      toolCallHandler?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>,
      generationOptions?: {
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
      }
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

    // Ensure selectedModelId captures the actual model we will run
    if (!selectedModelId) {
      selectedModelId = model;
      console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-3] selectedModelId fallback to legacy config:`, selectedModelId);
    } else {
      console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-3] selectedModelId already set (no fallback):`, selectedModelId);
    }

    if (requestedTemperature !== undefined) {
      temperature = requestedTemperature;
    }
    if (requestedMaxOutputTokens !== undefined) {
      maxTokens = requestedMaxOutputTokens;
    }

    // Tool-call aware chat completion (provider-aware)
    let lastDeepResearchQuery: string | null = null;
    const imageStreamJobs: Array<{ jobId: string; prompt: string | null }> = [];
    const toolCallHandler = async (toolName: string, args: Record<string, unknown>) => {
      // Cap image generation to one job per chat turn. generate_image is async —
      // it returns a "started" ack, not an image — so models (esp. Haiku) tend to
      // re-call it, which would queue several real generations and hit the tool-
      // round cap. Once a job is queued this turn, short-circuit further calls with
      // a distinct status (NOT 'image_generation_started', so the capture block
      // below doesn't enqueue a duplicate) and a firm stop instruction.
      if (toolName === 'generate_image' && imageStreamJobs.length > 0) {
        const existing = imageStreamJobs[0];
        return {
          status: 'image_generation_already_started',
          message:
            `An image is already being generated for this request (job ${existing.jobId}). ` +
            `Do NOT call generate_image again — it will be delivered to the user automatically. ` +
            `Reply to the user with one short sentence confirming their image is on the way.`,
          jobId: existing.jobId,
        };
      }

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

      const toolStartTime = Date.now();
      // MCP tools are user-scoped and never in the global registry, so route them
      // through this user's toolset; everything else uses the portal executor
      // (which also enforces the offered-tool allowlist from main).
      const isMcpToolCall = mcpToolset?.has(toolName) === true;
      const activeMcpToolset = isMcpToolCall ? mcpToolset : null;
      const result = activeMcpToolset
        ? await runMcpToolCall(activeMcpToolset, toolName, args)
        : await executePortalChatTool(
            toolName,
            args,
            convId,
            undefined,
            userId || undefined,
            undefined,
            toolTraceContext,
            { allowedToolNames: offeredToolNames },
          );
      const toolExecutionTime = Date.now() - toolStartTime;

      if (isMcpToolCall) {
        await recordToolExecution({
          conversationId: convId,
          toolId: null,
          toolName,
          toolSource: 'mcp',
          inputParams: args,
          outputResult: result.data,
          errorMessage: result.error,
          executionTimeMs: result.executionTimeMs,
          metadata: { scoped: true },
        });
      }

      // Capture web_search results for SSE previews (standard search path only)
      try {
        if (toolName === 'web_search' && isWebSearchToolPayload(result.data)) {
          const { results, status, jobId } = result.data;
          if (Array.isArray(results)) {
            lastWebSearchDocs = normalizeWebSearchResults(results) ?? null;
            lastWebSearchQuery = typeof args.query === 'string' ? args.query : null;
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

      // Capture generate_image job id so the client can subscribe to its stream
      try {
        if (toolName === 'generate_image' && result.data && typeof result.data === 'object') {
          const imgResult = result.data as { status?: unknown; jobId?: unknown };
          if (imgResult.status === 'image_generation_started' && typeof imgResult.jobId === 'string') {
            imageStreamJobs.push({
              jobId: imgResult.jobId,
              prompt: typeof args.prompt === 'string' ? args.prompt : null,
            });
            console.log('[API] Captured image generation job id from tool result:', imgResult.jobId);
          }
        }
      } catch (capErr) {
        console.log('[API] Could not capture generate_image result for SSE:', capErr);
      }

      // ========================================================================
      // TRACE: End tool call span with structured data
      // ========================================================================
      if (toolTraceContext) {
        try {
          const { truncateObject } = await import('@/lib/tracing/trace-utils');

          const toolDef = tools?.find(t => t.function.name === toolName);

          const inputData = {
            toolName,
            arguments: truncateObject(args, 5) as Record<string, unknown>,
            toolDescription: toolDef?.function.description,
          };

          if (result.error) {
            await traceService.endTrace(toolTraceContext, {
              endTime: new Date(),
              status: 'failed',
              inputData,
              errorMessage: String(result.error),
              errorType: 'ToolExecutionError',
              metadata: {
                executionTimeMs: toolExecutionTime,
              },
            });
            console.log(`[Trace] Tool call failed: ${toolName} (${toolExecutionTime}ms)`);
          } else {
            const outputData = {
              result: truncateObject(result.data, 10),
              executionStatus: 'success',
              executionTimeMs: toolExecutionTime,
            };

            await traceService.endTrace(toolTraceContext, {
              endTime: new Date(),
              status: 'completed',
              inputData,
              outputData,
              metadata: {
                resultType: typeof result.data,
                hasResults: result.data !== null && result.data !== undefined,
              },
            });
            console.log(`[Trace] Tool call completed: ${toolName} (${toolExecutionTime}ms)`);
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
    let effectiveTraceTemperature = temperature;
    let effectiveTraceMaxTokens = maxTokens;

    // ========================================================================
    // THINKING MODE: Add <think> tag for reasoning models (Qwen3, etc.)
    // When enabled, prepend <think> to the last user message to trigger
    // step-by-step reasoning with <think>...</think> output blocks
    // ========================================================================
    if (enableThinking) {
      console.log('[API] Thinking mode enabled - adding <think> instruction');
      // Add thinking instruction to system prompt
      const thinkingInstruction = `\n\nIMPORTANT: You have thinking mode enabled. Before answering, reason through the problem step-by-step inside <think>...</think> tags. Show your complete reasoning process, then provide your final answer after the </think> tag.`;

      if (enhancedMessages.length > 0 && enhancedMessages[0].role === 'system') {
        const currentContent = enhancedMessages[0].content || '';
        enhancedMessages[0] = {
          ...enhancedMessages[0],
          content: currentContent + thinkingInstruction
        };
      }
    }

    // Branch: Use non-streaming for ALL tool-enabled requests
    // NOTE: OpenAI technically supports streaming + tools, but our streaming adapter's parseStreamChunk
    // only extracts delta.content and ignores delta.tool_calls. When the model decides to call a tool
    // (e.g., calculator for "50*2"), no content is generated and the response appears empty.
    // To properly handle mixed queries (math + RAG), we must use non-streaming for tool requests.
    const requiresNonStreaming = forceNonStreaming || tools.length > 0;
    
    if (requiresNonStreaming) {
      // NON-STREAMING PATH: Execute tools and get complete response
      console.log('[API] Using non-streaming tool-aware path');
      console.log('[API] Route decision: tools=', tools.length > 0, 'forceNonStreaming=', !!forceNonStreaming, 'provider=', provider);

      // METRIC: Start latency tracking
      const startTime = Date.now();
      console.log('[API] [LATENCY] Request started at:', startTime);

      let llmResponse;
      let messageMetadata: AssistantMessageMetadata | undefined;

      // Use UnifiedLLMClient if model is selected from registry
      console.log('[API] [MODEL-SELECT] useUnifiedClient:', useUnifiedClient, 'selectedModelId:', selectedModelId);
      if (useUnifiedClient && selectedModelId) {
        console.log('[API] ✓✓✓ Using UnifiedLLMClient with model:', selectedModelId);

        // Load model config to get actual provider for metadata
        // Pass supabaseAdmin to ensure access to user-specific models (bypasses RLS)
        console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-4A] Calling getModelConfig with selectedModelId:`, selectedModelId);
        actualModelConfig = await modelManager.getModelConfig(selectedModelId, userId || undefined, supabaseAdmin || undefined);
        if (actualModelConfig) {
          console.log(`[API] [${requestId}] Model config loaded - actual provider:`, actualModelConfig.provider);
          console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-4B] getModelConfig returned:`, { id: actualModelConfig.id, name: actualModelConfig.name, provider: actualModelConfig.provider, model_id: actualModelConfig.model_id });
        } else {
          console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-4B] getModelConfig returned NULL for selectedModelId:`, selectedModelId);
        }

        const attachmentWindowResponse = await rejectIfAttachmentContextExceedsWindow(actualModelConfig);
        if (attachmentWindowResponse) return attachmentWindowResponse;

        // Create metadata object for persistence
        console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-5] Creating message metadata with selectedModelId:`, selectedModelId);
        console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-5] actualModelConfig for metadata:`, actualModelConfig ? { id: actualModelConfig.id, name: actualModelConfig.name, provider: actualModelConfig.provider } : 'null');
        messageMetadata = {
          model_name: actualModelConfig?.name || selectedModelId,
          provider: actualModelConfig?.provider || provider,
          model_id: selectedModelId,
          timestamp: new Date().toISOString(),
          ...(resolvedChatAttachments && {
            attachment_ids: resolvedChatAttachments.ids,
            attachments: resolvedChatAttachments.attachments,
          }),
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
              // Store citations for batch testing display
              ...(graphRAGMetadata.sources && {
                citations: graphRAGMetadata.sources.slice(0, 10).map(s => ({
                  source: s.sourceDescription || s.entity || 'Unknown',
                  content: (s.fact || '').slice(0, 200),
                  confidence: s.confidence,
                }))
              })
            }
          })
        };

        const effectiveTemperature = requestedTemperature ?? actualModelConfig?.default_temperature ?? temperature;
        const configuredOutputLimit = typeof actualModelConfig?.max_output_tokens === 'number' && actualModelConfig.max_output_tokens > 0
          ? actualModelConfig.max_output_tokens
          : undefined;
        const requestedOrModelMaxTokens = requestedMaxOutputTokens ?? configuredOutputLimit ?? maxTokens;

        // Calculate safe max_tokens based on the model's output cap and context window.
        let safeMaxTokens = configuredOutputLimit
          ? Math.min(requestedOrModelMaxTokens, configuredOutputLimit)
          : requestedOrModelMaxTokens;
        if (actualModelConfig?.context_length) {
          // Estimate input tokens (rough: 1 token ≈ 4 chars)
          const inputText = enhancedMessages.map(m => m.content).join(' ');
          const estimatedInputTokens = Math.ceil(inputText.length / 4);

          // Calculate available space for output
          const availableTokens = actualModelConfig.context_length - estimatedInputTokens;

          // Use the minimum of requested/output-capped and available, with safety margin
          const safetyMargin = 100; // Reserve tokens for tool calls, formatting, etc.
          safeMaxTokens = Math.min(safeMaxTokens, Math.max(100, availableTokens - safetyMargin));

          console.log('[API] Context calculation:', {
            modelContextLength: actualModelConfig.context_length,
            estimatedInputTokens,
            availableTokens,
            requestedMaxTokens: requestedOrModelMaxTokens,
            configuredOutputLimit,
            adjustedMaxTokens: safeMaxTokens
          });
        }
        effectiveTraceTemperature = effectiveTemperature;
        effectiveTraceMaxTokens = safeMaxTokens;

        // Start trace for LLM operation
        console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-4] About to start trace with selectedModelId:`, selectedModelId);
        console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-4] Provider:`, actualModelConfig?.provider || provider);
        console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-4] actualModelConfig:`, actualModelConfig ? { id: actualModelConfig.id, name: actualModelConfig.name, provider: actualModelConfig.provider } : 'null');
        traceContext = await traceService.startTrace({
          spanName: 'llm.completion',
          operationType: 'llm_call',
          modelName: selectedModelId,
          modelProvider: actualModelConfig?.provider || provider || undefined,
          conversationId: widgetConversationId || conversationId || undefined,
          sessionTag: widgetSessionTag || regularChatSessionTag || undefined,
          userId: userId || undefined,
        });

        try {
          llmResponse = await unifiedLLMClient.chat(
            selectedModelId,
            enhancedMessages,
            {
              tools: activeTools,
              temperature: effectiveTemperature,
              maxTokens: safeMaxTokens,
              topP: requestedTopP,
              frequencyPenalty: requestedFrequencyPenalty,
              presencePenalty: requestedPresencePenalty,
              userId: userId || undefined,
              toolCallHandler,
              enableThinking,
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
                effectiveTemperature,
                safeMaxTokens,
                tools,
                toolCallHandler,
                {
                  topP: requestedTopP,
                  frequencyPenalty: requestedFrequencyPenalty,
                  presencePenalty: requestedPresencePenalty,
                }
              );
              // Load model config for metadata (legacy path)
              try {
                actualModelConfig = await modelManager.getModelConfig(model, userId || undefined, supabaseAdmin || undefined);
              } catch {}
              messageMetadata = {
                model_name: actualModelConfig?.name || model,
                provider: actualModelConfig?.provider || provider,
                model_id: model,
                timestamp: new Date().toISOString(),
                ...(resolvedChatAttachments && {
                  attachment_ids: resolvedChatAttachments.ids,
                  attachments: resolvedChatAttachments.attachments,
                }),
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
                    // Store citations for batch testing display
                    ...(graphRAGMetadata.sources && {
                      citations: graphRAGMetadata.sources.slice(0, 10).map(s => ({
                        source: s.sourceDescription || s.entity || 'Unknown',
                        content: (s.fact || '').slice(0, 200),
                        confidence: s.confidence,
                      }))
                    })
                  }
                })
              };
            } else {
              // End trace before early return
              if (traceContext) {
                await traceService.endTrace(traceContext, {
                  endTime: new Date(),
                  status: 'failed',
                  errorMessage: `Model not found: ${selectedModelId}`,
                  errorType: 'ModelNotFoundError'
                });
              }

              await releaseChatAttachmentClaim();
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

            // End trace before early return
            if (traceContext) {
              await traceService.endTrace(traceContext, {
                endTime: new Date(),
                status: 'failed',
                errorMessage: `Authentication failed for ${providerName}`,
                errorType: 'AuthenticationError'
              });
            }

            await releaseChatAttachmentClaim();
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
        console.log('[API] ⚠️ Using legacy provider-specific path (LIMITED METADATA) - model:', model);
        console.log('[API] ⚠️ Why legacy? useUnifiedClient:', useUnifiedClient, 'selectedModelId:', selectedModelId);

        // Load model config before the legacy call so generation controls still honor model caps.
        try {
          actualModelConfig = await modelManager.getModelConfig(model, userId || undefined, supabaseAdmin || undefined);
          if (actualModelConfig) {
            console.log('[API] [LEGACY] Model config loaded - actual provider:', actualModelConfig.provider);
          }
        } catch (_error) {
          console.log('[API] [LEGACY] Could not load model config, using model string:', model);
        }

        const attachmentWindowResponse = await rejectIfAttachmentContextExceedsWindow(actualModelConfig);
        if (attachmentWindowResponse) return attachmentWindowResponse;

        const effectiveTemperature = requestedTemperature ?? actualModelConfig?.default_temperature ?? temperature;
        const configuredOutputLimit = typeof actualModelConfig?.max_output_tokens === 'number' && actualModelConfig.max_output_tokens > 0
          ? actualModelConfig.max_output_tokens
          : undefined;
        const requestedOrModelMaxTokens = requestedMaxOutputTokens ?? configuredOutputLimit ?? maxTokens;
        let safeMaxTokens = configuredOutputLimit
          ? Math.min(requestedOrModelMaxTokens, configuredOutputLimit)
          : requestedOrModelMaxTokens;

        if (actualModelConfig?.context_length) {
          const inputText = enhancedMessages.map(m => m.content).join(' ');
          const estimatedInputTokens = Math.ceil(inputText.length / 4);
          const availableTokens = actualModelConfig.context_length - estimatedInputTokens;
          const safetyMargin = 100;
          safeMaxTokens = Math.min(safeMaxTokens, Math.max(100, availableTokens - safetyMargin));

          console.log('[API] Legacy context calculation:', {
            modelContextLength: actualModelConfig.context_length,
            estimatedInputTokens,
            availableTokens,
            configuredOutputLimit,
            adjustedMaxTokens: safeMaxTokens
          });
        }
        effectiveTraceTemperature = effectiveTemperature;
        effectiveTraceMaxTokens = safeMaxTokens;

        // Start trace for legacy LLM operation
        traceContext = await traceService.startTrace({
          spanName: 'llm.completion',
          operationType: 'llm_call',
          modelName: model,
          modelProvider: provider || undefined,
          conversationId: widgetConversationId || conversationId || undefined,
          sessionTag: widgetSessionTag || regularChatSessionTag || undefined,
          userId: userId || undefined,
        });

        llmResponse = await runLLMWithToolCalls(
          enhancedMessages,
          model,
          effectiveTemperature,
          safeMaxTokens,
          tools,
          toolCallHandler,
          {
            topP: requestedTopP,
            frequencyPenalty: requestedFrequencyPenalty,
            presencePenalty: requestedPresencePenalty,
          }
        );

        // Create metadata object for persistence (legacy path)
        messageMetadata = {
          model_name: actualModelConfig?.name || model,
          provider: actualModelConfig?.provider || provider,
          model_id: model,
          timestamp: new Date().toISOString(),
          ...(resolvedChatAttachments && {
            attachment_ids: resolvedChatAttachments.ids,
            attachments: resolvedChatAttachments.attachments,
          }),
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
              // Store citations for batch testing display
              ...(graphRAGMetadata.sources && {
                citations: graphRAGMetadata.sources.slice(0, 10).map(s => ({
                  source: s.sourceDescription || s.entity || 'Unknown',
                  content: (s.fact || '').slice(0, 200),
                  confidence: s.confidence,
                }))
              })
            }
          })
        };
      }

      // METRIC: Extract content, usage, and tool tracking based on response structure
      let finalResponse: string;
      let reasoning: string | undefined;
      let tokenUsage: { input_tokens: number; output_tokens: number } | null = null;
      let toolsCalled: Array<{name: string; success: boolean; error?: string}> | null = null;
      let requestMetadata: RequestMetadata | undefined;
      // Both OpenAI and Anthropic now return LLMResponse { content, usage, toolsCalled, reasoning }
      if (typeof llmResponse === 'object' && 'content' in llmResponse && 'usage' in llmResponse) {
        finalResponse = llmResponse.content;
        reasoning = (llmResponse as { reasoning?: string }).reasoning;
        tokenUsage = llmResponse.usage;
        toolsCalled = (llmResponse as { toolsCalled?: Array<{name: string; success: boolean; error?: string}> }).toolsCalled || null;
        requestMetadata = (llmResponse as { requestMetadata?: RequestMetadata }).requestMetadata;

        // If requestMetadata is undefined (legacy path), add basic metadata
        if (!requestMetadata && !useUnifiedClient) {
          const legacyApiEndpoint = provider === 'openai'
            ? 'https://api.openai.com/v1/chat/completions'
            : provider === 'anthropic'
            ? 'https://api.anthropic.com/v1/messages'
            : undefined;

          if (legacyApiEndpoint) {
            requestMetadata = {
              apiEndpoint: legacyApiEndpoint,
              apiBaseUrl: legacyApiEndpoint.split('/v1')[0],
              requestHeadersSanitized: {
                'Content-Type': 'application/json',
                'Authorization': '[REDACTED]',
              },
            };
            console.log('[API] Legacy non-streaming: Captured basic metadata:', {
              endpoint: legacyApiEndpoint,
              provider,
            });
          }
        }

        console.log('[API] Token usage:', tokenUsage.input_tokens, 'in,', tokenUsage.output_tokens, 'out');
        if (reasoning) {
          console.log('[API] Reasoning/thinking:', reasoning.length, 'chars');
          // If we have reasoning AND content, prepend reasoning in think tags
          if (finalResponse && finalResponse.trim().length > 0) {
            finalResponse = `<think>\n${reasoning}\n</think>\n\n${finalResponse}`;
            console.log('[API] Combined reasoning with response content');
          }
        }
        if (toolsCalled) {
          const successCount = toolsCalled.filter(t => t.success).length;
          console.log('[API] Tools called:', toolsCalled.length, 'total,', successCount, 'succeeded');
        }
      } else {
        // Fallback for legacy string responses
        finalResponse = llmResponse as string;

        // Add basic metadata for legacy string responses
        if (!useUnifiedClient) {
          const legacyApiEndpoint = provider === 'openai'
            ? 'https://api.openai.com/v1/chat/completions'
            : provider === 'anthropic'
            ? 'https://api.anthropic.com/v1/messages'
            : undefined;

          if (legacyApiEndpoint) {
            requestMetadata = {
              apiEndpoint: legacyApiEndpoint,
              apiBaseUrl: legacyApiEndpoint.split('/v1')[0],
              requestHeadersSanitized: {
                'Content-Type': 'application/json',
                'Authorization': '[REDACTED]',
              },
            };
            console.log('[API] Legacy string response: Captured basic metadata:', {
              endpoint: legacyApiEndpoint,
              provider,
            });
          }
        }
      }

      // Ensure we never stream an empty assistant message
      // Only show a deep research placeholder if a deep research job actually started.
      if (!finalResponse || finalResponse.trim().length === 0) {
        if (lastDeepResearchJobId) {
          finalResponse = `deep_research_started jobId: ${lastDeepResearchJobId}`;
        } else if (reasoning && reasoning.trim().length > 0) {
          // If thinking/reasoning was generated but no final response, wrap it for display
          finalResponse = `<think>\n${reasoning}\n</think>\n\n_Note: The model generated thinking content but no final response. Please ask the question again or try with thinking disabled._`;
          console.log('[API] Using reasoning as fallback content:', reasoning.length, 'chars');
        } else if (toolsCalled && toolsCalled.length > 0) {
          // If tools were called but no content generated, create a helpful summary
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

              // DEPRECATED: OLD usage tracking system
              // Now using usage_meters table via increment_root_trace_count()
              // recordUsageEvent({
              //   userId: userId,
              //   metricType: 'chat_message',
              //   value: 1,
              //   resourceType: 'message',
              //   resourceId: widgetConversationId,
              //   metadata: {
              //     conversation_id: widgetConversationId,
              //     is_widget_mode: isWidgetMode || false,
              //     is_batch_test_mode: isBatchTestMode || false,
              //   }
              // }).catch(err => {
              //   console.error('[API] Failed to record chat usage:', err);
              //   // Don't fail the request if usage recording fails
              // });
            }
          }

          // Save assistant message with metrics
          const assistantMessageMetadata = withWebSearchMetadata(messageMetadata);
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
              ...(assistantMessageMetadata && { metadata: assistantMessageMetadata }),
            })
            .select('id')
            .single();

          if (assistantMsgError) {
            console.error('[API] Widget mode: Failed to save assistant message:', assistantMsgError);

            // End trace even if message save failed
            if (traceContext) {
              await completeTraceBasic(traceContext, tokenUsage ?? undefined);
            }
          } else {
            console.log('[API] Widget mode: Assistant message saved');
            console.log('[API] [METRICS] Saved message with metrics:', {
              latency_ms,
              input_tokens: tokenUsage?.input_tokens,
              output_tokens: tokenUsage?.output_tokens,
              tools_called: toolsCalled?.length || 0,
              tool_success: toolsCalled?.every(t => t.success)
            });

            // End trace with comprehensive data
            if (traceContext && assistantMsgData?.id) {
              await completeTraceWithFullData({
                traceContext,
                finalResponse,
                enhancedMessages,
                messageId: assistantMsgData.id,
                tokenUsage: tokenUsage ?? undefined,
                selectedModelId,
                temperature: effectiveTraceTemperature,
                maxTokens: effectiveTraceMaxTokens,
                tools: toolsForTrace,
                toolsCalled: toolsCalled ?? undefined,
                reasoning,
                latencyMs: latency_ms,
                requestMetadata,
                ragContext: graphRAGMetadata ? {
                  contextTokens: graphRAGMetadata.estimatedTokens,
                  retrievalLatencyMs: graphRAGMetadata.metadata?.retrieval_time_ms,
                  graphUsed: graphRAGMetadata.metadata?.graph_used,
                  nodesRetrieved: graphRAGMetadata.metadata?.nodes_retrieved,
                  chunksUsed: graphRAGMetadata.metadata?.context_chunks_used,
                  relevanceScore: graphRAGMetadata.metadata?.context_relevance_score,
                  answerGrounded: graphRAGMetadata.metadata?.answer_grounded_in_graph,
                  retrievalMethod: graphRAGMetadata.metadata?.searchMethod,
                } : undefined,
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
                benchmarkId: benchmarkId || undefined,  // Link to benchmark if provided
                traceId: traceContext?.traceId,  // Link to trace if available
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
                  traceId: traceContext?.traceId,
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
      } else if (traceContext) {
        // Regular chat non-streaming - end trace with full data
        console.log('[API] Regular chat (non-streaming): Ending trace');
        await completeTraceWithFullData({
          traceContext,
          finalResponse,
          enhancedMessages,
          tokenUsage: tokenUsage ?? undefined,
          selectedModelId,
          temperature: effectiveTraceTemperature,
          maxTokens: effectiveTraceMaxTokens,
          tools: toolsForTrace,
          toolsCalled: toolsCalled ?? undefined,
          reasoning,
          latencyMs: latency_ms,
          requestMetadata,
          ragContext: graphRAGMetadata ? {
            contextTokens: graphRAGMetadata.estimatedTokens,
            retrievalLatencyMs: graphRAGMetadata.metadata?.retrieval_time_ms,
          } : undefined,
        });
      }

      await finalizeChatAttachmentClaim();

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
                graphrag_tokens: graphRAGMetadata.estimatedTokens || 0,
                // Detailed GraphRAG retrieval analytics
                graphrag_used: graphRAGMetadata.metadata?.graph_used ?? false,
                graphrag_nodes: graphRAGMetadata.metadata?.nodes_retrieved ?? 0,
                graphrag_chunks: graphRAGMetadata.metadata?.context_chunks_used ?? 0,
                graphrag_retrieval_ms: graphRAGMetadata.metadata?.retrieval_time_ms ?? 0,
                graphrag_relevance: graphRAGMetadata.metadata?.context_relevance_score ?? 0,
                graphrag_grounded: graphRAGMetadata.metadata?.answer_grounded_in_graph ?? false,
                graphrag_method: graphRAGMetadata.metadata?.searchMethod ?? 'hybrid',
              })}\n\n`;
              controller.enqueue(encoder.encode(metaData));
            }

            emitAttachmentMetadata(controller, encoder, resolvedChatAttachments);

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

            // Emit structured standard web-search results before the final answer text.
            if (lastWebSearchDocs && Array.isArray(lastWebSearchDocs) && lastWebSearchDocs.length > 0) {
              const resultsData = `data: ${JSON.stringify({
                type: 'web_search_results',
                query: lastWebSearchQuery,
                results: lastWebSearchDocs,
              })}\n\n`;
              controller.enqueue(encoder.encode(resultsData));
            }

            // Phase 3: Progressive per-document summaries (legacy preview event)
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

            // Surface an image-generation job id so the client can subscribe to
            // its stream (does not rely on the model echoing the magic string).
            // Mint a short-lived, job-scoped stream token here rather than letting
            // the client forward its session token in the SSE URL (#72 MINOR).
            // generate_image only runs for a verified user (route gate), so userId
            // is the authenticated owner.
            if (imageStreamJobs.length > 0 && userId) {
              for (const imageJob of imageStreamJobs) {
                const streamToken = signImageStreamToken({ jobId: imageJob.jobId, userId });
                const imageStartData = `data: ${JSON.stringify({
                  type: 'image_generation_started',
                  jobId: imageJob.jobId,
                  prompt: imageJob.prompt,
                  streamToken,
                })}\n\n`;
                controller.enqueue(encoder.encode(imageStartData));
              }
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

      // Load model config if using UnifiedClient (to get correct provider)
      if (useUnifiedClient && selectedModelId && !actualModelConfig) {
        try {
          console.log('[API] [STREAMING] Loading model config for:', selectedModelId);
          actualModelConfig = await modelManager.getModelConfig(selectedModelId, userId || undefined, supabaseAdmin || undefined);
          if (actualModelConfig) {
            console.log('[API] [STREAMING] Model config loaded - actual provider:', actualModelConfig.provider);
          } else {
            console.log('[API] [STREAMING] Model config not found for:', selectedModelId);
          }
        } catch (configError) {
          console.error('[API] [STREAMING] Error loading model config:', configError);
          // Continue without model config - will use fallback provider
        }
      }

      const attachmentWindowResponse = await rejectIfAttachmentContextExceedsWindow(actualModelConfig);
      if (attachmentWindowResponse) return attachmentWindowResponse;

      const effectiveTemperature = requestedTemperature ?? actualModelConfig?.default_temperature ?? temperature;
      const configuredOutputLimit = typeof actualModelConfig?.max_output_tokens === 'number' && actualModelConfig.max_output_tokens > 0
        ? actualModelConfig.max_output_tokens
        : undefined;
      let effectiveMaxTokens = requestedMaxOutputTokens ?? configuredOutputLimit ?? maxTokens;
      if (configuredOutputLimit) {
        effectiveMaxTokens = Math.min(effectiveMaxTokens, configuredOutputLimit);
      }

      if (actualModelConfig?.context_length) {
        const inputText = enhancedMessages.map(m => m.content).join(' ');
        const estimatedInputTokens = Math.ceil(inputText.length / 4);
        const availableTokens = actualModelConfig.context_length - estimatedInputTokens;
        const safetyMargin = 100;
        effectiveMaxTokens = Math.min(effectiveMaxTokens, Math.max(100, availableTokens - safetyMargin));

        console.log('[API] Streaming context calculation:', {
          modelContextLength: actualModelConfig.context_length,
          estimatedInputTokens,
          availableTokens,
          configuredOutputLimit,
          adjustedMaxTokens: effectiveMaxTokens
        });
      }
      effectiveTraceTemperature = effectiveTemperature;
      effectiveTraceMaxTokens = effectiveMaxTokens;

      // Create metadata object for persistence (streaming path)
      const messageMetadata: AssistantMessageMetadata = {
        model_name: (actualModelConfig as unknown as { name?: string })?.name || selectedModelId || model || 'unknown',
        provider: (actualModelConfig as unknown as { provider?: string })?.provider || provider || 'unknown',
        model_id: selectedModelId || model || 'unknown',
        timestamp: new Date().toISOString(),
        ...(resolvedChatAttachments && {
          attachment_ids: resolvedChatAttachments.ids,
          attachments: resolvedChatAttachments.attachments,
        }),
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
            // Store citations for batch testing display
            ...(graphRAGMetadata.sources && {
              citations: graphRAGMetadata.sources.slice(0, 10).map(s => ({
                source: s.sourceDescription || s.entity || 'Unknown',
                content: (s.fact || '').slice(0, 200),
                confidence: s.confidence,
              }))
            })
          }
        })
      };

      // Start trace for streaming LLM operation
      traceContext = await traceService.startTrace({
        spanName: 'llm.completion.stream',
        operationType: 'llm_call',
        modelName: selectedModelId || model || undefined,
        modelProvider: (actualModelConfig as unknown as { provider?: string })?.provider || provider || undefined,
        conversationId: widgetConversationId || conversationId || undefined,
        sessionTag: widgetSessionTag || regularChatSessionTag || undefined,
        userId: userId || undefined,
      });

      const stream = new ReadableStream({
        async start(controller) {
          // Variable to capture request metadata from streaming client
          let capturedRequestMetadata: RequestMetadata | undefined;
          let firstChunkReceived = false;

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
                graphrag_tokens: graphRAGMetadata.estimatedTokens || 0,
                // Detailed GraphRAG retrieval analytics
                graphrag_used: graphRAGMetadata.metadata?.graph_used ?? false,
                graphrag_nodes: graphRAGMetadata.metadata?.nodes_retrieved ?? 0,
                graphrag_chunks: graphRAGMetadata.metadata?.context_chunks_used ?? 0,
                graphrag_retrieval_ms: graphRAGMetadata.metadata?.retrieval_time_ms ?? 0,
                graphrag_relevance: graphRAGMetadata.metadata?.context_relevance_score ?? 0,
                graphrag_grounded: graphRAGMetadata.metadata?.answer_grounded_in_graph ?? false,
                graphrag_method: graphRAGMetadata.metadata?.searchMethod ?? 'hybrid',
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
            let ttftMs: number | undefined;

            console.log('[STREAMING PATH DEBUG]', {
              toolsLength: tools.length,
              provider,
              useUnifiedClient,
              selectedModelId,
            });

            // PRIORITY 1: Use UnifiedLLMClient if model is selected from registry
            // This handles both regular streaming AND tool-aware streaming with metadata capture
            if (useUnifiedClient && selectedModelId) {
              console.log('[API] ✓ Streaming with UnifiedLLMClient (WITH METADATA CAPTURE), model:', selectedModelId);
              console.log('[API]   Tools provided:', tools.length > 0 ? `Yes (${tools.length})` : 'No');
              try {
                for await (const chunk of unifiedLLMClient.stream(
                  selectedModelId,
                  enhancedMessages,
                  {
                    temperature: effectiveTemperature,
                    maxTokens: effectiveMaxTokens,
                    topP: requestedTopP,
                    frequencyPenalty: requestedFrequencyPenalty,
                    presencePenalty: requestedPresencePenalty,
                    tools: tools.length > 0 ? activeTools : undefined,
                    userId: userId || undefined,
                    onMetadata: (meta) => {
                      console.log('[Chat API] Received request metadata:', meta);
                      capturedRequestMetadata = meta;
                    }
                  }
                )) {
                  if (!firstChunkReceived && chunk.length > 0) {
                    ttftMs = Date.now() - streamStartTime;
                    firstChunkReceived = true;
                    console.log(`[API] TTFT: ${ttftMs}ms`);
                  }
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
                    console.log('[API] ⚠️ Widget mode (streaming): Falling back to legacy default model (LIMITED METADATA)');

                    // Capture basic metadata for fallback path
                    const fallbackApiEndpoint = provider === 'openai'
                      ? 'https://api.openai.com/v1/chat/completions'
                      : provider === 'anthropic'
                      ? 'https://api.anthropic.com/v1/messages'
                      : undefined;

                    if (fallbackApiEndpoint) {
                      capturedRequestMetadata = {
                        apiEndpoint: fallbackApiEndpoint,
                        apiBaseUrl: fallbackApiEndpoint.split('/v1')[0],
                        requestHeadersSanitized: {
                          'Content-Type': 'application/json',
                          'Authorization': '[REDACTED]',
                        },
                      };
                      console.log('[API] Fallback path: Captured basic metadata:', {
                        endpoint: fallbackApiEndpoint,
                        provider,
                      });
                    }

                    for await (const chunk of streamLLMResponse(
                      enhancedMessages,
                      model,
                      effectiveTemperature,
                      effectiveMaxTokens,
                      activeTools,
                      {
                        topP: requestedTopP,
                        frequencyPenalty: requestedFrequencyPenalty,
                        presencePenalty: requestedPresencePenalty,
                      }
                    )) {
                      if (!firstChunkReceived && chunk.length > 0) {
                        ttftMs = Date.now() - streamStartTime;
                        firstChunkReceived = true;
                        console.log(`[API] TTFT: ${ttftMs}ms`);
                      }
                      accumulatedResponse += chunk;
                      const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
                      controller.enqueue(encoder.encode(data));
                    }
                    // After fallback streaming, continue to closing logic (no early return)
                  } else {
                    await releaseChatAttachmentClaim();
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
              console.log('[API] ⚠️ Streaming with legacy provider-specific path (LIMITED METADATA)');

              // Capture basic metadata for legacy paths
              const legacyApiEndpoint = provider === 'openai'
                ? 'https://api.openai.com/v1/chat/completions'
                : provider === 'anthropic'
                ? 'https://api.anthropic.com/v1/messages'
                : undefined;

              if (legacyApiEndpoint) {
                capturedRequestMetadata = {
                  apiEndpoint: legacyApiEndpoint,
                  apiBaseUrl: legacyApiEndpoint.split('/v1')[0],
                  requestHeadersSanitized: {
                    'Content-Type': 'application/json',
                    'Authorization': '[REDACTED]',
                  },
                };
                console.log('[API] Legacy path: Captured basic metadata:', {
                  endpoint: legacyApiEndpoint,
                  provider,
                });
              }

              for await (const chunk of streamLLMResponse(
                  enhancedMessages,
                  model,
                  effectiveTemperature,
                  effectiveMaxTokens,
                  activeTools,
                  {
                    topP: requestedTopP,
                    frequencyPenalty: requestedFrequencyPenalty,
                    presencePenalty: requestedPresencePenalty,
                  }
                )) {
                if (!firstChunkReceived && chunk.length > 0) {
                  ttftMs = Date.now() - streamStartTime;
                  firstChunkReceived = true;
                  console.log(`[API] TTFT: ${ttftMs}ms`);
                }
                console.log('[API] [DEBUG] Streaming chunk (legacy), length:', chunk.length);
                accumulatedResponse += chunk;
                const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
            }

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

                  // DEPRECATED: OLD usage tracking system
                  // Now using usage_meters table via increment_root_trace_count()
                  // recordUsageEvent({
                  //   userId: userId,
                  //   metricType: 'chat_message',
                  //   value: 1,
                  //   resourceType: 'message',
                  //   resourceId: widgetConversationId,
                  //   metadata: {
                  //     conversation_id: widgetConversationId,
                  //     is_widget_mode: isWidgetMode || false,
                  //     is_batch_test_mode: isBatchTestMode || false,
                  //     is_streaming: true,
                  //   }
                  // }).catch(err => {
                  //   console.error('[API] Failed to record chat usage (streaming):', err);
                  //   // Don't fail the request if usage recording fails
                  // });
                }

                // Save assistant message with latency and token estimates
                const assistantMessageMetadata = withWebSearchMetadata(messageMetadata);
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
                    ...(assistantMessageMetadata && { metadata: assistantMessageMetadata }),
                  })
                  .select('id')
                  .single();
                console.log('[API] Widget mode (streaming): Assistant message saved with metrics');

                // End trace with streaming metrics
                if (traceContext && streamMsgData?.id) {
                  await completeTraceWithFullData({
                    traceContext,
                    finalResponse: accumulatedResponse,
                    enhancedMessages,
                    messageId: streamMsgData.id,
                    tokenUsage: estimatedInputTokens && estimatedOutputTokens ? {
                      input_tokens: estimatedInputTokens,
                      output_tokens: estimatedOutputTokens,
                    } : undefined,
                    selectedModelId: selectedModelId ?? undefined,
                    temperature: effectiveTraceTemperature,
                    maxTokens: effectiveTraceMaxTokens,
                    tools: toolsForTrace,
                    toolsCalled: toolCallsTracking.length > 0 ? toolCallsTracking : undefined,
                    reasoning: undefined, // Reasoning not available in streaming mode
                    latencyMs: streamLatencyMs,
                    ttftMs,
                    requestMetadata: capturedRequestMetadata,
                    performanceMetrics: {
                      streamingEnabled: true,
                      inferenceTimeMs: streamLatencyMs,
                      // Queue time not available in streaming response yet
                    },
                    ragContext: graphRAGMetadata ? {
                      contextTokens: graphRAGMetadata.estimatedTokens,
                      retrievalLatencyMs: graphRAGMetadata.metadata?.retrieval_time_ms,
                    } : undefined,
                  });

                  console.log('[Chat API] Trace completed with metadata:', {
                    hasRequestMetadata: !!capturedRequestMetadata,
                    requestMetadata: capturedRequestMetadata,
                    hasRAGContext: !!graphRAGMetadata,
                  });
                }
              } catch (error) {
                console.error('[API] Widget mode (streaming): Error saving messages:', error);
                // Continue even if message saving fails
              }
            } else if (traceContext) {
              // Regular chat streaming - end trace with full data (same as widget mode)
              console.log('[API] Regular chat (streaming): Ending trace with full data');

              // Calculate latency and estimate tokens (same as widget mode)
              const streamLatencyMs = Date.now() - streamStartTime;
              const estimatedOutputTokens = Math.ceil(accumulatedResponse.length / 4);
              const userMessageContent = messages[messages.length - 1]?.content;
              const estimatedInputTokens = typeof userMessageContent === 'string'
                ? Math.ceil(userMessageContent.length / 4)
                : 0;

              await completeTraceWithFullData({
                traceContext,
                finalResponse: accumulatedResponse,
                enhancedMessages,
                tokenUsage: estimatedInputTokens && estimatedOutputTokens ? {
                  input_tokens: estimatedInputTokens,
                  output_tokens: estimatedOutputTokens,
                } : undefined,
                selectedModelId: selectedModelId ?? undefined,
                temperature: effectiveTraceTemperature,
                maxTokens: effectiveTraceMaxTokens,
                tools: toolsForTrace,
                toolsCalled: toolCallsTracking.length > 0 ? toolCallsTracking : undefined,
                reasoning: undefined, // Reasoning not available in streaming mode
                latencyMs: streamLatencyMs,
                ttftMs,
                requestMetadata: capturedRequestMetadata,
                performanceMetrics: {
                  streamingEnabled: true,
                  inferenceTimeMs: streamLatencyMs,
                },
                ragContext: graphRAGMetadata ? {
                  contextTokens: graphRAGMetadata.estimatedTokens,
                  retrievalLatencyMs: graphRAGMetadata.metadata?.retrieval_time_ms,
                  graphUsed: graphRAGMetadata.metadata?.graph_used,
                  nodesRetrieved: graphRAGMetadata.metadata?.nodes_retrieved,
                  chunksUsed: graphRAGMetadata.metadata?.context_chunks_used,
                  relevanceScore: graphRAGMetadata.metadata?.context_relevance_score,
                  answerGrounded: graphRAGMetadata.metadata?.answer_grounded_in_graph,
                  retrievalMethod: graphRAGMetadata.metadata?.searchMethod,
                } : undefined,
              });
            }

            await finalizeChatAttachmentClaim();
            emitAttachmentMetadata(controller, encoder, resolvedChatAttachments);

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
            if (!firstChunkReceived) {
              await releaseChatAttachmentClaim();
            }

            // End trace on streaming error
            if (traceContext) {
              try {
                await traceService.endTrace(traceContext, {
                  endTime: new Date(),
                  status: 'failed',
                  errorMessage: error instanceof Error ? error.message : String(error),
                  errorType: error instanceof Error ? error.constructor.name : 'StreamingError'
                });
              } catch (traceErr) {
                console.error('[API] Failed to end trace on streaming error:', traceErr);
              }
            }

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
    await releaseChatAttachmentClaim();

    // Categorize error for trace analytics
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    const traceErrorCategory = categorizeTraceError(undefined, errorMsg, errorType);

    // End trace if active
    if (traceContext) {
      try {
        await traceService.endTrace(traceContext, {
          endTime: new Date(),
          status: 'failed',
          errorMessage: errorMsg,
          errorType: errorType,
          errorCategory: traceErrorCategory.category,
        });
      } catch (traceErr) {
        console.error('[API] Failed to end trace on error:', traceErr);
      }
    }

    // Categorize and save error for batch testing/analytics
    const { category, severity } = categorizeBatchError(error);
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
