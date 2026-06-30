import type { SnippetRevision, SnippetRevisionResult } from './index';

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
    throw new SnippetRevisionApiError('Snippet revision request failed.', {
      code: 'request_failed',
      details: error,
    });
  }

  const payload = await readJsonResponse(response);

  if (!response.ok) {
    const apiError = parseApiError(payload);
    throw new SnippetRevisionApiError(apiError.message, {
      code: apiError.code,
      status: response.status,
      details: payload,
    });
  }

  if (!isRecord(payload) || !isSnippetRevisionResult(payload.result)) {
    throw new SnippetRevisionApiError('Snippet revision API returned an invalid response.', {
      code: 'invalid_response',
      status: response.status,
      details: payload,
    });
  }

  return payload.result;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
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

function isSnippetRevisionResult(value: unknown): value is SnippetRevisionResult {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  if (value.ok === false) {
    return value.applied === false &&
      typeof value.code === 'string' &&
      typeof value.message === 'string';
  }

  return value.ok === true &&
    typeof value.applied === 'boolean' &&
    typeof value.updatedText === 'string' &&
    typeof value.unchanged === 'boolean' &&
    isSnippetRevisionChange(value.change);
}

function isSnippetRevisionChange(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (value.mode === 'replace_text' || value.mode === 'replace_range') &&
    typeof value.start === 'number' &&
    Number.isInteger(value.start) &&
    typeof value.end === 'number' &&
    Number.isInteger(value.end) &&
    typeof value.original === 'string' &&
    typeof value.replacement === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
