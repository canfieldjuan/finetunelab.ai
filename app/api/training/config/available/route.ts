/**
 * Training Config Available API
 * 
 * GET /api/training/config/available
 * Returns simplified list of user's training configs for dropdown selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  console.log('[TrainingConfigAvailableAPI] GET - Fetching available configs');

  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[TrainingConfigAvailableAPI] No authorization header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth token' },
        { status: 401 }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[TrainingConfigAvailableAPI] Auth failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    console.log('[TrainingConfigAvailableAPI] User authenticated:', user.id);

    // Fetch user's training configs (simplified for dropdown)
    const { data: configs, error: configError } = await supabase
      .from('training_configs')
      .select('id, name, description, config_json')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (configError) {
      console.error('[TrainingConfigAvailableAPI] Database error:', configError);
      return NextResponse.json(
        { error: 'Failed to fetch training configs' },
        { status: 500 }
      );
    }

    console.log('[TrainingConfigAvailableAPI] Found', configs?.length || 0, 'configs');

    // Transform to dropdown-friendly format
    const availableConfigs = (configs || []).map((config) => {
      // Extract method from config_json if available
      const method = config.config_json?.training?.method || 
                    config.config_json?.method || 
                    'unknown';
      
      // Extract key parameters for display
      const epochs = config.config_json?.training?.num_epochs || 
                    config.config_json?.num_epochs || 
                    'N/A';
      
      const batchSize = config.config_json?.training?.batch_size || 
                       config.config_json?.batch_size || 
                       'N/A';

      return {
        id: config.id,
        name: config.name,
        description: config.description,
        method: method.toUpperCase(),
        displayLabel: `${config.name} (${method.toUpperCase()}, ${epochs} epochs)`,
        epochs,
        batchSize,
      };
    });

    return NextResponse.json({
      success: true,
      configs: availableConfigs,
      count: availableConfigs.length,
    });

  } catch (error) {
    console.error('[TrainingConfigAvailableAPI] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
