/**
 * GET /api/settings/available-models
 * Returns provider models available for default model selection
 * Only returns global models from providers where the user has an API key
 * Date: 2025-12-03
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Provider display names
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  azure: 'Azure OpenAI',
  mistral: 'Mistral',
  cohere: 'Cohere',
};

export async function GET(request: NextRequest) {
  console.log('[AvailableModelsAPI] GET /api/settings/available-models');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    // Get user's provider secrets to know which providers they have keys for
    const { data: secrets, error: secretsError } = await supabase
      .from('provider_secrets')
      .select('provider')
      .eq('user_id', user.id);

    if (secretsError) {
      console.error('[AvailableModelsAPI] Error fetching secrets:', secretsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch provider secrets' },
        { status: 500 }
      );
    }

    // Get providers the user has keys for
    const configuredProviders = (secrets || []).map(s => s.provider.toLowerCase());
    console.log('[AvailableModelsAPI] User has keys for providers:', configuredProviders);

    if (configuredProviders.length === 0) {
      return NextResponse.json({
        success: true,
        models: [],
        message: 'No API keys configured. Add API keys in Settings to use provider models.',
      });
    }

    // Get global models for those providers
    const { data: models, error: modelsError } = await supabase
      .from('llm_models')
      .select('id, name, provider, model_id, description')
      .eq('is_global', true)
      .eq('enabled', true)
      .in('provider', configuredProviders)
      .order('provider')
      .order('name');

    if (modelsError) {
      console.error('[AvailableModelsAPI] Error fetching models:', modelsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch models' },
        { status: 500 }
      );
    }

    // Format models for the UI with provider display names
    const formattedModels = (models || []).map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      providerName: PROVIDER_NAMES[m.provider] || m.provider,
      modelId: m.model_id,
      description: m.description,
    }));

    console.log('[AvailableModelsAPI] Returning', formattedModels.length, 'available models');
    return NextResponse.json({
      success: true,
      models: formattedModels,
      configuredProviders,
    });

  } catch (error) {
    console.error('[AvailableModelsAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch available models',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
