import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { UserSettings, UserSettingsUpdate } from '@/lib/settings/types';

export const runtime = 'nodejs';

/**
 * GET /api/settings
 * Fetch user settings
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Settings API] [DEBUG] GET request received');
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[Settings API] [DEBUG] No auth header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    console.log('[Settings API] [DEBUG] Creating Supabase client');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    console.log('[Settings API] [DEBUG] Getting user from auth');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Settings API] [DEBUG] Auth error or no user:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('[Settings API] [DEBUG] User authenticated:', user.id);

    // Fetch settings from database
    console.log('[Settings API] [DEBUG] Fetching settings for user:', user.id);
    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Settings API] [ERROR] Database error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: user.id
      });
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }
    console.log('[Settings API] [DEBUG] Query completed. Settings found:', !!settings);

    // If no settings exist, return defaults
    if (!settings) {
      return NextResponse.json({
        settings: null,
      });
    }

    // Transform database columns to camelCase
    const userSettings: UserSettings = {
      id: settings.id,
      userId: settings.user_id,
      ttsEnabled: settings.tts_enabled,
      ttsVoiceUri: settings.tts_voice_uri,
      ttsAutoPlay: settings.tts_auto_play,
      ttsRate: settings.tts_rate,
      sttEnabled: settings.stt_enabled,
      defaultModelId: settings.default_model_id,
      defaultModelProvider: settings.default_model_provider,
      embeddingProvider: settings.embedding_provider,
      embeddingBaseUrl: settings.embedding_base_url,
      embeddingModel: settings.embedding_model,
      embeddingApiKey: settings.embedding_api_key,
      theme: settings.theme,
      fontSize: settings.font_size,
      createdAt: settings.created_at,
      updatedAt: settings.updated_at,
    };

    console.log('[Settings API] [DEBUG] Returning settings successfully');
    return NextResponse.json({ settings: userSettings });
  } catch (error) {
    console.error('[Settings API] [ERROR] Unexpected error in GET:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings
 * Update user settings (upsert)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const updates: UserSettingsUpdate = await request.json();

    // Transform camelCase to database snake_case
    const dbUpdates: Record<string, unknown> = {
      user_id: user.id,
    };

    if (updates.ttsEnabled !== undefined) dbUpdates.tts_enabled = updates.ttsEnabled;
    if (updates.ttsVoiceUri !== undefined) dbUpdates.tts_voice_uri = updates.ttsVoiceUri;
    if (updates.ttsAutoPlay !== undefined) dbUpdates.tts_auto_play = updates.ttsAutoPlay;
    if (updates.ttsRate !== undefined) dbUpdates.tts_rate = updates.ttsRate;
    if (updates.sttEnabled !== undefined) dbUpdates.stt_enabled = updates.sttEnabled;
    if (updates.defaultModelId !== undefined) dbUpdates.default_model_id = updates.defaultModelId;
    if (updates.defaultModelProvider !== undefined) dbUpdates.default_model_provider = updates.defaultModelProvider;
    if (updates.embeddingProvider !== undefined) dbUpdates.embedding_provider = updates.embeddingProvider;
    if (updates.embeddingBaseUrl !== undefined) dbUpdates.embedding_base_url = updates.embeddingBaseUrl;
    if (updates.embeddingModel !== undefined) dbUpdates.embedding_model = updates.embeddingModel;
    if (updates.embeddingApiKey !== undefined) dbUpdates.embedding_api_key = updates.embeddingApiKey;
    if (updates.theme !== undefined) dbUpdates.theme = updates.theme;
    if (updates.fontSize !== undefined) dbUpdates.font_size = updates.fontSize;

    // Upsert settings
    const { data: settings, error } = await supabase
      .from('user_settings')
      .upsert(dbUpdates, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('[Settings API] Error upserting settings:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    // Transform back to camelCase
    const userSettings: UserSettings = {
      id: settings.id,
      userId: settings.user_id,
      ttsEnabled: settings.tts_enabled,
      ttsVoiceUri: settings.tts_voice_uri,
      ttsAutoPlay: settings.tts_auto_play,
      ttsRate: settings.tts_rate,
      sttEnabled: settings.stt_enabled,
      defaultModelId: settings.default_model_id,
      defaultModelProvider: settings.default_model_provider,
      embeddingProvider: settings.embedding_provider,
      embeddingBaseUrl: settings.embedding_base_url,
      embeddingModel: settings.embedding_model,
      embeddingApiKey: settings.embedding_api_key,
      theme: settings.theme,
      fontSize: settings.font_size,
      createdAt: settings.created_at,
      updatedAt: settings.updated_at,
    };

    return NextResponse.json({ settings: userSettings });
  } catch (error) {
    console.error('[Settings API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
