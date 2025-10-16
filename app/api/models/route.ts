// API routes for LLM model management
// GET /api/models - List all available models
// POST /api/models - Create a new model
// Date: 2025-10-14

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { modelManager } from '@/lib/models/model-manager.service';
import type { CreateModelDTO } from '@/lib/models/llm-model.types';

export const runtime = 'nodejs';

// ============================================================================
// GET /api/models - List all available models
// Returns global models + user's personal models if authenticated
// ============================================================================

export async function GET(request: NextRequest) {
  console.log('[ModelsAPI] GET /api/models - Listing models');

  try {
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    let supabase = null;

    // If authenticated, get user ID to include personal models
    if (authHeader) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (!authError && user) {
          userId = user.id;
          console.log('[ModelsAPI] Authenticated user:', userId);
        }
      } catch (error) {
        console.log('[ModelsAPI] Auth check failed, returning global models only');
        supabase = null; // Reset if auth failed
      }
    }

    // List models (global + user's personal if authenticated)
    // Pass authenticated client for RLS to work correctly
    const models = await modelManager.listModels(userId || undefined, supabase || undefined);

    console.log('[ModelsAPI] Returning', models.length, 'models');
    return NextResponse.json({
      success: true,
      models,
      count: models.length,
    });

  } catch (error) {
    console.error('[ModelsAPI] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list models',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/models - Create a new model
// Requires authentication
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('[ModelsAPI] POST /api/models - Creating model');

  try {
    // Require authentication for creating models
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[ModelsAPI] Unauthorized - no auth header');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[ModelsAPI] Auth failed:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();

    if (!body.name || !body.provider || !body.base_url || !body.model_id || !body.auth_type) {
      console.log('[ModelsAPI] Missing required fields');
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['name', 'provider', 'base_url', 'model_id', 'auth_type'],
        },
        { status: 400 }
      );
    }

    // Create model DTO
    const dto: CreateModelDTO = {
      name: body.name,
      description: body.description,
      provider: body.provider,
      base_url: body.base_url,
      model_id: body.model_id,
      auth_type: body.auth_type,
      api_key: body.api_key,
      auth_headers: body.auth_headers || {},
      supports_streaming: body.supports_streaming ?? true,
      supports_functions: body.supports_functions ?? false,
      supports_vision: body.supports_vision ?? false,
      context_length: body.context_length || 4096,
      max_output_tokens: body.max_output_tokens || 2000,
      price_per_input_token: body.price_per_input_token,
      price_per_output_token: body.price_per_output_token,
      default_temperature: body.default_temperature ?? 0.7,
      default_top_p: body.default_top_p ?? 1.0,
      enabled: body.enabled ?? true,
    };

    console.log('[ModelsAPI] Creating model:', dto.name, 'for user:', user.id);

    // Create model with encryption (pass authenticated Supabase client for RLS)
    const model = await modelManager.createModel(dto, user.id, supabase);

    console.log('[ModelsAPI] Model created successfully:', model.id);
    return NextResponse.json({
      success: true,
      model: {
        id: model.id,
        name: model.name,
        provider: model.provider,
        enabled: model.enabled,
      },
      message: 'Model created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('[ModelsAPI] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create model',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
