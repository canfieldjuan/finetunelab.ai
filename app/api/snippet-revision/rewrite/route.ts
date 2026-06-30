import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadLLMConfig } from '@/lib/config/llmConfig';
import { runAnthropicWithToolCalls } from '@/lib/llm/anthropic';
import { getOpenAIResponse, type ChatMessage } from '@/lib/llm/openai';
import { unifiedLLMClient } from '@/lib/llm/unified-client';

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

const MAX_SOURCE_TEXT_CHARS = 200_000;
const MAX_SELECTED_TEXT_CHARS = 20_000;
const MAX_INSTRUCTION_CHARS = 2_000;
const CONTEXT_CHARS_PER_SIDE = 2_000;
const DEFAULT_MAX_REWRITE_TOKENS = 1_000;

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return validationError(auth.code, auth.message, 401);
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
  const messages = buildRewriteMessages(rewriteRequest);

  try {
    const rawReplacement = await generateReplacementText({
      messages,
      modelId: rewriteRequest.modelId,
      userId: auth.userId,
      selectedLength: rewriteRequest.selection.expectedText.length,
    });
    const replacement = extractReplacementText(rawReplacement);

    if (!replacement) {
      return validationError('empty_replacement', 'The model returned an empty replacement.', 502);
    }

    return NextResponse.json({
      replacement,
      modelId: normalizeModelId(rewriteRequest.modelId),
    });
  } catch (error) {
    console.error('[SnippetRewrite] Failed to generate replacement:', error);
    return validationError(
      'rewrite_failed',
      error instanceof Error ? error.message : 'Failed to generate replacement text.',
      502,
    );
  }
}

async function authenticateRequest(
  request: NextRequest,
): Promise<{ ok: true; userId: string } | { ok: false; code: string; message: string }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { ok: false, code: 'unauthorized', message: 'Authorization header is required.' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, code: 'unauthorized', message: 'Invalid authorization token.' };
  }

  return { ok: true, userId: user.id };
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

function buildRewriteMessages(request: SnippetRewriteRequest): ChatMessage[] {
  const { sourceText, selection, instruction } = request;
  const beforeStart = Math.max(0, selection.start - CONTEXT_CHARS_PER_SIDE);
  const afterEnd = Math.min(sourceText.length, selection.end + CONTEXT_CHARS_PER_SIDE);
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
  modelId?: string | null;
  userId: string;
  selectedLength: number;
}): Promise<string> {
  const maxTokens = Math.max(
    128,
    Math.min(DEFAULT_MAX_REWRITE_TOKENS, Math.ceil(params.selectedLength / 3) + 256),
  );
  const normalizedModelId = normalizeModelId(params.modelId);

  if (normalizedModelId) {
    const response = await unifiedLLMClient.chat(normalizedModelId, params.messages, {
      userId: params.userId,
      temperature: 0.2,
      maxTokens,
      skipGuardrails: false,
    });
    return response.content;
  }

  const config = loadLLMConfig();
  if (config.provider === 'anthropic') {
    const response = await runAnthropicWithToolCalls(
      params.messages,
      config.anthropic?.model,
      0.2,
      maxTokens,
      [],
    );
    return response.content;
  }

  if (config.provider === 'openai') {
    return getOpenAIResponse(
      params.messages,
      config.openai?.model,
      0.2,
      maxTokens,
    );
  }

  throw new Error(`Snippet rewrite does not support default provider: ${config.provider}`);
}

function extractReplacementText(responseText: string): string {
  const match = /<replacement>([\s\S]*?)<\/replacement>/i.exec(responseText);
  if (match) {
    return match[1].replace(/^\n/, '').replace(/\n$/, '');
  }

  return responseText.trim();
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
