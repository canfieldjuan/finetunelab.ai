import {
  SNIPPET_REVISION_ERROR_CODES,
  type SnippetRevision,
  type SnippetRevisionChange,
  type SnippetRevisionResult,
} from './index';

export type SnippetRevisionAction = 'preview' | 'apply';

export interface SnippetRevisionApiRequest {
  action: SnippetRevisionAction;
  sourceText: string;
  revision: SnippetRevision;
}

export interface SnippetRevisionClientOptions {
  endpoint?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

export class SnippetRevisionApiError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options: { code: string; status?: number; details?: unknown }) {
    super(message);
    this.name = 'SnippetRevisionApiError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }
}

const SNIPPET_REVISION_ERROR_CODE_SET = new Set<string>(SNIPPET_REVISION_ERROR_CODES);

export async function requestSnippetRevision(
  request: SnippetRevisionApiRequest,
  options: SnippetRevisionClientOptions = {},
): Promise<SnippetRevisionResult> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (!fetcher) {
    throw new SnippetRevisionApiError('No fetch implementation is available.', {
      code: 'fetch_unavailable',
    });
  }

  let response: Response;
  try {
    response = await fetcher(options.endpoint ?? '/api/snippet-revision', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error, options.signal)) {
      throw new SnippetRevisionApiError('Snippet revision request was aborted.', {
        code: 'request_aborted',
        details: error,
      });
    }

    throw new SnippetRevisionApiError('Snippet revision request failed.', {
      code: 'request_failed',
      details: error,
    });
  }

  const payload = await readJsonResponse(response, options.signal);

  if (!response.ok) {
    const apiError = parseApiError(payload);
    throw new SnippetRevisionApiError(apiError.message, {
      code: apiError.code,
      status: response.status,
      details: payload,
    });
  }

  if (!isRecord(payload) || !isSnippetRevisionResult(payload.result, request)) {
    throw new SnippetRevisionApiError('Snippet revision API returned an invalid response.', {
      code: 'invalid_response',
      status: response.status,
      details: payload,
    });
  }

  return payload.result;
}

async function readJsonResponse(response: Response, signal?: AbortSignal): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (isAbortError(error, signal)) {
      throw new SnippetRevisionApiError('Snippet revision request was aborted.', {
        code: 'request_aborted',
        status: response.status,
        details: error,
      });
    }

    throw new SnippetRevisionApiError('Snippet revision API returned invalid JSON.', {
      code: 'invalid_json_response',
      status: response.status,
      details: error,
    });
  }
}

function parseApiError(payload: unknown): { code: string; message: string } {
  if (
    isRecord(payload) &&
    isRecord(payload.error) &&
    typeof payload.error.code === 'string' &&
    typeof payload.error.message === 'string'
  ) {
    return {
      code: payload.error.code,
      message: payload.error.message,
    };
  }

  return {
    code: 'http_error',
    message: 'Snippet revision API request failed.',
  };
}

function isSnippetRevisionResult(
  value: unknown,
  request: SnippetRevisionApiRequest,
): value is SnippetRevisionResult {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  if (value.ok === false) {
    return value.applied === false &&
      isSnippetRevisionErrorCode(value.code) &&
      typeof value.message === 'string';
  }

  if (
    value.ok !== true ||
    typeof value.applied !== 'boolean' ||
    value.applied !== (request.action === 'apply') ||
    typeof value.updatedText !== 'string' ||
    typeof value.unchanged !== 'boolean' ||
    !isSnippetRevisionChange(value.change, request.sourceText.length)
  ) {
    return false;
  }

  const expectedUpdatedText = [
    request.sourceText.slice(0, value.change.start),
    value.change.replacement,
    request.sourceText.slice(value.change.end),
  ].join('');

  return changeMatchesSubmittedRevision(value.change, request) &&
    value.change.original === request.sourceText.slice(value.change.start, value.change.end) &&
    value.updatedText === expectedUpdatedText &&
    value.unchanged === (expectedUpdatedText === request.sourceText);
}

function changeMatchesSubmittedRevision(
  change: SnippetRevisionChange,
  request: SnippetRevisionApiRequest,
): boolean {
  const revision = request.revision;
  if (change.mode !== revision.mode) {
    return false;
  }

  if (revision.mode === 'replace_text') {
    if (
      revision.find.length === 0 ||
      change.original !== revision.find ||
      change.replacement !== revision.replace
    ) {
      return false;
    }

    const start = request.sourceText.indexOf(revision.find);
    return start !== -1 &&
      request.sourceText.indexOf(revision.find, start + 1) === -1 &&
      change.start === start &&
      change.end === start + revision.find.length;
  }

  return change.start === revision.start &&
    change.end === revision.end &&
    change.original === revision.expectedText &&
    change.replacement === revision.replace;
}

function isSnippetRevisionChange(
  value: unknown,
  sourceTextLength: number,
): value is SnippetRevisionChange {
  if (!isRecord(value)) {
    return false;
  }

  return (value.mode === 'replace_text' || value.mode === 'replace_range') &&
    typeof value.start === 'number' &&
    Number.isInteger(value.start) &&
    value.start >= 0 &&
    typeof value.end === 'number' &&
    Number.isInteger(value.end) &&
    value.end >= value.start &&
    value.end <= sourceTextLength &&
    typeof value.original === 'string' &&
    typeof value.replacement === 'string';
}

function isAbortError(value: unknown, signal?: AbortSignal): boolean {
  return (isRecord(value) && value.name === 'AbortError') || signal?.aborted === true;
}

function isSnippetRevisionErrorCode(value: unknown): boolean {
  return typeof value === 'string' && SNIPPET_REVISION_ERROR_CODE_SET.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
