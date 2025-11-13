/**
 * DAG Pipeline Templates Endpoint
 * 
 * GET /api/training/dag/templates - Get all pipeline templates
 * POST /api/training/dag/templates - Create a new pipeline template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DAG-TEMPLATES] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    console.log(`[DAG-TEMPLATES] Fetching templates${category ? ` in category: ${category}` : ''}`);

    let query = supabase
      .from('training_pipelines')
      .select('*')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('[DAG-TEMPLATES] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates', details: error.message },
        { status: 500 }
      );
    }

    console.log(`[DAG-TEMPLATES] Found ${templates?.length || 0} templates`);

    return NextResponse.json({
      success: true,
      templates: templates || [],
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DAG-TEMPLATES] Unexpected error:', errorMessage);
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, category, config } = body;

    if (!name || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: name and config' },
        { status: 400 }
      );
    }

    if (!config.jobs || !Array.isArray(config.jobs)) {
      return NextResponse.json(
        { error: 'Config must include jobs array' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DAG-TEMPLATES] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[DAG-TEMPLATES] Creating template: ${name}`);

    const { data: template, error } = await supabase
      .from('training_pipelines')
      .insert({
        name,
        description: description || '',
        category: category || 'custom',
        config,
      })
      .select()
      .single();

    if (error) {
      console.error('[DAG-TEMPLATES] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create template', details: error.message },
        { status: 500 }
      );
    }

    console.log(`[DAG-TEMPLATES] Template created: ${template.id}`);

    return NextResponse.json({
      success: true,
      template,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DAG-TEMPLATES] Unexpected error:', errorMessage);
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
