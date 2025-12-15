/**
 * Demo Test Suites API
 * GET /api/demo/test-suites - List available demo test suites
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let query = supabase
      .from('demo_test_suites')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (domain) {
      query = query.eq('task_domain', domain);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API/demo/test-suites] Error fetching test suites:', error);

      // If table doesn't exist, return empty array with helpful message
      if (error.code === '42P01') {
        return NextResponse.json({
          testSuites: [],
          message: 'Demo test suites table not yet created. Run the migration first.',
        });
      }

      return NextResponse.json(
        { error: 'Failed to fetch test suites', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      testSuites: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('[API/demo/test-suites] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
