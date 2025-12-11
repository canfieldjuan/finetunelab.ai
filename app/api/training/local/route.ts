/**
 * Local Training Connection API Route
 * 
 * Handles testing and validating connection to local training server
 * 
 * Phase 2.3: Local Training Connection
 * Date: 2025-10-26
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LocalTrainingProvider } from '@/lib/services/training-providers/local.provider';
import { LocalProviderConfig } from '@/lib/training/training-config.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  console.log('[Local Training API] POST request received');

  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Local Training API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate request body
    if (!body.base_url) {
      return NextResponse.json(
        { error: 'Missing required field: base_url' },
        { status: 400 }
      );
    }

    // Create provider config
    const config: LocalProviderConfig = {
      type: 'local',
      base_url: body.base_url,
      api_key: body.api_key,
      timeout_ms: body.timeout_ms || parseInt(process.env.TRAINING_PROVIDER_TIMEOUT_MS || '5000', 10),
    };

    console.log('[Local Training API] Testing connection to:', config.base_url);

    // Test connection
    const provider = new LocalTrainingProvider(config);
    const validation = await provider.validateConnection();

    if (!validation.success) {
      console.log('[Local Training API] Connection failed:', validation.error);
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
          connection: provider.getConnectionStatus(),
        },
        { status: 200 } // Return 200 even on connection failure (it's not a server error)
      );
    }

    console.log('[Local Training API] Connection successful');

    // Optionally save connection config to user settings
    if (body.save_config) {
      const { error: saveError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          setting_key: 'training_provider_local',
          setting_value: config,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,setting_key',
        });

      if (saveError) {
        console.error('[Local Training API] Failed to save config:', saveError);
      } else {
        console.log('[Local Training API] Config saved to user settings');
      }
    }

    return NextResponse.json({
      success: true,
      connection: provider.getConnectionStatus(),
      message: 'Successfully connected to local training server',
    }, { status: 200 });

  } catch (error) {
    console.error('[Local Training API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Retrieve saved local training config
export async function GET(request: NextRequest) {
  console.log('[Local Training API] GET request received');

  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Local Training API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get saved config
    const { data: setting, error: fetchError } = await supabase
      .from('user_settings')
      .select('setting_value')
      .eq('user_id', user.id)
      .eq('setting_key', 'training_provider_local')
      .single();

    if (fetchError || !setting) {
      console.log('[Local Training API] No saved config found');
      return NextResponse.json({
        config: null,
        message: 'No saved local training configuration found',
      }, { status: 200 });
    }

    console.log('[Local Training API] Retrieved saved config');

    return NextResponse.json({
      config: setting.setting_value,
    }, { status: 200 });

  } catch (error) {
    console.error('[Local Training API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
