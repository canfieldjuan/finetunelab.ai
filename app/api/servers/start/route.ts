/**
 * Server Start API Endpoint
 *
 * POST /api/servers/start
 * Starts a stopped vLLM/Ollama inference server through the VRAM-safe swap
 * orchestration so direct API calls cannot bypass eviction and serialization.
 */

import { handleServerSwapRequest } from '../server-swap-handler';

export const runtime = 'nodejs';

export const POST = handleServerSwapRequest;
