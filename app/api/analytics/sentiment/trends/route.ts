/**
 * Sentiment Trends API Route
 *
 * Returns sentiment analysis trends for a user over a date range.
 *
 * Query Parameters:
 * - start_date: Optional ISO date string (defaults to 30 days ago)
 * - end_date: Optional ISO date string (defaults to now)
 *
 * Phase 3.3: Advanced Sentiment Analysis
 * Date: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSentimentTrends } from '@/lib/services/sentiment.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  console.log('[Sentiment Trends API] GET request received');

  try {
    // Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Sentiment Trends API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date') || undefined;
    const endDate = searchParams.get('end_date') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;

    console.log('[Sentiment Trends API] Fetching trends for user:', user.id, 'limit:', limit);

    const trends = await getSentimentTrends(user.id, supabase, startDate, endDate, limit);

    console.log('[Sentiment Trends API] Returning', trends.length, 'trends');
    return NextResponse.json({ trends }, { status: 200 });
  } catch (error) {
    console.error('[Sentiment Trends API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
