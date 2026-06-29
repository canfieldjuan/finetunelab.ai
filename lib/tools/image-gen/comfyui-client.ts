/**
 * Minimal client for a local ComfyUI instance's native HTTP API.
 *
 * Flow: POST a Flux workflow to `/prompt` -> poll `/history/<id>` until the
 * SaveImage node reports outputs -> GET `/view` to download the PNG bytes.
 *
 * ComfyUI is an operator-configured LOCAL backend (its URL comes from the
 * `COMFYUI_URL` env var, never from user input), so this is NOT the SSRF case
 * the MCP layer guards against — no resolve-time IP checks are applied here.
 *
 * Timeout discipline: a single `deadline` is computed up front and EVERY fetch
 * (`/prompt`, `/history`, `/view`) is bounded by `AbortSignal.timeout(remaining)`
 * — so a backend that accepts the connection but then stalls (the "GPU busy
 * holding the socket" case) actually trips the deadline and falls back, rather
 * than hanging forever. Terminal ComfyUI failures (execution error / OOM) and
 * repeated `/history` errors fail fast instead of polling to the full timeout.
 */

import { ComfyUiError } from './types';
import type { ComfyWorkflow } from './flux-workflow';
import { SAVE_IMAGE_NODE_ID } from './flux-workflow';

export interface ComfyUiClientOptions {
  /** Base URL of the ComfyUI server, e.g. http://127.0.0.1:8188 */
  baseUrl: string;
  /** Injected fetch (defaults to global fetch); enables testing. */
  fetchImpl?: typeof fetch;
  /** Delay between history polls. */
  pollIntervalMs?: number;
  /** Overall deadline for the whole generation (bounds every fetch). */
  timeoutMs?: number;
  /** Node id whose outputs hold the image (defaults to the SaveImage node). */
  outputNodeId?: string;
}

export interface ComfyUiImage {
  imageBytes: Uint8Array;
  filename: string;
  mimeType: string;
}

const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_CONSECUTIVE_HISTORY_ERRORS = 5;

interface PromptResponse {
  prompt_id: string;
}

interface HistoryImage {
  filename: string;
  subfolder: string;
  type: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPromptResponse(value: unknown): value is PromptResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).prompt_id === 'string'
  );
}

function isHistoryImage(value: unknown): value is HistoryImage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.filename === 'string' && typeof v.type === 'string';
}

/**
 * Pull the image descriptors out of a `/history/<id>` response for our prompt.
 * Returns null while the prompt is still queued/running (no outputs yet).
 */
function extractImages(
  history: unknown,
  promptId: string,
  outputNodeId: string,
): HistoryImage[] | null {
  if (typeof history !== 'object' || history === null) return null;
  const entry = (history as Record<string, unknown>)[promptId];
  if (typeof entry !== 'object' || entry === null) return null;

  const outputs = (entry as Record<string, unknown>).outputs;
  if (typeof outputs !== 'object' || outputs === null) return null;

  const node = (outputs as Record<string, unknown>)[outputNodeId];
  if (typeof node !== 'object' || node === null) return null;

  const images = (node as Record<string, unknown>).images;
  if (!Array.isArray(images)) return null;

  const valid = images.filter(isHistoryImage);
  return valid.length > 0 ? valid : null;
}

/**
 * Inspect a history entry for a TERMINAL state with no usable image, so we can
 * fail fast instead of polling to the timeout. Returns a reason string when the
 * prompt has finished without producing an image, else null (still running).
 * Only call this after {@link extractImages} has already returned null.
 */
function terminalReason(history: unknown, promptId: string): string | null {
  if (typeof history !== 'object' || history === null) return null;
  const entry = (history as Record<string, unknown>)[promptId];
  if (typeof entry !== 'object' || entry === null) return null;
  const status = (entry as Record<string, unknown>).status;
  if (typeof status !== 'object' || status === null) return null;
  const s = status as Record<string, unknown>;
  if (s.status_str === 'error') return 'execution error';
  if (s.completed === true) return 'completed with no output images';
  return null;
}

function mimeTypeForFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'png':
    default:
      return 'image/png';
  }
}

/**
 * Fetch bounded by the remaining time until `deadline`. Aborts the underlying
 * connection (not just the await) so a stalled backend trips the deadline.
 */
async function fetchWithDeadline(
  url: string,
  init: RequestInit | undefined,
  deadline: number,
  fetchImpl: typeof fetch,
  operation: string,
): Promise<Response> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new ComfyUiError(`ComfyUI timed out before ${operation}`, 504);
  }
  try {
    return await fetchImpl(url, { ...(init ?? {}), signal: AbortSignal.timeout(remaining) });
  } catch (err) {
    if (err instanceof ComfyUiError) throw err;
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new ComfyUiError(`ComfyUI ${operation} timed out`, 504);
    }
    throw new ComfyUiError(
      `ComfyUI ${operation} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Generate an image via ComfyUI and return the raw bytes of the first output.
 * Throws {@link ComfyUiError} on any HTTP failure, terminal generation error,
 * malformed response, or timeout.
 */
export async function generateWithComfyUi(
  workflow: ComfyWorkflow,
  options: ComfyUiClientOptions,
): Promise<ComfyUiImage> {
  const {
    baseUrl,
    fetchImpl = fetch,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    outputNodeId = SAVE_IMAGE_NODE_ID,
  } = options;

  const root = baseUrl.replace(/\/+$/, '');
  const deadline = Date.now() + timeoutMs;

  // 1. Queue the prompt.
  const queueRes = await fetchWithDeadline(
    `${root}/prompt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    },
    deadline,
    fetchImpl,
    'queue prompt',
  );
  if (!queueRes.ok) {
    throw new ComfyUiError(`ComfyUI /prompt returned ${queueRes.status}`, queueRes.status);
  }
  const queueBody: unknown = await queueRes.json();
  if (!isPromptResponse(queueBody)) {
    throw new ComfyUiError('ComfyUI /prompt response missing prompt_id');
  }
  const { prompt_id: promptId } = queueBody;

  // 2. Poll history until the output node reports images, a terminal failure is
  //    seen, or we time out.
  let images: HistoryImage[] | null = null;
  let consecutiveErrors = 0;
  while (Date.now() < deadline) {
    const historyRes = await fetchWithDeadline(
      `${root}/history/${promptId}`,
      undefined,
      deadline,
      fetchImpl,
      'poll history',
    );
    if (historyRes.ok) {
      consecutiveErrors = 0;
      const historyBody: unknown = await historyRes.json();
      images = extractImages(historyBody, promptId, outputNodeId);
      if (images) break;
      const reason = terminalReason(historyBody, promptId);
      if (reason) {
        throw new ComfyUiError(`ComfyUI generation failed: ${reason}`);
      }
    } else {
      consecutiveErrors += 1;
      if (consecutiveErrors >= MAX_CONSECUTIVE_HISTORY_ERRORS) {
        throw new ComfyUiError(
          `ComfyUI /history repeatedly returned ${historyRes.status}`,
          historyRes.status,
        );
      }
    }
    await sleep(pollIntervalMs);
  }
  if (!images) {
    throw new ComfyUiError(`ComfyUI generation timed out after ${timeoutMs}ms`, 504);
  }

  // 3. Download the first image.
  const image = images[0];
  const viewUrl = new URL(`${root}/view`);
  viewUrl.searchParams.set('filename', image.filename);
  viewUrl.searchParams.set('subfolder', image.subfolder ?? '');
  viewUrl.searchParams.set('type', image.type);

  const viewRes = await fetchWithDeadline(
    viewUrl.toString(),
    undefined,
    deadline,
    fetchImpl,
    'download image',
  );
  if (!viewRes.ok) {
    throw new ComfyUiError(`ComfyUI /view returned ${viewRes.status}`, viewRes.status);
  }
  const buffer = await viewRes.arrayBuffer();

  return {
    imageBytes: new Uint8Array(buffer),
    filename: image.filename,
    mimeType: mimeTypeForFilename(image.filename),
  };
}
