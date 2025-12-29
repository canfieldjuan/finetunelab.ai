// API routes for provider secrets management
// GET /api/secrets - List all provider secrets for authenticated user
// POST /api/secrets - Create a new provider secret
// Date: 2025-10-16

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { secretsManager } from '@/lib/secrets/secrets-manager.service';
import type { CreateSecretDTO } from '@/lib/secrets/secrets.types';

export const runtime = 'nodejs';

// ============================================================================
// GET /api/secrets - List all provider secrets
// Returns user's provider secrets with masked API key previews
// ============================================================================

export async function GET(request: NextRequest) {
  console.log('[SecretsAPI] GET /api/secrets - Listing provider secrets');

  try {
    // Require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[SecretsAPI] Unauthorized - no auth header');
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
      console.log('[SecretsAPI] Auth failed:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // List provider secrets
    const secrets = await secretsManager.listSecrets(user.id, supabase);

    console.log('[SecretsAPI] Returning', secrets.length, 'provider secrets');
    return NextResponse.json({
      success: true,
      secrets,
      count: secrets.length,
    });

  } catch (error) {
    console.error('[SecretsAPI] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list provider secrets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/secrets - Create a new provider secret
// Requires authentication
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('[SecretsAPI] POST /api/secrets - Creating provider secret');

  try {
    // Require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[SecretsAPI] Unauthorized - no auth header');
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
      console.log('[SecretsAPI] Auth failed:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();

    if (!body.provider || !body.api_key) {
      console.log('[SecretsAPI] Missing required fields');
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['provider', 'api_key'],
        },
        { status: 400 }
      );
    }

    // Create secret DTO with normalized provider name (lowercase for consistency)
    const dto: CreateSecretDTO = {
      provider: body.provider.toLowerCase(),
      api_key: body.api_key,
      description: body.description,
      metadata: body.metadata,  // Provider-specific data (e.g., HF username)
    };

    console.log('[SecretsAPI] Creating provider secret:', dto.provider, 'for user:', user.id);

    // Create provider secret with encryption
    const secret = await secretsManager.createSecret(dto, user.id, supabase);

    console.log('[SecretsAPI] Provider secret created successfully:', secret.id);
    return NextResponse.json({
      success: true,
      secret: {
        id: secret.id,
        provider: secret.provider,
        description: secret.description,
      },
      message: 'Provider secret created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('[SecretsAPI] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create provider secret',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
