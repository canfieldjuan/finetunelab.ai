/**
 * @swagger
 * /api/analytics/sentiment/insights:
 *   get:
 *     summary: Get sentiment insights and anomalies
 *     description: |
 *       Detect sentiment-related patterns, anomalies, and insights from user conversations.
 *
 *       Analyzes conversation sentiment to identify:
 *       - Sudden sentiment drops (user dissatisfaction)
 *       - Sentiment improvement patterns
 *       - Recurring negative topics
 *       - User satisfaction trends
 *       - Emotional engagement patterns
 *
 *       **Use Cases:**
 *       - Monitor user satisfaction in production
 *       - Detect quality regressions after model updates
 *       - Identify problematic conversation patterns
 *       - Track customer sentiment over time
 *       - Trigger alerts for negative sentiment spikes
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lookback_days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to analyze
 *         example: 7
 *     responses:
 *       200:
 *         description: Sentiment insights retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 insights:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [sentiment_drop, sentiment_improvement, negative_pattern, positive_trend]
 *                         example: "sentiment_drop"
 *                       severity:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                         example: "high"
 *                       description:
 *                         type: string
 *                         example: "Sentiment dropped by 35% in the last 24 hours"
 *                       affected_conversations:
 *                         type: integer
 *                         example: 23
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       metadata:
 *                         type: object
 *                         description: Additional context about the insight
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { detectSentimentInsights } from '@/lib/services/sentiment.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

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
