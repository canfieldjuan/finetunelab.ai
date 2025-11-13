/**
 * Local Models API
 * GET /api/models/local - List locally available models from AI_Models directory
 * Date: 2025-10-31
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanLocalModels } from '@/lib/models/local-model-scanner';
import type { LocalModelInfo } from '@/lib/models/local-model-scanner';

export const runtime = 'nodejs';

/**
 * Cache for local models (to avoid scanning on every request)
 */
let cachedModels: LocalModelInfo[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/models/local
 * 
 * List locally available models from AI_Models directory
 * 
 * Query Parameters:
 * - category: Filter by category (nlp, vision, audio, etc.)
 * - format: Filter by format (huggingface, pytorch, onnx, safetensors)
 * - refresh: Force refresh cache (true/false)
 * 
 * Returns:
 * {
 *   success: boolean,
 *   models: LocalModelInfo[],
 *   count: number,
 *   cached: boolean,
 *   scannedAt: string
 * }
 */
export async function GET(request: NextRequest) {
  console.log('[LocalModelsAPI] GET /api/models/local - Listing local models');

  try {
    const { searchParams } = request.nextUrl;
    const categoryFilter = searchParams.get('category');
    const formatFilter = searchParams.get('format');
    const forceRefresh = searchParams.get('refresh') === 'true';

    const now = Date.now();
    const cacheExpired = now - cacheTimestamp > CACHE_DURATION_MS;

    // Check if we need to scan
    let models: LocalModelInfo[];
    let fromCache = false;

    if (cachedModels && !cacheExpired && !forceRefresh) {
      console.log('[LocalModelsAPI] Using cached models');
      models = cachedModels;
      fromCache = true;
    } else {
      console.log('[LocalModelsAPI] Scanning AI_Models directory...');
      const scanStartTime = Date.now();

      models = await scanLocalModels();

      const scanDuration = Date.now() - scanStartTime;
      console.log('[LocalModelsAPI] Scan completed in', scanDuration, 'ms');

      // Update cache
      cachedModels = models;
      cacheTimestamp = now;
      fromCache = false;
    }

    // Apply filters
    let filteredModels = models;

    if (categoryFilter) {
      console.log('[LocalModelsAPI] Filtering by category:', categoryFilter);
      filteredModels = filteredModels.filter(m => m.category === categoryFilter);
    }

    if (formatFilter) {
      console.log('[LocalModelsAPI] Filtering by format:', formatFilter);
      filteredModels = filteredModels.filter(m => m.format === formatFilter);
    }

    // Sort by name
    filteredModels.sort((a, b) => a.name.localeCompare(b.name));

    console.log('[LocalModelsAPI] Returning', filteredModels.length, 'models (from cache:', fromCache, ')');

    return NextResponse.json({
      success: true,
      models: filteredModels,
      count: filteredModels.length,
      cached: fromCache,
      scannedAt: new Date(cacheTimestamp).toISOString(),
      categories: [...new Set(models.map(m => m.category))].sort(),
      formats: [...new Set(models.map(m => m.format))].sort(),
    });

  } catch (error) {
    console.error('[LocalModelsAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list local models',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/models/local/refresh
 * 
 * Force refresh the local models cache
 * (Alternative to using ?refresh=true query param)
 */
export async function POST() {
  console.log('[LocalModelsAPI] POST /api/models/local - Force refreshing cache');

  try {
    console.log('[LocalModelsAPI] Scanning AI_Models directory...');
    const scanStartTime = Date.now();

    const models = await scanLocalModels();

    const scanDuration = Date.now() - scanStartTime;
    console.log('[LocalModelsAPI] Scan completed in', scanDuration, 'ms');

    // Update cache
    cachedModels = models;
    cacheTimestamp = Date.now();

    return NextResponse.json({
      success: true,
      message: 'Cache refreshed successfully',
      count: models.length,
      scanDuration: `${scanDuration}ms`,
      scannedAt: new Date(cacheTimestamp).toISOString(),
    });

  } catch (error) {
    console.error('[LocalModelsAPI] Refresh error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
