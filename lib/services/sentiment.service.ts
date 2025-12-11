/**
 * Sentiment Analysis Service
 *
 * Provides sentiment analysis functionality for conversations and messages.
 * Analyzes tone, emotion, and satisfaction levels from conversation data.
 *
 * Phase 3.3: Advanced Sentiment Analysis
 * Phase 4.1: Performance Optimization
 * Date: 2025-10-25
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type SentimentType = 'positive' | 'neutral' | 'negative';

interface ConversationQueryResult {
  id: string;
  metadata: Record<string, unknown>; // Using unknown for now, as metadata can be anything
  user_rating: number | null;
  created_at: string;
}

/**
 * Graphiti Sentiment Analysis Response
 * From POST /analyze-sentiment endpoint
 */
export interface GraphitiSentimentResponse {
  text: string;
  sentiment: SentimentType;
  score: number;
  confidence: number;
  method: string;
  debug?: {
    positive_max: number;
    negative_max: number;
  };
  error: string | null;
}
export type EmotionType = 'joy' | 'trust' | 'fear' | 'surprise' | 'sadness' | 'disgust' | 'anger' | 'anticipation';

export interface SentimentScore {
  positive: number;
  neutral: number;
  negative: number;
  compound: number;
}

export interface ConversationSentiment {
  conversation_id: string;
  overall_sentiment: SentimentType;
  sentiment_score: SentimentScore;
  dominant_emotion?: EmotionType;
  satisfaction_level: number;
  tone_shift_count: number;
  analyzed_at: string;
}

export interface SentimentTrend {
  date: string;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  average_satisfaction: number;
  total_conversations: number;
}

export interface SentimentInsight {
  id: string;
  insight_type: 'trend' | 'anomaly' | 'pattern';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  detected_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * Analyze text sentiment using Graphiti semantic similarity endpoint
 *
 * @param text - Text to analyze
 * @returns Sentiment analysis result from graphiti-main server
 */
export async function analyzeTextWithGraphiti(text: string): Promise<GraphitiSentimentResponse | null> {
  const graphitiUrl = process.env.NEXT_PUBLIC_GRAPHITI_URL;

  if (!graphitiUrl) {
    console.warn('[SentimentService] NEXT_PUBLIC_GRAPHITI_URL not configured, using fallback');
    return null;
  }

  try {
    console.log('[SentimentService] Analyzing text with Graphiti:', {
      textLength: text.length,
      endpoint: `${graphitiUrl}/analyze-sentiment`
    });

    const response = await fetch(`${graphitiUrl}/analyze-sentiment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      console.error('[SentimentService] Graphiti request failed:', {
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const result: GraphitiSentimentResponse = await response.json();

    console.log('[SentimentService] Graphiti analysis complete:', {
      sentiment: result.sentiment,
      score: result.score,
      confidence: result.confidence
    });

    return result;
  } catch (error) {
    console.error('[SentimentService] Error calling Graphiti endpoint:', error);
    return null;
  }
}

/**
 * Convert Graphiti sentiment response to legacy SentimentScore format
 */
function graphitiToSentimentScore(graphitiResult: GraphitiSentimentResponse): SentimentScore {
  // Graphiti score ranges from -1 (negative) to +1 (positive)
  // Convert to positive/neutral/negative probabilities
  const score = graphitiResult.score;

  let positive = 0;
  let negative = 0;
  let neutral = 0;

  if (score >= 0.15) {
    // Positive sentiment
    positive = Math.min(1, (score + 1) / 2); // Normalize to 0-1
    neutral = 1 - positive;
    negative = 0;
  } else if (score <= -0.15) {
    // Negative sentiment
    negative = Math.min(1, (Math.abs(score) + 1) / 2);
    neutral = 1 - negative;
    positive = 0;
  } else {
    // Neutral sentiment
    neutral = 1 - Math.abs(score);
    positive = score > 0 ? score : 0;
    negative = score < 0 ? Math.abs(score) : 0;
  }

  return {
    positive,
    neutral,
    negative,
    compound: score
  };
}

export async function analyzeConversationSentiment(
  conversationId: string,
  supabase: SupabaseClient
): Promise<ConversationSentiment> {
  console.log('[SentimentService] Analyzing conversation:', conversationId);

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('id, metadata, user_rating, created_at')
    .eq('id', conversationId)
    .single();

  if (error || !conversation) {
    console.error('[SentimentService] Error fetching conversation:', error);
    throw new Error('Conversation not found');
  }

  // Try to use real Graphiti sentiment analysis
  let sentimentScore: SentimentScore;
  let overallSentiment: SentimentType;

  try {
    // Fetch conversation messages
    const { data: messages } = await supabase
      .from('messages')
      .select('content, role')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messages && messages.length > 0) {
      // Combine user and assistant messages
      const conversationText = messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      // Analyze with Graphiti
      const graphitiResult = await analyzeTextWithGraphiti(conversationText);

      if (graphitiResult && !graphitiResult.error) {
        console.log('[SentimentService] Using Graphiti sentiment analysis');
        sentimentScore = graphitiToSentimentScore(graphitiResult);
        overallSentiment = graphitiResult.sentiment;
      } else {
        // Fallback to metadata
        console.log('[SentimentService] Graphiti unavailable, using metadata fallback');
        sentimentScore = extractSentimentFromMetadata(conversation.metadata);
        overallSentiment = determineSentimentType(sentimentScore.compound);
      }
    } else {
      // No messages, use metadata
      sentimentScore = extractSentimentFromMetadata(conversation.metadata);
      overallSentiment = determineSentimentType(sentimentScore.compound);
    }
  } catch (err) {
    console.error('[SentimentService] Error in Graphiti analysis, using fallback:', err);
    sentimentScore = extractSentimentFromMetadata(conversation.metadata);
    overallSentiment = determineSentimentType(sentimentScore.compound);
  }

  const satisfactionLevel = conversation.user_rating || calculateSatisfaction(sentimentScore);

  const result: ConversationSentiment = {
    conversation_id: conversationId,
    overall_sentiment: overallSentiment,
    sentiment_score: sentimentScore,
    satisfaction_level: satisfactionLevel,
    tone_shift_count: 0,
    analyzed_at: new Date().toISOString()
  };

  console.log('[SentimentService] Analysis complete:', result);
  return result;
}

function extractSentimentFromMetadata(metadata: Record<string, unknown>): SentimentScore {
  if (metadata?.sentiment_score) {
    return metadata.sentiment_score as SentimentScore;
  }

  return {
    positive: 0.33,
    neutral: 0.34,
    negative: 0.33,
    compound: 0
  };
}

function determineSentimentType(compound: number): SentimentType {
  if (compound >= 0.05) return 'positive';
  if (compound <= -0.05) return 'negative';
  return 'neutral';
}

function calculateSatisfaction(score: SentimentScore): number {
  const satisfaction = (score.positive * 5) + (score.neutral * 3) + (score.negative * 1);
  return Math.max(1, Math.min(5, satisfaction));
}

export async function getSentimentTrends(
  userId: string,
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string,
  limit?: number
): Promise<SentimentTrend[]> {
  console.log('[SentimentService] Getting sentiment trends for user:', userId);

  const maxConversations = limit || 10000;

  console.log('[SentimentService] Limiting to', maxConversations, 'conversations');

  let query = supabase
    .from('conversations')
    .select('id, metadata, user_rating, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(maxConversations);

  if (startDate) {
    console.log('[SentimentService] Applying startDate filter:', startDate);
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    console.log('[SentimentService] Applying endDate filter:', endDate);
    query = query.lte('created_at', endDate);
  }

  const { data: conversations, error }: { data: ConversationQueryResult[] | null; error: Error | null } = await query;

  if (error) {
    console.error('[SentimentService] Error fetching conversations:', error);
    throw new Error('Failed to fetch conversations');
  }

  console.log('[SentimentService] Found', conversations?.length || 0, 'conversations matching filters');
  if (conversations && conversations.length > 0) {
    console.log('[SentimentService] Date range of results:',
      conversations[0].created_at, 'to', conversations[conversations.length - 1].created_at);
  }

  const trendsByDate = new Map<string, {
    positive: number;
    neutral: number;
    negative: number;
    satisfactions: number[];
    total: number;
  }>();

  // Process conversations with real sentiment analysis when available
  // Note: This analyzes each conversation in sequence. For large datasets,
  // consider batch processing or caching analyzed results in the database.
  console.log('[SentimentService] Processing', conversations?.length || 0, 'conversations');

  for (const conv of conversations || []) {
    const date = new Date(conv.created_at).toISOString().split('T')[0];

    let type: SentimentType;
    let sentiment: SentimentScore;

    // Try to get real-time analysis for this conversation
    // Graphiti endpoint is fast (20-50ms) so this is acceptable for reasonable dataset sizes
    try {
      const analysis = await analyzeConversationSentiment(conv.id, supabase);
      type = analysis.overall_sentiment;
      sentiment = analysis.sentiment_score;
      console.log('[SentimentService] Conversation', conv.id, 'analyzed:', type, 'compound:', sentiment.compound);
    } catch {
      // Fallback to metadata
      console.log('[SentimentService] Conversation', conv.id, 'failed analysis, using fallback');
      sentiment = extractSentimentFromMetadata(conv.metadata);
      type = determineSentimentType(sentiment.compound);
    }

    const satisfaction = conv.user_rating || calculateSatisfaction(sentiment);

    if (!trendsByDate.has(date)) {
      trendsByDate.set(date, {
        positive: 0,
        neutral: 0,
        negative: 0,
        satisfactions: [],
        total: 0
      });
    }

    const trend = trendsByDate.get(date)!;
    trend[type]++;
    trend.satisfactions.push(satisfaction);
    trend.total++;
  }

  const trends: SentimentTrend[] = Array.from(trendsByDate.entries()).map(([date, data]) => {
    const avgSatisfaction = data.satisfactions.length > 0
      ? data.satisfactions.reduce((a, b) => a + b, 0) / data.satisfactions.length
      : 0;

    return {
      date,
      positive_count: data.positive,
      neutral_count: data.neutral,
      negative_count: data.negative,
      average_satisfaction: avgSatisfaction,
      total_conversations: data.total
    };
  });

  console.log('[SentimentService] Generated', trends.length, 'trend data points');
  return trends;
}

export async function detectSentimentInsights(
  userId: string,
  supabase: SupabaseClient,
  lookbackDays: number = 30
): Promise<SentimentInsight[]> {
  console.log('[SentimentService] Detecting insights for user:', userId);

  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const trends = await getSentimentTrends(userId, supabase, startDate, endDate);

  if (trends.length < 2) {
    console.log('[SentimentService] Insufficient data for insights');
    return [];
  }

  const insights: SentimentInsight[] = [];

  detectSatisfactionTrend(trends, insights);
  detectNegativeSentimentSpike(trends, insights);
  detectPositivePattern(trends, insights);

  console.log('[SentimentService] Detected', insights.length, 'insights');
  return insights;
}

function detectSatisfactionTrend(trends: SentimentTrend[], insights: SentimentInsight[]): void {
  if (trends.length < 3) return;

  const recentTrends = trends.slice(-7);
  const olderTrends = trends.slice(0, Math.min(7, trends.length - 7));

  const recentAvg = recentTrends.reduce((sum, t) => sum + t.average_satisfaction, 0) / recentTrends.length;
  const olderAvg = olderTrends.reduce((sum, t) => sum + t.average_satisfaction, 0) / olderTrends.length;

  const change = ((recentAvg - olderAvg) / olderAvg) * 100;

  if (Math.abs(change) > 10) {
    const isPositive = change > 0;
    insights.push({
      id: `satisfaction-trend-${Date.now()}`,
      insight_type: 'trend',
      title: isPositive ? 'Satisfaction Improving' : 'Satisfaction Declining',
      description: `User satisfaction has ${isPositive ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% over the analysis period.`,
      severity: Math.abs(change) > 20 ? 'high' : 'medium',
      detected_at: new Date().toISOString(),
      metadata: { change_percent: change, recent_avg: recentAvg, older_avg: olderAvg }
    });
  }
}

function detectNegativeSentimentSpike(trends: SentimentTrend[], insights: SentimentInsight[]): void {
  for (let i = 0; i < trends.length; i++) {
    const trend = trends[i];
    const totalSentiment = trend.positive_count + trend.neutral_count + trend.negative_count;

    if (totalSentiment === 0) continue;

    const negativeRatio = trend.negative_count / totalSentiment;

    if (negativeRatio > 0.4) {
      insights.push({
        id: `negative-spike-${Date.now()}-${i}`,
        insight_type: 'anomaly',
        title: 'High Negative Sentiment Detected',
        description: `On ${trend.date}, ${(negativeRatio * 100).toFixed(0)}% of conversations showed negative sentiment.`,
        severity: negativeRatio > 0.6 ? 'high' : 'medium',
        detected_at: new Date().toISOString(),
        metadata: { date: trend.date, negative_ratio: negativeRatio, total_conversations: totalSentiment }
      });
    }
  }
}

function detectPositivePattern(trends: SentimentTrend[], insights: SentimentInsight[]): void {
  if (trends.length < 5) return;

  const recentTrends = trends.slice(-5);
  let consecutivePositive = 0;

  for (const trend of recentTrends) {
    const totalSentiment = trend.positive_count + trend.neutral_count + trend.negative_count;
    if (totalSentiment === 0) continue;

    const positiveRatio = trend.positive_count / totalSentiment;
    if (positiveRatio > 0.5) {
      consecutivePositive++;
    }
  }

  if (consecutivePositive >= 4) {
    insights.push({
      id: `positive-pattern-${Date.now()}`,
      insight_type: 'pattern',
      title: 'Consistent Positive Sentiment',
      description: `Strong positive sentiment detected across ${consecutivePositive} recent days.`,
      severity: 'low',
      detected_at: new Date().toISOString(),
      metadata: { consecutive_days: consecutivePositive }
    });
  }
}
