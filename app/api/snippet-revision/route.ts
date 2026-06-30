import { NextRequest, NextResponse } from 'next/server';
import {
  applySnippetRevision,
  previewSnippetRevision,
  type SnippetRevision,
} from '@/lib/snippet-revision';

type SnippetRevisionAction = 'preview' | 'apply';

interface SnippetRevisionRequest {
  action: SnippetRevisionAction;
  sourceText: string;
  revision: SnippetRevision;
}

const MAX_SOURCE_TEXT_CHARS = 200_000;
const MAX_FIND_TEXT_CHARS = 20_000;
const MAX_REPLACEMENT_CHARS = 50_000;

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationError('invalid_json', 'Request body must be valid JSON.');
  }

  const parsed = parseSnippetRevisionRequest(body);
  if (!parsed.ok) {
    return validationError(parsed.code, parsed.message);
  }

  const result = parsed.request.action === 'preview'
    ? previewSnippetRevision(parsed.request.sourceText, parsed.request.revision)
    : applySnippetRevision(parsed.request.sourceText, parsed.request.revision);

  return NextResponse.json({ result });
}

type ParseResult =
  | { ok: true; request: SnippetRevisionRequest }
  | { ok: false; code: string; message: string };

function parseSnippetRevisionRequest(body: unknown): ParseResult {
  if (!isRecord(body)) {
    return failure('invalid_body', 'Request body must be a JSON object.');
  }

  const action = body.action;
  if (action !== 'preview' && action !== 'apply') {
    return failure('invalid_action', 'action must be "preview" or "apply".');
  }

  const sourceText = body.sourceText;
  if (typeof sourceText !== 'string') {
    return failure('invalid_source_text', 'sourceText must be a string.');
  }

  if (sourceText.length > MAX_SOURCE_TEXT_CHARS) {
    return failure('source_text_too_large', `sourceText must be ${MAX_SOURCE_TEXT_CHARS} characters or fewer.`);
  }

  const revision = parseRevision(body.revision);
  if (!revision.ok) {
    return revision;
  }

  return {
    ok: true,
    request: {
      action,
      sourceText,
      revision: revision.revision,
    },
  };
}

type RevisionParseResult =
  | { ok: true; revision: SnippetRevision }
  | { ok: false; code: string; message: string };

function parseRevision(value: unknown): RevisionParseResult {
  if (!isRecord(value)) {
    return failure('invalid_revision', 'revision must be a JSON object.');
  }

  if (value.mode === 'replace_text') {
    return parseTextRevision(value);
  }

  if (value.mode === 'replace_range') {
    return parseRangeRevision(value);
  }

  return failure('invalid_revision_mode', 'revision.mode must be "replace_text" or "replace_range".');
}

function parseTextRevision(value: Record<string, unknown>): RevisionParseResult {
  const { find, replace } = value;

  if (typeof find !== 'string') {
    return failure('invalid_find', 'revision.find must be a string.');
  }

  if (find.length > MAX_FIND_TEXT_CHARS) {
    return failure('find_too_large', `revision.find must be ${MAX_FIND_TEXT_CHARS} characters or fewer.`);
  }

  if (typeof replace !== 'string') {
    return failure('invalid_replace', 'revision.replace must be a string.');
  }

  if (replace.length > MAX_REPLACEMENT_CHARS) {
    return failure('replace_too_large', `revision.replace must be ${MAX_REPLACEMENT_CHARS} characters or fewer.`);
  }

  return {
    ok: true,
    revision: {
      mode: 'replace_text',
      find,
      replace,
    },
  };
}

function parseRangeRevision(value: Record<string, unknown>): RevisionParseResult {
  const { start, end, expectedText, replace } = value;

  if (typeof start !== 'number' || typeof end !== 'number' || !Number.isInteger(start) || !Number.isInteger(end)) {
    return failure('invalid_range_offsets', 'revision.start and revision.end must be integers.');
  }

  if (typeof expectedText !== 'string') {
    return failure('invalid_expected_text', 'revision.expectedText must be a string.');
  }

  if (expectedText.length > MAX_FIND_TEXT_CHARS) {
    return failure('expected_text_too_large', `revision.expectedText must be ${MAX_FIND_TEXT_CHARS} characters or fewer.`);
  }

  if (typeof replace !== 'string') {
    return failure('invalid_replace', 'revision.replace must be a string.');
  }

  if (replace.length > MAX_REPLACEMENT_CHARS) {
    return failure('replace_too_large', `revision.replace must be ${MAX_REPLACEMENT_CHARS} characters or fewer.`);
  }

  return {
    ok: true,
    revision: {
      mode: 'replace_range',
      start,
      end,
      expectedText,
      replace,
    },
  };
}

function validationError(code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status: 400 },
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
