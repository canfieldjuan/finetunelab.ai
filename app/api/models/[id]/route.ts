// API routes for individual LLM model operations
// GET /api/models/[id] - Get a specific model
// PATCH /api/models/[id] - Update a model
// DELETE /api/models/[id] - Delete a model
// Date: 2025-10-14

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { modelManager } from '@/lib/models/model-manager.service';
import type { UpdateModelDTO } from '@/lib/models/llm-model.types';

export const runtime = 'nodejs';

// ============================================================================
// Helper function to extract and validate ID
// ============================================================================

async function extractId(
  context: { params: Promise<Record<string, string | string[] | undefined>> }
): Promise<string | null> {
  const params = await context.params;
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  return id || null;
}

// ============================================================================
// Helper function to authenticate user
// ============================================================================

async function authenticateUser(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return null;
  }

  try {
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
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('[ModelsAPI] Auth error:', error);
    return null;
  }
}

// ============================================================================
// GET /api/models/[id] - Get a specific model
// Returns model with API key preview (not encrypted value)
// ============================================================================

export async function GET(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[] | undefined>> }
) {
  console.log('[ModelsAPI] GET /api/models/[id]');

  try {
    const id = await extractId(context);
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Model ID is required' },
        { status: 400 }
      );
    }

    console.log('[ModelsAPI] Getting model:', id);

    // Get model (includes API key preview, not encrypted value)
    const model = await modelManager.getModel(id);

    if (!model) {
      console.log('[ModelsAPI] Model not found:', id);
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      );
    }

    console.log('[ModelsAPI] Model retrieved:', model.name);
    return NextResponse.json({
      success: true,
      model,
    });

  } catch (error) {
    console.error('[ModelsAPI] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get model',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/models/[id] - Update a model
// Requires authentication and ownership verification
// ============================================================================

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[] | undefined>> }
) {
  console.log('[ModelsAPI] PATCH /api/models/[id]');

  try {
    const id = await extractId(context);
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Model ID is required' },
        { status: 400 }
      );
    }

    // Require authentication
    const userId = await authenticateUser(request);
    if (!userId) {
      console.log('[ModelsAPI] Unauthorized - no valid auth');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify model exists and user has permission
    const existingModel = await modelManager.getModel(id);
    if (!existingModel) {
      console.log('[ModelsAPI] Model not found:', id);
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      );
    }

    // Check ownership (cannot update global models unless admin)
    if (existingModel.user_id !== userId && existingModel.is_global) {
      console.log('[ModelsAPI] Forbidden - cannot update global model');
      return NextResponse.json(
        { success: false, error: 'Cannot update global models' },
        { status: 403 }
      );
    }

    // Parse update data
    const body = await request.json();

    const dto: UpdateModelDTO = {};
    if (body.name !== undefined) dto.name = body.name;
    if (body.description !== undefined) dto.description = body.description;
    if (body.base_url !== undefined) dto.base_url = body.base_url;
    if (body.model_id !== undefined) dto.model_id = body.model_id;
    if (body.auth_type !== undefined) dto.auth_type = body.auth_type;
    if (body.api_key !== undefined) dto.api_key = body.api_key;
    if (body.auth_headers !== undefined) dto.auth_headers = body.auth_headers;
    if (body.supports_streaming !== undefined) dto.supports_streaming = body.supports_streaming;
    if (body.supports_functions !== undefined) dto.supports_functions = body.supports_functions;
    if (body.supports_vision !== undefined) dto.supports_vision = body.supports_vision;
    if (body.context_length !== undefined) dto.context_length = body.context_length;
    if (body.max_output_tokens !== undefined) dto.max_output_tokens = body.max_output_tokens;
    if (body.price_per_input_token !== undefined) dto.price_per_input_token = body.price_per_input_token;
    if (body.price_per_output_token !== undefined) dto.price_per_output_token = body.price_per_output_token;
    if (body.default_temperature !== undefined) dto.default_temperature = body.default_temperature;
    if (body.default_top_p !== undefined) dto.default_top_p = body.default_top_p;
    if (body.enabled !== undefined) dto.enabled = body.enabled;

    console.log('[ModelsAPI] Updating model:', id, 'with fields:', Object.keys(dto));

    // Update model
    const updatedModel = await modelManager.updateModel(id, dto);

    console.log('[ModelsAPI] Model updated successfully');
    return NextResponse.json({
      success: true,
      model: {
        id: updatedModel.id,
        name: updatedModel.name,
        provider: updatedModel.provider,
        enabled: updatedModel.enabled,
      },
      message: 'Model updated successfully',
    });

  } catch (error) {
    console.error('[ModelsAPI] PATCH error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update model',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/models/[id] - Delete a model
// Requires authentication and ownership verification
// ============================================================================

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[] | undefined>> }
) {
  console.log('[ModelsAPI] DELETE /api/models/[id]');

  try {
    const id = await extractId(context);
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Model ID is required' },
        { status: 400 }
      );
    }

    // Require authentication
    const userId = await authenticateUser(request);
    if (!userId) {
      console.log('[ModelsAPI] Unauthorized - no valid auth');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify model exists and user has permission
    const existingModel = await modelManager.getModel(id);
    if (!existingModel) {
      console.log('[ModelsAPI] Model not found:', id);
      return NextResponse.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      );
    }

    // Check ownership (cannot delete global models unless admin)
    if (existingModel.user_id !== userId && existingModel.is_global) {
      console.log('[ModelsAPI] Forbidden - cannot delete global model');
      return NextResponse.json(
        { success: false, error: 'Cannot delete global models' },
        { status: 403 }
      );
    }

    console.log('[ModelsAPI] Deleting model:', id);

    // Delete model
    await modelManager.deleteModel(id);

    console.log('[ModelsAPI] Model deleted successfully');
    return NextResponse.json({
      success: true,
      id,
      message: 'Model deleted successfully',
    });

  } catch (error) {
    console.error('[ModelsAPI] DELETE error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete model',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
