/**
 * Sentiment Insights API Route
 *
 * Detects and returns sentiment-related insights, anomalies, and patterns.
 *
 * Query Parameters:
 * - lookback_days: Number of days to analyze (default: 30)
 *
 * Phase 3.3: Advanced Sentiment Analysis
 * Date: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectSentimentInsights } from '@/lib/services/sentiment.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  console.log('[Sentiment Insights API] GET request received');

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
      console.log('[Sentiment Insights API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const lookbackDaysParam = searchParams.get('lookback_days');
    const lookbackDays = lookbackDaysParam ? parseInt(lookbackDaysParam) : 30;

    console.log('[Sentiment Insights API] Detecting insights for user:', user.id);

    const insights = await detectSentimentInsights(user.id, supabase, lookbackDays);

    console.log('[Sentiment Insights API] Returning', insights.length, 'insights');
    return NextResponse.json({ insights }, { status: 200 });
  } catch (error) {
    console.error('[Sentiment Insights API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
