// Textual Feedback Analysis Operation
// Analyzes qualitative feedback from notes, expected_behavior, and actual_behavior fields
// Date: October 20, 2025

import { supabase } from '@/lib/supabaseClient';
import type { TextualFeedbackAnalysis, FeedbackPattern, FeedbackCategory } from '../types';

interface EvaluationWithFeedback {
  id: string;
  rating: number;
  success: boolean;
  notes: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  created_at: string;
}

/**
 * Analyzes textual feedback from evaluations
 * Uses previously unused fields: notes, expected_behavior, actual_behavior
 */
export async function getTextualFeedbackAnalysis(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<TextualFeedbackAnalysis> {
  console.log('[TextualFeedback] Starting analysis', {
    userId,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
  });

  // Query evaluations with textual feedback
  const { data: evaluations, error: queryError } = await supabase
    .from('message_evaluations')
    .select('id, rating, success, notes, expected_behavior, actual_behavior, created_at')
    .eq('evaluator_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false });

  if (queryError) {
    console.error('[TextualFeedback] Query failed:', queryError);
    throw new Error(`Failed to fetch feedback data: ${queryError.message}`);
  }

  if (!evaluations || evaluations.length === 0) {
    console.log('[TextualFeedback] No data found in period');
    return createEmptyAnalysis(startDate, endDate);
  }

  console.log('[TextualFeedback] Processing evaluations:', evaluations.length);

  const typedEvaluations = evaluations as EvaluationWithFeedback[];

  // Filter to only evaluations with some textual feedback
  const withFeedback = typedEvaluations.filter(
    (e) => e.notes || e.expected_behavior || e.actual_behavior
  );

  console.log('[TextualFeedback] Evaluations with feedback:', withFeedback.length);

  // Analyze feedback patterns
  const feedbackPatterns = analyzeFeedbackPatterns(withFeedback);
  const categories = categorizeFeedback(withFeedback);
  const commonThemes = extractCommonThemes(withFeedback);
  const qualityCorrelation = analyzeQualityCorrelation(withFeedback);
  const insights = generateInsights(withFeedback, feedbackPatterns, categories);

  const analysis: TextualFeedbackAnalysis = {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalEvaluations: typedEvaluations.length,
    evaluationsWithFeedback: withFeedback.length,
    feedbackCompleteness: {
      withNotes: typedEvaluations.filter((e) => e.notes).length,
      withExpectedBehavior: typedEvaluations.filter((e) => e.expected_behavior).length,
      withActualBehavior: typedEvaluations.filter((e) => e.actual_behavior).length,
      withAllFields: typedEvaluations.filter(
        (e) => e.notes && e.expected_behavior && e.actual_behavior
      ).length,
    },
    feedbackPatterns,
    categories,
    commonThemes,
    qualityCorrelation,
    insights,
  };

  console.log('[TextualFeedback] Analysis complete:', {
    totalEvaluations: analysis.totalEvaluations,
    withFeedback: analysis.evaluationsWithFeedback,
    patternCount: analysis.feedbackPatterns.length,
  });

  return analysis;
}

/**
 * Analyze patterns in feedback content
 */
function analyzeFeedbackPatterns(evaluations: EvaluationWithFeedback[]): FeedbackPattern[] {
  const patterns: FeedbackPattern[] = [];

  // Common keywords to track
  const keywords = [
    'slow', 'fast', 'accurate', 'incorrect', 'missing', 'incomplete',
    'helpful', 'unhelpful', 'confusing', 'clear', 'error', 'bug',
    'timeout', 'hallucination', 'hallucinated', 'wrong', 'correct'
  ];

  keywords.forEach((keyword) => {
    const matches = evaluations.filter((e) => {
      const text = [e.notes, e.expected_behavior, e.actual_behavior]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(keyword);
    });

    if (matches.length > 0) {
      const avgRating = matches.reduce((sum, e) => sum + e.rating, 0) / matches.length;
      const successRate = (matches.filter((e) => e.success).length / matches.length) * 100;

      patterns.push({
        keyword,
        occurrences: matches.length,
        averageRating: Number(avgRating.toFixed(2)),
        successRate: Number(successRate.toFixed(1)),
        sentiment: avgRating >= 4 ? 'positive' : avgRating >= 3 ? 'neutral' : 'negative',
      });
    }
  });

  // Sort by occurrences descending
  return patterns.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Categorize feedback by type
 */
function categorizeFeedback(evaluations: EvaluationWithFeedback[]): FeedbackCategory[] {
  const categories = new Map<string, {
    count: number;
    ratings: number[];
    successCount: number;
    examples: string[];
  }>();

  evaluations.forEach((evaluation) => {
    const text = [evaluation.notes, evaluation.expected_behavior, evaluation.actual_behavior]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // Categorize based on content
    const categoryMap: Record<string, string[]> = {
      'Performance': ['slow', 'fast', 'timeout', 'latency', 'quick', 'speed'],
      'Accuracy': ['correct', 'incorrect', 'wrong', 'accurate', 'inaccurate', 'hallucination'],
      'Completeness': ['missing', 'incomplete', 'partial', 'complete', 'thorough'],
      'Clarity': ['clear', 'confusing', 'unclear', 'ambiguous', 'vague', 'understandable'],
      'Helpfulness': ['helpful', 'unhelpful', 'useful', 'useless', 'valuable'],
      'Errors': ['error', 'bug', 'crash', 'fail', 'exception'],
    };

    Object.entries(categoryMap).forEach(([category, keywords]) => {
      const matches = keywords.some((kw) => text.includes(kw));
      if (matches) {
        const existing = categories.get(category);
        const feedbackText = evaluation.notes || evaluation.expected_behavior || '';
        const example = feedbackText.substring(0, 100);

        if (existing) {
          existing.count += 1;
          existing.ratings.push(evaluation.rating);
          if (evaluation.success) existing.successCount += 1;
          if (example && existing.examples.length < 3) {
            existing.examples.push(example);
          }
        } else {
          categories.set(category, {
            count: 1,
            ratings: [evaluation.rating],
            successCount: evaluation.success ? 1 : 0,
            examples: example ? [example] : [],
          });
        }
      }
    });
  });

  // Convert to array
  const result: FeedbackCategory[] = Array.from(categories.entries()).map(
    ([category, data]) => {
      const avgRating = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
      const successRate = (data.successCount / data.count) * 100;

      return {
        category,
        count: data.count,
        averageRating: Number(avgRating.toFixed(2)),
        successRate: Number(successRate.toFixed(1)),
        topExamples: data.examples,
      };
    }
  );

  return result.sort((a, b) => b.count - a.count);
}

/**
 * Extract common themes from feedback
 */
function extractCommonThemes(evaluations: EvaluationWithFeedback[]): string[] {
  const themes: string[] = [];
  const textSamples: string[] = [];

  // Collect text samples from low-rated evaluations (potential issues)
  evaluations
    .filter((e) => e.rating <= 3)
    .forEach((e) => {
      if (e.notes) textSamples.push(e.notes);
      if (e.expected_behavior && e.actual_behavior) {
        textSamples.push(`Expected: ${e.expected_behavior} | Actual: ${e.actual_behavior}`);
      }
    });

  // Basic theme detection (can be enhanced with NLP later)
  if (textSamples.length > 0) {
    themes.push(`${textSamples.length} detailed feedback entries for low-rated responses`);
  }

  return themes;
}

/**
 * Analyze correlation between feedback presence and quality
 */
function analyzeQualityCorrelation(
  evaluations: EvaluationWithFeedback[]
): { withFeedback: { avgRating: number; successRate: number }; withoutFeedback: { avgRating: number; successRate: number }; correlation: string } {
  const withFeedback = evaluations.filter((e) => e.notes || e.expected_behavior || e.actual_behavior);
  const withoutFeedback = evaluations.filter((e) => !e.notes && !e.expected_behavior && !e.actual_behavior);

  const calcMetrics = (items: EvaluationWithFeedback[]) => {
    if (items.length === 0) return { avgRating: 0, successRate: 0 };
    const avgRating = items.reduce((sum, e) => sum + e.rating, 0) / items.length;
    const successRate = (items.filter((e) => e.success).length / items.length) * 100;
    return {
      avgRating: Number(avgRating.toFixed(2)),
      successRate: Number(successRate.toFixed(1)),
    };
  };

  const withMetrics = calcMetrics(withFeedback);
  const withoutMetrics = calcMetrics(withoutFeedback);

  let correlation = 'No clear correlation';
  if (withMetrics.avgRating < withoutMetrics.avgRating - 0.5) {
    correlation = 'Users provide more feedback for poor responses';
  } else if (withMetrics.avgRating > withoutMetrics.avgRating + 0.5) {
    correlation = 'Users provide more feedback for good responses';
  }

  return {
    withFeedback: withMetrics,
    withoutFeedback: withoutMetrics,
    correlation,
  };
}

/**
 * Generate actionable insights
 */
function generateInsights(
  evaluations: EvaluationWithFeedback[],
  patterns: FeedbackPattern[],
  categories: FeedbackCategory[]
): string[] {
  const insights: string[] = [];

  // Feedback completion rate
  const completionRate = (evaluations.length / evaluations.length) * 100;
  if (completionRate < 20) {
    insights.push('Low feedback completion rate - consider prompting users for more details');
  }

  // Top patterns
  if (patterns.length > 0) {
    const topPattern = patterns[0];
    insights.push(
      `Most common feedback keyword: "${topPattern.keyword}" (${topPattern.occurrences} mentions, ${topPattern.averageRating}/5 avg)`
    );
  }

  // Problem areas
  const negativePatterns = patterns.filter((p) => p.sentiment === 'negative' && p.occurrences >= 3);
  if (negativePatterns.length > 0) {
    insights.push(
      `${negativePatterns.length} negative feedback patterns detected: ${negativePatterns.map((p) => p.keyword).join(', ')}`
    );
  }

  // Category insights
  if (categories.length > 0) {
    const topCategory = categories[0];
    insights.push(
      `Primary feedback category: ${topCategory.category} (${topCategory.count} mentions, ${topCategory.averageRating}/5 avg)`
    );
  }

  // Low-rated categories
  const lowRatedCategories = categories.filter((c) => c.averageRating < 3);
  if (lowRatedCategories.length > 0) {
    insights.push(
      `Areas needing improvement: ${lowRatedCategories.map((c) => c.category).join(', ')}`
    );
  }

  return insights;
}

/**
 * Create empty analysis for periods with no data
 */
function createEmptyAnalysis(startDate: Date, endDate: Date): TextualFeedbackAnalysis {
  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalEvaluations: 0,
    evaluationsWithFeedback: 0,
    feedbackCompleteness: {
      withNotes: 0,
      withExpectedBehavior: 0,
      withActualBehavior: 0,
      withAllFields: 0,
    },
    feedbackPatterns: [],
    categories: [],
    commonThemes: [],
    qualityCorrelation: {
      withFeedback: { avgRating: 0, successRate: 0 },
      withoutFeedback: { avgRating: 0, successRate: 0 },
      correlation: 'No data available',
    },
    insights: ['No data available for this period'],
  };
}
