/**
 * vLLM Availability API
 * 
 * GET /api/training/vllm/check - Check if vLLM is available
 */

import { NextResponse } from 'next/server';
import { getVLLMRuntimeStatus } from '@/lib/services/vllm-checker';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const status = await getVLLMRuntimeStatus();

    return NextResponse.json(status);
  } catch (error) {
    console.error('[vLLM Check API] Error:', error);

    return NextResponse.json({
      available: false,
      mode: 'unavailable',
      local_available: false,
      external_configured: false,
      cloud_runtime: Boolean(process.env.VERCEL || process.env.RENDER),
      requires_external: Boolean(process.env.VERCEL || process.env.RENDER),
      version: null,
      configured: {
        executable_path: Boolean(process.env.VLLM_EXECUTABLE_PATH),
        python_path: Boolean(process.env.VLLM_PYTHON_PATH || process.env.PYTHON_PATH),
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
