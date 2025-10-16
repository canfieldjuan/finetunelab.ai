// Training Configs API - List and Create
// GET /api/training - List user's configs
// POST /api/training - Create new config
// Date: 2025-10-16

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { configValidator } from '@/lib/training/config-validator';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log('[TrainingAPI] GET: Fetching configs');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[TrainingAPI] GET: Unauthorized - no auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      console.error('[TrainingAPI] GET: Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TrainingAPI] GET: Fetching configs for user:', user.id);

    const { data, error } = await supabase
      .from('training_configs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[TrainingAPI] GET: Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[TrainingAPI] GET: Found', data.length, 'configs');
    return NextResponse.json({ configs: data });
  } catch (error) {
    console.error('[TrainingAPI] GET: Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[TrainingAPI] POST: Creating config');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[TrainingAPI] POST: Unauthorized - no auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      console.error('[TrainingAPI] POST: Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, template_type, config_json } = body;

    console.log('[TrainingAPI] POST: Creating config:', name, 'for user:', user.id);

    if (!name || !template_type || !config_json) {
      console.error('[TrainingAPI] POST: Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validationResult = configValidator.validate(config_json);
    console.log('[TrainingAPI] POST: Validation result:', validationResult.isValid);

    const { data, error } = await supabase
      .from('training_configs')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        template_type,
        config_json,
        is_validated: validationResult.isValid,
        validation_errors: validationResult.isValid ? null : validationResult.errors
      })
      .select()
      .single();

    if (error) {
      console.error('[TrainingAPI] POST: Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[TrainingAPI] POST: Config created:', data.id);
    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('[TrainingAPI] POST: Error:', error);
    return NextResponse.json(
      { error: 'Failed to create config' },
      { status: 500 }
    );
  }
}
