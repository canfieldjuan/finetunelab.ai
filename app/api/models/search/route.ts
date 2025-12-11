/**
 * Model Search API
 * Purpose: Search HuggingFace models from client-side
 * Date: 2025-10-31
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * HuggingFace Model API response type
 */
interface HFModelResponse {
  id?: string;
  modelId?: string;
  author?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  pipeline_tag?: string;
  library_name?: string;
  created_at?: string;
  lastModified?: string;
  last_modified?: string;
  safetensors?: {
    total?: number;
  };
}

/**
 * GET /api/models/search
 * Search HuggingFace models
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!query || query.length < 3) {
      return NextResponse.json({
        success: true,
        models: [],
        message: 'Query must be at least 3 characters',
      });
    }

    console.log('[Model Search API] Searching HuggingFace for:', query);

    // Search HuggingFace Hub API
    const hfApiUrl = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&limit=${limit}&sort=downloads&direction=-1`;
    
    const response = await fetch(hfApiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.statusText}`);
    }

    const hfModels = await response.json() as HFModelResponse[];

    // Transform to our format
    const models = hfModels.map((model: HFModelResponse) => ({
      id: model.id || model.modelId,
      name: model.id || model.modelId,
      author: model.author || model.id?.split('/')[0] || 'unknown',
      downloads: model.downloads || 0,
      likes: model.likes || 0,
      tags: model.tags || [],
      pipeline_tag: model.pipeline_tag,
      library_name: model.library_name,
      created_at: model.created_at,
      last_modified: model.lastModified || model.last_modified,
      // Calculate approximate size in GB from model card if available
      sizeGB: model.safetensors?.total ? 
        Number((model.safetensors.total / 1024 / 1024 / 1024).toFixed(2)) : 
        undefined,
    }));

    console.log('[Model Search API] Found', models.length, 'models');

    return NextResponse.json({
      success: true,
      models,
      count: models.length,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Search failed';
    console.error('[Model Search API] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        models: [],
      },
      { status: 500 }
    );
  }
}
