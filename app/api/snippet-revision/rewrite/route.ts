import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage } from '@/lib/llm/openai';
import { unifiedLLMClient } from '@/lib/llm/unified-client';
import { traceService } from '@/lib/tracing/trace.service';
import type { TraceContext } from '@/lib/tracing/types';

export const runtime = 'nodejs';

interface SnippetRewriteRequest {
  sourceText: string;
  selection: {
    start: number;
    end: number;
    expectedText: string;
  };
  instruction: string;
  modelId?: string | null;
}

type ParseResult =
  | { ok: true; request: SnippetRewriteRequest }
  | { ok: false; code: string; message: string };

type AuthResult =
  | { ok: true; userId: string; supabase: SupabaseClient }
  | { ok: false; code: string; message: string; status: number };

type ModelAuthorizationResult =
  | { ok: true; modelId: string; maxOutputTokens: number; contextLength: number }
  | { ok: false; code: string; message: string; status: number };

type ReplacementParseResult =
  | { ok: true; replacement: string }
  | { ok: false; code: string; message: string };

type RewriteCapacityResult =
  | { ok: true; maxTokens: number; contextCharsPerSide: number }
  | { ok: false; code: string; message: string; status: number };

const MAX_SOURCE_TEXT_CHARS = 200_000;
const MAX_SELECTED_TEXT_CHARS = 4_000;
const MAX_INSTRUCTION_CHARS = 2_000;
const CONTEXT_CHARS_PER_SIDE = 2_000;
const DEFAULT_MAX_REWRITE_TOKENS = 2_000;
const DEFAULT_CONTEXT_LENGTH = 4_096;
const MIN_REWRITE_TOKENS = 128;
const OUTPUT_REWRITE_SLACK_TOKENS = 512;
const REWRITE_PROMPT_OVERHEAD_TOKENS = 512;
const REWRITE_CONTEXT_SAFETY_TOKENS = 128;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return validationError(auth.code, auth.message, auth.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError('invalid_json', 'Request body must be valid JSON.');
  }

  const parsed = parseSnippetRewriteRequest(body);
  if (!parsed.ok) {
    return validationError(parsed.code, parsed.message);
  }

  const { request: rewriteRequest } = parsed;
  const modelAuthorization = await authorizeRewriteModel(auth.supabase, rewriteRequest.modelId, auth.userId);
  if (!modelAuthorization.ok) {
    return validationError(modelAuthorization.code, modelAuthorization.message, modelAuthorization.status);
  }

  const capacity = getRewriteCapacity(rewriteRequest, modelAuthorization);
  if (!capacity.ok) {
    return validationError(capacity.code, capacity.message, capacity.status);
  }

  const messages = buildRewriteMessages(rewriteRequest, capacity.contextCharsPerSide);

  try {
    const rawReplacement = await generateReplacementText({
      messages,
      modelId: modelAuthorization.modelId,
      userId: auth.userId,
      selectedLength: rewriteRequest.selection.expectedText.length,
      maxTokens: capacity.maxTokens,
      contextCharsPerSide: capacity.contextCharsPerSide,
    });
    const replacement = extractReplacementText(rawReplacement);

    if (!replacement.ok) {
      return validationError(replacement.code, replacement.message, 502);
    }

    return NextResponse.json({
      replacement: replacement.replacement,
      modelId: modelAuthorization.modelId,
    });
  } catch (error) {
    console.error('[SnippetRewrite] Failed to generate replacement:', error);
    return validationError('rewrite_failed', 'Failed to generate replacement text.', 502);
  }
}

async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Authorization header is required.',
      status: 401,
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[SnippetRewrite] Missing Supabase public environment variables.');
    return {
      ok: false,
      code: 'server_config_error',
      message: 'Snippet rewrite is not configured.',
      status: 500,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Invalid authorization token.',
      status: 401,
    };
  }

  return { ok: true, userId: user.id, supabase };
}

function parseSnippetRewriteRequest(body: unknown): ParseResult {
  if (!isRecord(body)) {
    return failure('invalid_body', 'Request body must be a JSON object.');
  }

  const sourceText = body.sourceText;
  if (typeof sourceText !== 'string') {
    return failure('invalid_source_text', 'sourceText must be a string.');
  }

  if (sourceText.length > MAX_SOURCE_TEXT_CHARS) {
    return failure('source_text_too_large', `sourceText must be ${MAX_SOURCE_TEXT_CHARS} characters or fewer.`);
  }

  const selection = body.selection;
  if (!isRecord(selection)) {
    return failure('invalid_selection', 'selection must be a JSON object.');
  }

  const { start, end, expectedText } = selection;
  if (typeof start !== 'number' || typeof end !== 'number' || !Number.isInteger(start) || !Number.isInteger(end)) {
    return failure('invalid_range_offsets', 'selection.start and selection.end must be integers.');
  }

  if (start < 0 || end < start || end > sourceText.length) {
    return failure('range_out_of_bounds', 'Selection range is outside the source text.');
  }

  if (typeof expectedText !== 'string') {
    return failure('invalid_expected_text', 'selection.expectedText must be a string.');
  }

  if (expectedText.length === 0) {
    return failure('empty_selection', 'Selected text must not be empty.');
  }

  if (expectedText.length > MAX_SELECTED_TEXT_CHARS) {
    return failure('selected_text_too_large', `Selected text must be ${MAX_SELECTED_TEXT_CHARS} characters or fewer.`);
  }

  if (sourceText.slice(start, end) !== expectedText) {
    return failure('target_mismatch', 'Selection text no longer matches the source text.');
  }

  const instruction = body.instruction;
  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    return failure('invalid_instruction', 'instruction must be a non-empty string.');
  }

  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    return failure('instruction_too_large', `instruction must be ${MAX_INSTRUCTION_CHARS} characters or fewer.`);
  }

  const modelId = body.modelId === undefined || body.modelId === null ? null : body.modelId;
  if (modelId !== null && typeof modelId !== 'string') {
    return failure('invalid_model_id', 'modelId must be a string or null.');
  }

  return {
    ok: true,
    request: {
      sourceText,
      selection: { start, end, expectedText },
      instruction: instruction.trim(),
      modelId,
    },
  };
}

async function authorizeRewriteModel(
  supabase: SupabaseClient,
  modelId?: string | null,
  userId?: string,
): Promise<ModelAuthorizationResult> {
  const normalizedModelId = normalizeModelId(modelId);
  if (!normalizedModelId) {
    return {
      ok: false,
      code: 'model_required',
      message: 'Select a portal model before generating a snippet rewrite.',
      status: 400,
    };
  }

  if (!UUID_REGEX.test(normalizedModelId)) {
    return {
      ok: false,
      code: 'invalid_model_id',
      message: 'modelId must be an enabled portal model UUID.',
      status: 400,
    };
  }

  const authzClient = getModelAuthorizationClient(supabase);
  const { data, error } = await authzClient
    .from('llm_models')
    .select('id, max_output_tokens, context_length, is_global, user_id')
    .eq('id', normalizedModelId)
    .eq('enabled', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return {
        ok: false,
        code: 'model_forbidden',
        message: 'Selected model is not available for this user.',
        status: 403,
      };
    }

    console.error('[SnippetRewrite] Failed to authorize model:', error);
    return {
      ok: false,
      code: 'model_lookup_failed',
      message: 'Failed to validate selected model.',
      status: 500,
    };
  }

  if (!data?.id || !isModelAuthorizedForUser(data, userId)) {
    return {
      ok: false,
      code: 'model_forbidden',
      message: 'Selected model is not available for this user.',
      status: 403,
    };
  }

  return {
    ok: true,
    modelId: data.id,
    maxOutputTokens: normalizeMaxOutputTokens(data.max_output_tokens),
    contextLength: normalizeContextLength(data.context_length),
  };
}

function getModelAuthorizationClient(supabase: SupabaseClient): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return supabase;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isModelAuthorizedForUser(
  model: { is_global?: unknown; user_id?: unknown },
  userId?: string,
): boolean {
  return model.is_global === true || (typeof model.user_id === 'string' && model.user_id === userId);
}

function getRewriteCapacity(
  request: SnippetRewriteRequest,
  model: { maxOutputTokens: number; contextLength: number },
): RewriteCapacityResult {
  const selectedLength = request.selection.expectedText.length;
  const maxTokens = getRequiredRewriteTokens(selectedLength);

  if (maxTokens > model.maxOutputTokens) {
    return {
      ok: false,
      code: 'selection_exceeds_model_output',
      message: 'Selected text is too long for the selected model output limit.',
      status: 400,
    };
  }

  const availableInputTokens = model.contextLength - maxTokens - REWRITE_CONTEXT_SAFETY_TOKENS;
  const fixedInputTokens =
    estimateTokenCount(request.instruction) +
    estimateTokenCount(request.selection.expectedText) +
    REWRITE_PROMPT_OVERHEAD_TOKENS;

  if (availableInputTokens < fixedInputTokens) {
    return {
      ok: false,
      code: 'selection_exceeds_model_context',
      message: 'Selected text and instruction exceed the selected model context window.',
      status: 400,
    };
  }

  const contextBudgetTokens = availableInputTokens - fixedInputTokens;
  const contextCharsPerSide = Math.max(
    0,
    Math.min(CONTEXT_CHARS_PER_SIDE, Math.floor(contextBudgetTokens / 2)),
  );

  return {
    ok: true,
    maxTokens,
    contextCharsPerSide,
  };
}

function buildRewriteMessages(request: SnippetRewriteRequest, contextCharsPerSide: number): ChatMessage[] {
  const { sourceText, selection, instruction } = request;
  const beforeStart = Math.max(0, selection.start - contextCharsPerSide);
  const afterEnd = Math.min(sourceText.length, selection.end + contextCharsPerSide);
  const before = sourceText.slice(beforeStart, selection.start);
  const after = sourceText.slice(selection.end, afterEnd);

  return [
    {
      role: 'system',
      content:
        'You rewrite only the selected text from an assistant answer. ' +
        'Return replacement text only inside exactly one <replacement>...</replacement> block. ' +
        'Do not include the surrounding text, explanations, Markdown fences, or labels.',
    },
    {
      role: 'user',
      content: [
        'Output contract:\nReturn exactly one <replacement>...</replacement> block. Do not include surrounding context, labels, commentary, or Markdown fences.',
        `Instruction:\n${instruction}`,
        `Context before selection:\n${before || '[start of message]'}`,
        `Selected text to rewrite:\n${selection.expectedText}`,
        `Context after selection:\n${after || '[end of message]'}`,
      ].join('\n\n---\n\n'),
    },
  ];
}

async function generateReplacementText(params: {
  messages: ChatMessage[];
  modelId: string;
  userId: string;
  selectedLength: number;
  maxTokens: number;
  contextCharsPerSide: number;
}): Promise<string> {
  const maxTokens = params.maxTokens;
  const traceContext = await traceService.startTrace({
    spanName: 'llm.snippet_rewrite',
    operationType: 'llm_call',
    modelName: params.modelId,
    userId: params.userId,
    metadata: {
      feature: 'snippet_revision',
      max_tokens: maxTokens,
      selected_text_chars: params.selectedLength,
      context_chars_per_side: params.contextCharsPerSide,
      tags: ['snippet_revision', 'rewrite'],
    },
  });

  try {
    const response = await unifiedLLMClient.chat(params.modelId, params.messages, {
      userId: params.userId,
      temperature: 0.2,
      maxTokens,
      skipGuardrails: false,
    });

    await endRewriteTrace(traceContext, {
      status: 'completed',
      modelId: params.modelId,
      maxTokens,
      responseText: response.content,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    });

    return response.content;
  } catch (error) {
    await endRewriteTrace(traceContext, {
      status: 'failed',
      modelId: params.modelId,
      maxTokens,
      error,
    });
    throw error;
  }
}

function extractReplacementText(responseText: string): ReplacementParseResult {
  const matches = Array.from(responseText.matchAll(/<replacement>([\s\S]*?)<\/replacement>/gi));
  if (matches.length === 0) {
    return {
      ok: false,
      code: 'replacement_tag_missing',
      message: 'The model did not return a replacement block.',
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      code: 'replacement_tag_multiple',
      message: 'The model returned multiple replacement blocks.',
    };
  }

  const replacement = matches[0][1].replace(/^\n/, '').replace(/\n$/, '');
  return { ok: true, replacement };
}

async function endRewriteTrace(
  traceContext: TraceContext,
  params: {
    status: 'completed' | 'failed';
    modelId: string;
    maxTokens: number;
    responseText?: string;
    inputTokens?: number;
    outputTokens?: number;
    error?: unknown;
  },
): Promise<void> {
  try {
    await traceService.endTrace(traceContext, {
      endTime: new Date(),
      status: params.status,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      maxTokens: params.maxTokens,
      outputData: params.responseText === undefined ? undefined : {
        content: params.responseText.slice(0, 10_000),
      },
      errorMessage: params.error instanceof Error ? params.error.message : undefined,
      errorType: params.error instanceof Error ? params.error.constructor.name : undefined,
      metadata: {
        feature: 'snippet_revision',
        modelName: params.modelId,
      },
    });
  } catch (traceError) {
    console.error('[SnippetRewrite] Failed to end trace:', traceError);
  }
}

function getRequiredRewriteTokens(selectedLength: number): number {
  return Math.max(MIN_REWRITE_TOKENS, selectedLength + OUTPUT_REWRITE_SLACK_TOKENS);
}

function estimateTokenCount(text: string): number {
  return text.length;
}

function normalizeMaxOutputTokens(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  return DEFAULT_MAX_REWRITE_TOKENS;
}

function normalizeContextLength(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  return DEFAULT_CONTEXT_LENGTH;
}

function normalizeModelId(modelId?: string | null): string | null {
  if (!modelId || modelId === '__default__') {
    return null;
  }

  return modelId;
}

function validationError(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function failure(code: string, message: string): { ok: false; code: string; message: string } {
  return {
    ok: false,
    code,
    message,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
