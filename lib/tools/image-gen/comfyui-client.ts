/**
 * Minimal client for a local ComfyUI instance's native HTTP API.
 *
 * Flow: POST a Flux workflow to `/prompt` -> poll `/history/<id>` until the
 * SaveImage node reports outputs -> GET `/view` to download the PNG bytes.
 *
 * ComfyUI is an operator-configured LOCAL backend (its URL comes from the
 * `COMFYUI_URL` env var, never from user input), so this is NOT the SSRF case
 * the MCP layer guards against — no resolve-time IP checks are applied here.
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
  /** Overall deadline for the whole generation. */
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
 * Generate an image via ComfyUI and return the raw bytes of the first output.
 * Throws {@link ComfyUiError} on any HTTP failure, malformed response, or timeout.
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

  // 1. Queue the prompt.
  let queueRes: Response;
  try {
    queueRes = await fetchImpl(`${root}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });
  } catch (err) {
    throw new ComfyUiError(
      `ComfyUI unreachable at ${root}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!queueRes.ok) {
    throw new ComfyUiError(`ComfyUI /prompt returned ${queueRes.status}`, queueRes.status);
  }
  const queueBody: unknown = await queueRes.json();
  if (!isPromptResponse(queueBody)) {
    throw new ComfyUiError('ComfyUI /prompt response missing prompt_id');
  }
  const { prompt_id: promptId } = queueBody;

  // 2. Poll history until the output node reports images, or we time out.
  const deadline = Date.now() + timeoutMs;
  let images: HistoryImage[] | null = null;
  while (Date.now() < deadline) {
    const historyRes = await fetchImpl(`${root}/history/${promptId}`);
    if (historyRes.ok) {
      const historyBody: unknown = await historyRes.json();
      images = extractImages(historyBody, promptId, outputNodeId);
      if (images) break;
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

  const viewRes = await fetchImpl(viewUrl.toString());
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
