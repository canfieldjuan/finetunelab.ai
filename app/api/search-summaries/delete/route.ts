/**
 * API Route - Delete Search Summaries
 *
 * Deletes saved search result summaries for the authenticated user
 *
 * DELETE /api/search-summaries/delete - Delete one or more summaries
 *   Body: { summaryIds: string[] }
 *
 * Phase 7: Web Search Tool Enhancement - Summary Management
 * Date: 2025-12-16
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type DeleteSummariesRequest = {
  summaryIds: string[];
};

function debugLog(context: string, data: unknown) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SearchSummaries Delete API - ${context}]`, data);
  }
}

/**
 * DELETE - Remove search summaries from database
 * Body: { summaryIds: string[] }
 */
export async function DELETE(req: NextRequest) {
  debugLog('DELETE', 'Request received');

  try {
    // [AUTH] Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      debugLog('DELETE', 'No authorization header');
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
      debugLog('DELETE', 'Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    debugLog('DELETE', `User authenticated: ${user.id}`);

    // [VALIDATION] Parse and validate request body
    const body = (await req.json()) as DeleteSummariesRequest;
    const { summaryIds } = body;

    if (!summaryIds || !Array.isArray(summaryIds)) {
      debugLog('DELETE', 'Invalid request: summaryIds array required');
      return NextResponse.json(
        { error: 'Invalid request: summaryIds array required' },
        { status: 400 }
      );
    }

    if (summaryIds.length === 0) {
      debugLog('DELETE', 'Empty summaryIds array');
      return NextResponse.json(
        { error: 'At least one summary ID is required' },
        { status: 400 }
      );
    }

    const invalidIdIndex = summaryIds.findIndex((id) => typeof id !== 'string' || id.trim().length === 0);
    if (invalidIdIndex !== -1) {
      debugLog('DELETE', `Invalid summary ID at index ${invalidIdIndex}`);
      return NextResponse.json(
        { error: `Invalid summary ID at index ${invalidIdIndex}` },
        { status: 400 }
      );
    }

    debugLog('DELETE', `Deleting ${summaryIds.length} summaries`);

    // [DATABASE] Delete summaries with RLS enforcement
    const { error: deleteError } = await supabase
      .from('search_summaries')
      .delete()
      .eq('user_id', user.id)
      .in('id', summaryIds);

    if (deleteError) {
      debugLog('DELETE', `Database delete error: ${deleteError.message}`);
      return NextResponse.json(
        { error: `Failed to delete summaries: ${deleteError.message}` },
        { status: 500 }
      );
    }

    debugLog('DELETE', `Successfully deleted summaries`);

    // [RESPONSE] Return success response
    return NextResponse.json({
      success: true,
      deleted: summaryIds.length,
    });

  } catch (error) {
    debugLog('DELETE', `Unexpected error: ${error}`);
    console.error('[SearchSummaries Delete API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
