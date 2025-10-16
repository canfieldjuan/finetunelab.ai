// Training Config API - Single Config Operations
// GET /api/training/[id] - Get config
// PUT /api/training/[id] - Update config
// DELETE /api/training/[id] - Delete config
// Date: 2025-10-16

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { configValidator } from '@/lib/training/config-validator';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  console.log('[TrainingAPI] GET [id]:', params.id);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('training_configs')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('[TrainingAPI] GET [id]: Error:', error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('[TrainingAPI] GET [id]: Error:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  console.log('[TrainingAPI] PUT: Updating config:', params.id);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, config_json } = body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (config_json) {
      const validationResult = configValidator.validate(config_json);
      updateData.config_json = config_json;
      updateData.is_validated = validationResult.isValid;
      updateData.validation_errors = validationResult.isValid ? null : validationResult.errors;
    }

    const { data, error } = await supabase
      .from('training_configs')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[TrainingAPI] PUT: Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[TrainingAPI] PUT: Updated successfully');
    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('[TrainingAPI] PUT: Error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  console.log('[TrainingAPI] DELETE: Deleting config:', params.id);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('training_configs')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[TrainingAPI] DELETE: Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[TrainingAPI] DELETE: Deleted successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TrainingAPI] DELETE: Error:', error);
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
  }
}
