/**
 * API Route - Retrieve Search Summaries
 *
 * Retrieves saved search result summaries for the authenticated user
 *
 * GET /api/search-summaries/retrieve - Get saved summaries
 *   Query params:
 *   - conversationId?: Filter by conversation
 *   - limit?: Max number of results (default: 50)
 *   - offset?: Pagination offset (default: 0)
 *   - savedOnly?: Return only explicitly saved summaries (default: true)
 *
 * Phase 7: Web Search Tool Enhancement - Summary Management
 * Date: 2025-12-16
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

type SearchSummaryRecord = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  query: string;
  result_url: string | null;
  result_title: string | null;
  original_snippet: string | null;
  summary: string | null;
  source: string | null;
  published_at: string | null;
  is_ingested: boolean;
  is_saved: boolean;
  created_at: string;
};

function debugLog(context: string, data: unknown) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SearchSummaries Retrieve API - ${context}]`, data);
  }
}

/**
 * GET - Retrieve saved search summaries
 */
export async function GET(req: NextRequest) {
  debugLog('GET', 'Request received');

  try {
    // [AUTH] Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      debugLog('GET', 'No authorization header');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    // [AUTH] Create Supabase client with user auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      debugLog('GET', 'Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    debugLog('GET', `User authenticated: ${user.id}`);

    // [PARAMS] Extract and validate query parameters
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const savedOnly = searchParams.get('savedOnly') !== 'false';

    debugLog('GET', { conversationId, limit, offset, savedOnly });

    // [DATABASE] Build query with filters
    let query = supabase
      .from('search_summaries')
      .select('*')
      .eq('user_id', user.id);

    // Filter by conversation if specified
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    // Filter by saved status
    if (savedOnly) {
      query = query.eq('is_saved', true);
    }

    // Apply ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    debugLog('GET', 'Executing query');

    // [DATABASE] Execute query
    const { data: summaries, error: queryError } = await query;

    if (queryError) {
      debugLog('GET', `Database query error: ${queryError.message}`);
      return NextResponse.json(
        { error: `Failed to retrieve summaries: ${queryError.message}` },
        { status: 500 }
      );
    }

    const results = (summaries || []) as SearchSummaryRecord[];
    debugLog('GET', `Retrieved ${results.length} summaries`);

    // [RESPONSE] Return summaries with pagination info
    return NextResponse.json({
      success: true,
      summaries: results,
      pagination: {
        limit,
        offset,
        total: results.length,
      },
    });

  } catch (error) {
    debugLog('GET', `Unexpected error: ${error}`);
    console.error('[SearchSummaries Retrieve API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
