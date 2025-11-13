/**
 * vLLM Availability API
 * 
 * GET /api/training/vllm/check - Check if vLLM is available
 */

import { NextResponse } from 'next/server';
import { isVLLMAvailable, getVLLMVersion } from '@/lib/services/vllm-checker';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const available = await isVLLMAvailable();
    const version = available ? await getVLLMVersion() : null;

    return NextResponse.json({
      available,
      version,
      message: available 
        ? 'vLLM is installed and ready' 
        : 'vLLM not found. Install with: pip install vllm',
    });
  } catch (error) {
    console.error('[vLLM Check API] Error:', error);
    
    return NextResponse.json({
      available: false,
      version: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
