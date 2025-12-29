/**
 * API Route - Benchmark Management
 *
 * CRUD operations for custom benchmarks
 * POST /api/benchmarks - Create benchmark
 * GET /api/benchmarks - List user's benchmarks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CreateBenchmarkRequest, Benchmark } from '@/lib/benchmarks/types';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE5MjgyMCwiZXhwIjoxOTYwNzY4ODIwfQ.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

/**
 * POST - Create new benchmark
 */
export async function POST(req: NextRequest) {
  console.log('[Benchmarks API] POST - Create benchmark');

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

    // Block 2: Parse and validate request
    const body: CreateBenchmarkRequest = await req.json();

    if (!body.name || !body.task_type || !body.pass_criteria) {
      console.log('[Benchmarks API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: name, task_type, pass_criteria' },
        { status: 400 }
      );
    }

    console.log('[Benchmarks API] Creating benchmark:', {
      name: body.name,
      task_type: body.task_type,
    });

    // Block 3: Create benchmark (use service key to bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: benchmark, error: createError } = await supabaseAdmin
      .from('benchmarks')
      .insert({
        name: body.name,
        description: body.description || null,
        task_type: body.task_type,
        pass_criteria: body.pass_criteria,
        created_by: user.id,
        is_public: body.is_public || false,
      })
      .select()
      .single();

    if (createError || !benchmark) {
      console.error('[Benchmarks API] Create error:', createError);
      return NextResponse.json(
        { error: 'Failed to create benchmark: ' + createError?.message },
        { status: 500 }
      );
    }

    console.log('[Benchmarks API] Benchmark created:', benchmark.id);

    return NextResponse.json({
      success: true,
      data: benchmark as Benchmark,
    });

  } catch (error) {
    console.error('[Benchmarks API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - List user's benchmarks (own + public)
 */
export async function GET(req: NextRequest) {
  console.log('[Benchmarks API] GET - List benchmarks');

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

    // Block 2: Query benchmarks (own + public)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: benchmarks, error: queryError } = await supabaseAdmin
      .from('benchmarks')
      .select('*')
      .or(`created_by.eq.${user.id},is_public.eq.true`)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('[Benchmarks API] Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch benchmarks: ' + queryError.message },
        { status: 500 }
      );
    }

    console.log('[Benchmarks API] Found benchmarks:', benchmarks?.length || 0);

    return NextResponse.json({
      success: true,
      benchmarks: benchmarks as Benchmark[],
    });

  } catch (error) {
    console.error('[Benchmarks API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
