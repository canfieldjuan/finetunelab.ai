// Error Analysis Operation
// Analyzes error patterns from message_evaluations data
// Date: October 20, 2025

import { supabase } from '@/lib/supabaseClient';
import type { ErrorAnalysis, ErrorPattern } from '../types';

interface MessageWithError {
  id: string;
  error_type: string | null;
  fallback_used: boolean | null;
  model_id: string | null;
  provider: string | null;
  created_at: string;
  message_evaluations: Array<{
    rating: number;
    success: boolean;
    failure_tags: string[] | null;
    notes: string | null;
  }>;
}

/**
 * Analyzes error patterns and their impact on quality
 * Uses previously unused fields: error_type, fallback_used
 */
export async function getErrorAnalysis(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ErrorAnalysis> {
  console.log('[ErrorAnalysis] Starting analysis', {
    userId,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
  });

  // Query messages with errors and their evaluations
  const { data: messagesWithErrors, error: queryError } = await supabase
    .from('messages')
    .select(
      `
      id,
      error_type,
      fallback_used,
      model_id,
      provider,
      created_at,
      message_evaluations!inner (
        rating,
        success,
        failure_tags,
        notes
      )
    `
    )
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false });

  if (queryError) {
    console.error('[ErrorAnalysis] Query failed:', queryError);
    throw new Error(`Failed to fetch error data: ${queryError.message}`);
  }

  if (!messagesWithErrors || messagesWithErrors.length === 0) {
    console.log('[ErrorAnalysis] No data found in period');
    return createEmptyAnalysis(startDate, endDate);
  }

  console.log('[ErrorAnalysis] Processing messages:', messagesWithErrors.length);

  const typedMessages = messagesWithErrors as unknown as MessageWithError[];

  // Analyze error patterns
  const errorPatterns = analyzeErrorPatterns(typedMessages);
  const fallbackImpact = analyzeFallbackImpact(typedMessages);
  const insights = generateInsights(errorPatterns, fallbackImpact);

  const analysis: ErrorAnalysis = {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalMessages: typedMessages.length,
    messagesWithErrors: typedMessages.filter((m) => m.error_type !== null).length,
    messagesWithFallback: typedMessages.filter((m) => m.fallback_used === true).length,
    errorPatterns,
    fallbackImpact,
    insights,
  };

  console.log('[ErrorAnalysis] Analysis complete:', {
    totalMessages: analysis.totalMessages,
    errorCount: analysis.messagesWithErrors,
    fallbackCount: analysis.messagesWithFallback,
  });

  return analysis;
}

/**
 * Analyze error type patterns and their quality impact
 */
function analyzeErrorPatterns(messages: MessageWithError[]): ErrorPattern[] {
  const errorMap = new Map<string, {
    count: number;
    ratings: number[];
    successCount: number;
    models: Set<string>;
  }>();

  messages.forEach((msg) => {
    if (!msg.error_type) return;

    const evaluations = msg.message_evaluations;
    if (!evaluations || evaluations.length === 0) return;

    const eval0 = evaluations[0];
    const existing = errorMap.get(msg.error_type);

    if (existing) {
      existing.count += 1;
      existing.ratings.push(eval0.rating);
      if (eval0.success) existing.successCount += 1;
      if (msg.model_id) existing.models.add(msg.model_id);
    } else {
      errorMap.set(msg.error_type, {
        count: 1,
        ratings: [eval0.rating],
        successCount: eval0.success ? 1 : 0,
        models: msg.model_id ? new Set([msg.model_id]) : new Set(),
      });
    }
  });

  // Convert to array and calculate metrics
  const patterns: ErrorPattern[] = Array.from(errorMap.entries()).map(
    ([errorType, data]) => {
      const avgRating = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
      const successRate = (data.successCount / data.count) * 100;

      return {
        errorType,
        occurrences: data.count,
        averageRating: Number(avgRating.toFixed(2)),
        successRate: Number(successRate.toFixed(1)),
        affectedModels: Array.from(data.models),
      };
    }
  );

  // Sort by occurrences descending
  return patterns.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Analyze fallback usage impact on quality
 */
function analyzeFallbackImpact(messages: MessageWithError[]): {
  fallbackUsed: { count: number; averageRating: number; successRate: number };
  noFallback: { count: number; averageRating: number; successRate: number };
  improvement: number;
} {
  const fallbackMessages = messages.filter((m) => m.fallback_used === true);
  const noFallbackMessages = messages.filter((m) => m.fallback_used === false);

  const calcMetrics = (msgs: MessageWithError[]) => {
    if (msgs.length === 0) return { count: 0, averageRating: 0, successRate: 0 };

    let totalRating = 0;
    let successCount = 0;

    msgs.forEach((msg) => {
      const evals = msg.message_evaluations;
      if (evals && evals.length > 0) {
        totalRating += evals[0].rating;
        if (evals[0].success) successCount += 1;
      }
    });

    return {
      count: msgs.length,
      averageRating: Number((totalRating / msgs.length).toFixed(2)),
      successRate: Number(((successCount / msgs.length) * 100).toFixed(1)),
    };
  };

  const fallbackMetrics = calcMetrics(fallbackMessages);
  const noFallbackMetrics = calcMetrics(noFallbackMessages);

  const improvement =
    fallbackMetrics.count > 0 && noFallbackMetrics.count > 0
      ? Number(((fallbackMetrics.averageRating - noFallbackMetrics.averageRating) / noFallbackMetrics.averageRating * 100).toFixed(1))
      : 0;

  return {
    fallbackUsed: fallbackMetrics,
    noFallback: noFallbackMetrics,
    improvement,
  };
}

/**
 * Generate actionable insights from error analysis
 */
function generateInsights(
  errorPatterns: ErrorPattern[],
  fallbackImpact: ReturnType<typeof analyzeFallbackImpact>
): string[] {
  const insights: string[] = [];

  // Top error type insight
  if (errorPatterns.length > 0) {
    const topError = errorPatterns[0];
    insights.push(
      `Most common error: "${topError.errorType}" (${topError.occurrences} occurrences, ${topError.averageRating}/5 avg rating)`
    );
  }

  // Fallback effectiveness
  if (fallbackImpact.fallbackUsed.count > 0) {
    if (fallbackImpact.improvement > 0) {
      insights.push(
        `Fallback mechanism improves quality by ${fallbackImpact.improvement}% (${fallbackImpact.fallbackUsed.averageRating} vs ${fallbackImpact.noFallback.averageRating})`
      );
    } else if (fallbackImpact.improvement < 0) {
      insights.push(
        `Fallback mechanism decreases quality by ${Math.abs(fallbackImpact.improvement)}% - review fallback logic`
      );
    }
  }

  // Low quality error patterns
  const lowQualityErrors = errorPatterns.filter((p) => p.averageRating < 3);
  if (lowQualityErrors.length > 0) {
    insights.push(
      `${lowQualityErrors.length} error types have below-average quality (<3/5) - prioritize fixing: ${lowQualityErrors.map((e) => e.errorType).join(', ')}`
    );
  }

  // Model-specific errors
  const modelSpecificErrors = errorPatterns.filter((p) => p.affectedModels.length === 1);
  if (modelSpecificErrors.length > 0) {
    insights.push(
      `${modelSpecificErrors.length} error types are model-specific - consider model-specific error handling`
    );
  }

  return insights;
}

/**
 * Create empty analysis for periods with no data
 */
function createEmptyAnalysis(startDate: Date, endDate: Date): ErrorAnalysis {
  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalMessages: 0,
    messagesWithErrors: 0,
    messagesWithFallback: 0,
    errorPatterns: [],
    fallbackImpact: {
      fallbackUsed: { count: 0, averageRating: 0, successRate: 0 },
      noFallback: { count: 0, averageRating: 0, successRate: 0 },
      improvement: 0,
    },
    insights: ['No data available for this period'],
  };
}
