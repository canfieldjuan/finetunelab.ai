/**
 * API Route - Save Search Summaries
 *
 * Saves AI-generated search result summaries for later use
 *
 * POST /api/search-summaries/save - Save one or more summaries
 *
 * Phase 7: Web Search Tool Enhancement - Summary Management
 * Date: 2025-12-16
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type SearchSummaryInput = {
  query: string;
  resultUrl?: string | null;
  resultTitle?: string | null;
  originalSnippet?: string | null;
  summary?: string | null;
  source?: string | null;
  publishedAt?: string | null;
  isIngested?: boolean;
};

type SaveSummariesRequestBody = {
  summaries: SearchSummaryInput[];
  conversationId?: string | null;
};

type InsertedSummary = {
  id: string;
  query: string;
  result_title: string | null;
  created_at: string;
};

function debugLog(context: string, data: unknown) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SearchSummaries Save API - ${context}]`, data);
  }
}

/**
 * POST - Save search summaries to database
 * Body: { summaries: SearchResultSummary[], conversationId?: string }
 */
export async function POST(req: NextRequest) {
  debugLog('POST', 'Request received');

  try {
    // [AUTH] Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      debugLog('POST', 'No authorization header');
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
      debugLog('POST', 'Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    debugLog('POST', `User authenticated: ${user.id}`);

    // [VALIDATION] Parse and validate request body
    const body = (await req.json()) as SaveSummariesRequestBody;
    const { summaries, conversationId } = body;

    if (!summaries || !Array.isArray(summaries)) {
      debugLog('POST', 'Invalid request: summaries array required');
      return NextResponse.json(
        { error: 'Invalid request: summaries array required' },
        { status: 400 }
      );
    }

    if (summaries.length === 0) {
      debugLog('POST', 'Empty summaries array');
      return NextResponse.json(
        { error: 'At least one summary is required' },
        { status: 400 }
      );
    }

    const invalidSummaryIndex = summaries.findIndex(
      (summary) => typeof summary.query !== 'string' || summary.query.trim().length === 0
    );
    if (invalidSummaryIndex !== -1) {
      debugLog('POST', `Invalid summary at index ${invalidSummaryIndex}`);
      return NextResponse.json(
        { error: `Invalid summary at index ${invalidSummaryIndex}: "query" is required` },
        { status: 400 }
      );
    }

    debugLog('POST', `Saving ${summaries.length} summaries`);

    // [DATABASE] Prepare summaries for insertion
    const summariesToInsert = summaries.map((summary) => ({
      user_id: user.id,
      conversation_id: conversationId || null,
      query: summary.query,
      result_url: summary.resultUrl ?? null,
      result_title: summary.resultTitle ?? null,
      original_snippet: summary.originalSnippet ?? null,
      summary: summary.summary ?? null,
      source: summary.source ?? null,
      published_at: summary.publishedAt ?? null,
      is_ingested: summary.isIngested ?? false,
      is_saved: true,
    }));

    debugLog('POST', 'Inserting summaries into database');

    // [DATABASE] Insert summaries with error handling
    const { data: insertedSummaries, error: insertError } = await supabase
      .from('search_summaries')
      .insert(summariesToInsert)
      .select('id, query, result_title, created_at');

    if (insertError) {
      debugLog('POST', `Database insert error: ${insertError.message}`);
      return NextResponse.json(
        { error: `Failed to save summaries: ${insertError.message}` },
        { status: 500 }
      );
    }

    const savedSummaries = (insertedSummaries ?? []) as InsertedSummary[];
    debugLog('POST', `Successfully saved ${savedSummaries.length} summaries`);

    // [RESPONSE] Return success response
    return NextResponse.json({
      success: true,
      saved: savedSummaries.length,
      summaries: insertedSummaries,
    });

  } catch (error) {
    debugLog('POST', `Unexpected error: ${error}`);
    console.error('[SearchSummaries Save API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
