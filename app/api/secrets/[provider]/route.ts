// API routes for individual provider secret management
// GET /api/secrets/[provider] - Get specific provider secret
// PUT /api/secrets/[provider] - Update provider secret
// DELETE /api/secrets/[provider] - Delete provider secret
// Date: 2025-10-16

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import type { UpdateSecretDTO } from '@/lib/secrets/secrets.types';
import type { ModelProvider } from '@/lib/models/llm-model.types';
import { createApiKeyPreview, decrypt } from '@/lib/models/encryption';

export const runtime = 'nodejs';

// ============================================================================
// GET /api/secrets/[provider] - Get specific provider secret
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  console.log('[SecretsAPI] GET /api/secrets/', provider);

  try {
    // Require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get provider secret
    const secret = await secretsManager.getSecret(
      user.id,
      provider as ModelProvider,
      supabase
    );

    if (!secret) {
      return NextResponse.json(
        { success: false, error: 'Provider secret not found' },
        { status: 404 }
      );
    }

    // Return secret with preview (no actual API key)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { api_key_encrypted, user_id, ...rest } = secret;
    return NextResponse.json({
      success: true,
      secret: {
        ...rest,
        api_key_preview: createApiKeyPreview(decrypt(api_key_encrypted)),
      },
    });

  } catch (error) {
    console.error('[SecretsAPI] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get provider secret',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/secrets/[provider] - Update provider secret
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  console.log('[SecretsAPI] PUT /api/secrets/', provider);

  try {
    // Require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    const dto: UpdateSecretDTO = {
      api_key: body.api_key,
      description: body.description,
      metadata: body.metadata,  // Provider-specific data (e.g., HF username)
    };

    // Update provider secret
    const secret = await secretsManager.updateSecret(
      user.id,
      provider as ModelProvider,
      dto,
      supabase
    );

    console.log('[SecretsAPI] Provider secret updated:', secret.id);
    return NextResponse.json({
      success: true,
      secret: {
        id: secret.id,
        provider: secret.provider,
        description: secret.description,
      },
      message: 'Provider secret updated successfully',
    });

  } catch (error) {
    console.error('[SecretsAPI] PUT error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update provider secret',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/secrets/[provider] - Delete provider secret
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  console.log('[SecretsAPI] DELETE /api/secrets/', provider);

  try {
    // Require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete provider secret
    await secretsManager.deleteSecret(
      user.id,
      provider as ModelProvider,
      supabase
    );

    console.log('[SecretsAPI] Provider secret deleted for provider:', provider);
    return NextResponse.json({
      success: true,
      message: 'Provider secret deleted successfully',
    });

  } catch (error) {
    console.error('[SecretsAPI] DELETE error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete provider secret',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
