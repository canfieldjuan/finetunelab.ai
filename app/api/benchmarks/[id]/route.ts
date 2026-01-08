/**
 * API Route - Benchmark Management by ID
 *
 * PATCH /api/benchmarks/[id] - Update benchmark
 * DELETE /api/benchmarks/[id] - Delete benchmark
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { UpdateBenchmarkRequest, Benchmark } from '@/lib/benchmarks/types';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE5MjgyMCwiZXhwIjoxOTYwNzY4ODIwfQ.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

/**
 * PATCH - Update existing benchmark
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Benchmarks API] PATCH - Update benchmark:', id);

  try {
    // Block 1: Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Benchmarks API] No auth header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Benchmarks API] Invalid token:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    console.log('[Benchmarks API] User authenticated:', user.id);

    // Block 2: Verify benchmark exists and check ownership
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingBenchmark, error: fetchError } = await supabaseAdmin
      .from('benchmarks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingBenchmark) {
      console.log('[Benchmarks API] Benchmark not found:', id);
      return NextResponse.json(
        { error: 'Benchmark not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingBenchmark.created_by !== user.id) {
      console.log('[Benchmarks API] Ownership check failed:', {
        benchmark_owner: existingBenchmark.created_by,
        requesting_user: user.id,
      });
      return NextResponse.json(
        { error: 'Forbidden - you do not own this benchmark' },
        { status: 403 }
      );
    }

    // Block 3: Parse and validate request
    const body: UpdateBenchmarkRequest = await req.json();

    console.log('[Benchmarks API] Updating benchmark with:', {
      name: body.name,
      task_type: body.task_type,
      validators: body.pass_criteria?.required_validators?.length || 0,
    });

    // Block 4: Update benchmark
    const updateData: Partial<Benchmark> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.task_type !== undefined) updateData.task_type = body.task_type;
    if (body.pass_criteria !== undefined) updateData.pass_criteria = body.pass_criteria;
    if (body.is_public !== undefined) updateData.is_public = body.is_public;

    const { data: updatedBenchmark, error: updateError } = await supabaseAdmin
      .from('benchmarks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedBenchmark) {
      console.error('[Benchmarks API] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update benchmark: ' + updateError?.message },
        { status: 500 }
      );
    }

    console.log('[Benchmarks API] Benchmark updated:', updatedBenchmark.id);

    return NextResponse.json({
      success: true,
      benchmark: updatedBenchmark as Benchmark,
    });

  } catch (error) {
    console.error('[Benchmarks API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete benchmark
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('[Benchmarks API] DELETE - Delete benchmark:', id);

  try {
    // Block 1: Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[Benchmarks API] No auth header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Benchmarks API] Invalid token:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    console.log('[Benchmarks API] User authenticated:', user.id);

    // Block 2: Verify benchmark exists and check ownership
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingBenchmark, error: fetchError } = await supabaseAdmin
      .from('benchmarks')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingBenchmark) {
      console.log('[Benchmarks API] Benchmark not found:', id);
      return NextResponse.json(
        { error: 'Benchmark not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingBenchmark.created_by !== user.id) {
      console.log('[Benchmarks API] Ownership check failed');
      return NextResponse.json(
        { error: 'Forbidden - you do not own this benchmark' },
        { status: 403 }
      );
    }

    // Block 3: Delete benchmark
    const { error: deleteError } = await supabaseAdmin
      .from('benchmarks')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Benchmarks API] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete benchmark: ' + deleteError.message },
        { status: 500 }
      );
    }

    console.log('[Benchmarks API] Benchmark deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Benchmark deleted successfully',
    });

  } catch (error) {
    console.error('[Benchmarks API] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
