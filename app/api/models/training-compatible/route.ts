import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/models/training-compatible
 * 
 * Returns models suitable for training:
 * - Global base models (GPT-2, Llama, Mistral, etc.)
 * - User's custom trained models
 * 
 * Used by DAG Builder for model selection
 */
export async function GET(request: NextRequest) {
  console.log('[ModelsTrainingCompatibleAPI] GET - Fetching training-compatible models');

  try {
    // Authenticate user (optional - can show global models to unauthenticated)
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user) {
        userId = user.id;
        console.log('[ModelsTrainingCompatibleAPI] User authenticated:', userId);
      }
    }

    // Create Supabase client (works with or without auth)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    });

    // Query: Global models OR user's models
    let query = supabase
      .from('llm_models')
      .select('id, name, base_model, provider, training_method, context_length, is_global, user_id')
      .eq('enabled', true);

    if (userId) {
      // Authenticated: Show global + user's models
      query = query.or(`is_global.eq.true,user_id.eq.${userId}`);
    } else {
      // Unauthenticated: Show only global models
      query = query.eq('is_global', true);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[ModelsTrainingCompatibleAPI] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch models', details: error.message },
        { status: 500 }
      );
    }

    console.log('[ModelsTrainingCompatibleAPI] Found', data.length, 'models');

    // Format for dropdown
    const models = data.map((m) => {
      const baseModelName = m.base_model || m.name;
      const providerLabel = m.provider.charAt(0).toUpperCase() + m.provider.slice(1);
      const ownerLabel = m.is_global ? 'Global' : 'Your Model';
      
      return {
        id: m.id,
        name: m.name,
        baseModel: baseModelName,
        provider: m.provider,
        trainingMethod: m.training_method,
        contextLength: m.context_length,
        isGlobal: m.is_global,
        displayLabel: `${m.name} (${providerLabel}, ${ownerLabel})`,
        displaySubtext: m.base_model ? `Base: ${m.base_model}` : undefined,
      };
    });

    return NextResponse.json({
      success: true,
      models,
      count: models.length,
      hasUserModels: userId ? models.some((m) => !m.isGlobal) : false,
    });

  } catch (error) {
    console.error('[ModelsTrainingCompatibleAPI] Unexpected error:', error);
    const details = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: 'Internal server error', details },
      { status: 500 }
    );
  }
}
