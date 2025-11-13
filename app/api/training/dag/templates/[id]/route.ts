/**
 * DAG Pipeline Template by ID Endpoint
 * 
 * GET /api/training/dag/templates/[id] - Get a specific template
 * DELETE /api/training/dag/templates/[id] - Delete a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing template ID' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DAG-TEMPLATE] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[DAG-TEMPLATE] Fetching template: ${id}`);

    const { data: template, error } = await supabase
      .from('training_pipelines')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[DAG-TEMPLATE] Database error:', error);
      return NextResponse.json(
        { error: 'Template not found', details: error.message },
        { status: 404 }
      );
    }

    console.log(`[DAG-TEMPLATE] Template found: ${template.name}`);

    return NextResponse.json({
      success: true,
      template,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DAG-TEMPLATE] Unexpected error:', errorMessage);
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing template ID' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DAG-TEMPLATE] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Database configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[DAG-TEMPLATE] Deleting template: ${id}`);

    const { error } = await supabase
      .from('training_pipelines')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DAG-TEMPLATE] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete template', details: error.message },
        { status: 500 }
      );
    }

    console.log(`[DAG-TEMPLATE] Template deleted: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Template deleted',
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[DAG-TEMPLATE] Unexpected error:', errorMessage);
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
