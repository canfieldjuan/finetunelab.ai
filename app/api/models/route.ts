/**
 * @swagger
 * /api/models:
 *   get:
 *     summary: List available models
 *     description: |
 *       Retrieve all available LLM models (global + user's personal models).
 *
 *       Returns models from:
 *       - Global model registry (available to all users)
 *       - User's personal models (if authenticated)
 *
 *       **Use Cases:**
 *       - Populate model selection dropdowns
 *       - Discover available models for testing
 *       - Check model availability before batch testing
 *     tags:
 *       - Models
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Models retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 12
 *                 models:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Model'
 *   post:
 *     summary: Register new model
 *     description: |
 *       Register a new LLM model in the system.
 *
 *       Supports:
 *       - OpenAI models (GPT-4, GPT-3.5, etc.)
 *       - Anthropic models (Claude)
 *       - Google models (Gemini)
 *       - Local models
 *
 *       **Use Cases:**
 *       - Add custom fine-tuned models
 *       - Register models with custom API keys
 *       - Configure model-specific settings
 *     tags:
 *       - Models
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - provider
 *               - model_id
 *             properties:
 *               name:
 *                 type: string
 *                 description: Display name for the model
 *                 example: "GPT-4 Turbo"
 *               provider:
 *                 type: string
 *                 enum: [openai, anthropic, google, local]
 *                 example: "openai"
 *               model_id:
 *                 type: string
 *                 description: Provider-specific model identifier
 *                 example: "gpt-4-turbo-preview"
 *               api_key_encrypted:
 *                 type: string
 *                 format: password
 *                 description: Encrypted API key (optional, uses global key if not provided)
 *               context_length:
 *                 type: integer
 *                 description: Maximum context window size
 *                 example: 128000
 *               max_output_tokens:
 *                 type: integer
 *                 description: Maximum output tokens
 *                 example: 4096
 *               default_temperature:
 *                 type: number
 *                 description: Default temperature (0.0 - 2.0)
 *                 example: 0.7
 *               default_top_p:
 *                 type: number
 *                 description: Default top_p (0.0 - 1.0)
 *                 example: 1.0
 *     responses:
 *       201:
 *         description: Model registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 model:
 *                   $ref: '#/components/schemas/Model'
 *       400:
 *         description: Bad request - Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

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

    console.log('[ModelsAPI] Auth header present:', !!authHeader);
    
    // If authenticated, get user ID to include personal models
    // Validate auth header format before using it (JWT should have 3 parts: header.payload.signature)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const tokenParts = token.split('.');
      console.log('[ModelsAPI] Token parts:', tokenParts.length);

      // Only proceed if we have a valid JWT structure
      if (tokenParts.length === 3) {
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

          console.log('[ModelsAPI] Validating token with Supabase...');
          const { data: { user }, error: authError } = await supabase.auth.getUser();

          if (!authError && user) {
            userId = user.id;
            console.log('[ModelsAPI] ✓ Authenticated user:', userId);
          } else {
            console.log('[ModelsAPI] ❌ Auth validation failed:', authError?.message || 'No user returned');
            console.log('[ModelsAPI] Returning global models only');
            supabase = null;
          }
        } catch (authCheckError) {
          console.log('[ModelsAPI] ❌ Auth check exception:', authCheckError);
          console.log('[ModelsAPI] Returning global models only');
          supabase = null; // Reset if auth failed
        }
      } else {
        console.log('[ModelsAPI] ❌ Invalid JWT format (expected 3 parts, got', tokenParts.length, ')');
        console.log('[ModelsAPI] Returning global models only');
      }
    } else {
      console.log('[ModelsAPI] No auth header or invalid format, returning global models only');
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
      max_output_tokens: body.max_output_tokens || parseInt(process.env.MODELS_DEFAULT_MAX_OUTPUT_TOKENS || '2000', 10),
      price_per_input_token: body.price_per_input_token,
      price_per_output_token: body.price_per_output_token,
      default_temperature: body.default_temperature ?? parseFloat(process.env.MODELS_DEFAULT_TEMPERATURE || '0.7'),
      default_top_p: body.default_top_p ?? parseFloat(process.env.MODELS_DEFAULT_TOP_P || '1.0'),
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
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === 'DUPLICATE_MODEL_NAME') {
      return NextResponse.json(
        {
          success: false,
          error: 'A model with this name already exists for your account.',
          code: 'DUPLICATE_MODEL_NAME',
        },
        { status: 409 }
      );
    }
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
