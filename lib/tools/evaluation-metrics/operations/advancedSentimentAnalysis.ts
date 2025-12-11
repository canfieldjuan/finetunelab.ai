// Advanced Sentiment Analysis Operation
// Enhanced textual analysis with multi-level sentiment and emotion detection
// Date: October 20, 2025

import { supabase } from '@/lib/supabaseClient';
import type { AdvancedSentimentAnalysis, SentimentLevel, EmotionDetection } from '../types';

interface EvaluationWithText {
  id: string;
  rating: number;
  success: boolean;
  notes: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  created_at: string;
}

// Sentiment keyword weights
const SENTIMENT_KEYWORDS = {
  veryPositive: {
    keywords: ['amazing', 'excellent', 'perfect', 'outstanding', 'fantastic', 'love', 'brilliant'],
    weight: 1.0
  },
  positive: {
    keywords: ['good', 'helpful', 'useful', 'works', 'nice', 'clear', 'easy', 'thanks'],
    weight: 0.6
  },
  negative: {
    keywords: ['bad', 'unhelpful', 'useless', 'wrong', 'incorrect', 'missing', 'broken'],
    weight: -0.6
  },
  veryNegative: {
    keywords: ['terrible', 'horrible', 'awful', 'worst', 'hate', 'garbage', 'useless'],
    weight: -1.0
  }
};

// Emotion detection keywords
const EMOTION_KEYWORDS = {
  frustrated: ['frustrated', 'annoying', 'irritating', 'stuck', 'waste', 'again'],
  confused: ['confused', 'unclear', 'ambiguous', 'what', 'why', 'how', 'understand'],
  satisfied: ['satisfied', 'good', 'works', 'thanks', 'appreciate', 'helpful'],
  delighted: ['amazing', 'perfect', 'excellent', 'love', 'awesome', 'fantastic']
};

// Phrase patterns (negations and intensifiers)
const PHRASE_PATTERNS = [
  { pattern: /not (good|helpful|working|useful)/gi, sentiment: -0.8, name: 'negation' },
  { pattern: /very (good|helpful|useful|clear)/gi, sentiment: 0.8, name: 'intensifier_positive' },
  { pattern: /very (bad|poor|slow|confusing)/gi, sentiment: -0.8, name: 'intensifier_negative' },
  { pattern: /could be better/gi, sentiment: -0.3, name: 'improvement_needed' },
  { pattern: /much better/gi, sentiment: 0.7, name: 'significant_improvement' },
  { pattern: /(does not|doesn't|did not|didn't) work/gi, sentiment: -0.9, name: 'failure' }
];

/**
 * Advanced sentiment analysis with multi-level classification
 * and emotion detection
 */
export async function getAdvancedSentimentAnalysis(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<AdvancedSentimentAnalysis> {
  console.log('[AdvancedSentiment] Starting analysis', {
    userId,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
  });

  // Query evaluations with textual content
  const { data: evaluations, error: queryError } = await supabase
    .from('message_evaluations')
    .select('id, rating, success, notes, expected_behavior, actual_behavior, created_at')
    .eq('evaluator_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false });

  if (queryError) {
    console.error('[AdvancedSentiment] Query failed:', queryError);
    throw new Error(`Failed to fetch evaluation data: ${queryError.message}`);
  }

  if (!evaluations || evaluations.length === 0) {
    console.log('[AdvancedSentiment] No data found in period');
    return createEmptyAnalysis(startDate, endDate);
  }

  const typedEvaluations = evaluations as EvaluationWithText[];

  // Filter to evaluations with text
  const withText = typedEvaluations.filter(
    (e) => e.notes || e.expected_behavior || e.actual_behavior
  );

  console.log('[AdvancedSentiment] Processing evaluations with text:', withText.length);

  // Analyze sentiment for each evaluation
  const sentimentScores: number[] = [];
  const confidenceScores: number[] = [];
  const emotionCounts = { frustrated: 0, confused: 0, satisfied: 0, delighted: 0 };
  const phraseMatches = new Map<string, number>();

  withText.forEach((evaluation) => {
    const analysis = analyzeSentiment(evaluation);
    sentimentScores.push(analysis.score);
    confidenceScores.push(analysis.confidence);

    // Count emotions
    analysis.emotions.forEach((emotion) => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });

    // Track phrase patterns
    analysis.phrases.forEach((phrase) => {
      phraseMatches.set(phrase, (phraseMatches.get(phrase) || 0) + 1);
    });
  });

  // Calculate distribution
  const sentimentDistribution = calculateDistribution(sentimentScores);

  // Get top phrases
  const topPhrases = Array.from(phraseMatches.entries())
    .map(([phrase, count]) => {
      const pattern = PHRASE_PATTERNS.find(p => p.name === phrase);
      return {
        phrase: pattern?.name || phrase,
        sentiment: pattern?.sentiment || 0,
        occurrences: count
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);

  // Calculate average confidence
  const avgConfidence = confidenceScores.length > 0
    ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
    : 0;

  // Generate insights
  const insights = generateInsights(
    sentimentDistribution,
    emotionCounts,
    avgConfidence,
    withText.length
  );

  const analysis: AdvancedSentimentAnalysis = {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalAnalyzed: withText.length,
    sentimentDistribution,
    emotionDetection: emotionCounts,
    averageConfidence: Number(avgConfidence.toFixed(2)),
    topPhrases,
    insights,
  };

  console.log('[AdvancedSentiment] Analysis complete:', {
    totalAnalyzed: analysis.totalAnalyzed,
    avgConfidence: analysis.averageConfidence,
    dominantEmotion: Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none'
  });

  return analysis;
}

/**
 * Analyze sentiment of a single evaluation
 */
function analyzeSentiment(evaluation: EvaluationWithText): {
  score: number;
  confidence: number;
  emotions: Array<keyof typeof EMOTION_KEYWORDS>;
  phrases: string[];
} {
  const text = [
    evaluation.notes,
    evaluation.expected_behavior,
    evaluation.actual_behavior
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  let indicators = 0;
  const emotions: Array<keyof typeof EMOTION_KEYWORDS> = [];
  const phrases: string[] = [];

  // Check phrase patterns first (higher priority)
  PHRASE_PATTERNS.forEach((pattern) => {
    const matches = text.match(pattern.pattern);
    if (matches) {
      score += pattern.sentiment * matches.length;
      indicators += matches.length * 2; // Phrases count double
      phrases.push(pattern.name);
    }
  });

  // Check sentiment keywords
  Object.entries(SENTIMENT_KEYWORDS).forEach(([, { keywords, weight }]) => {
    keywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        score += weight;
        indicators += 1;
      }
    });
  });

  // Detect emotions
  Object.entries(EMOTION_KEYWORDS).forEach(([emotion, keywords]) => {
    const hasEmotion = keywords.some((kw) => text.includes(kw));
    if (hasEmotion) {
      emotions.push(emotion as keyof typeof EMOTION_KEYWORDS);
    }
  });

  // Normalize score to -1 to +1 range
  const normalizedScore = indicators > 0 ? Math.max(-1, Math.min(1, score / indicators)) : 0;

  // Calculate confidence based on indicators and text length
  const wordCount = text.split(/\s+/).length;
  const baseConfidence = Math.min(indicators / 5, 1.0); // More indicators = higher confidence
  const lengthFactor = Math.min(wordCount / 20, 1.0); // Longer text = higher confidence
  const confidence = (baseConfidence + lengthFactor) / 2;

  return {
    score: normalizedScore,
    confidence,
    emotions,
    phrases
  };
}

/**
 * Calculate sentiment distribution across 5 levels
 */
function calculateDistribution(scores: number[]): SentimentLevel {
  const distribution = {
    veryPositive: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    veryNegative: 0
  };

  scores.forEach((score) => {
    if (score >= 0.6) distribution.veryPositive += 1;
    else if (score >= 0.2) distribution.positive += 1;
    else if (score >= -0.2) distribution.neutral += 1;
    else if (score >= -0.6) distribution.negative += 1;
    else distribution.veryNegative += 1;
  });

  return distribution;
}

/**
 * Generate actionable insights
 */
function generateInsights(
  distribution: SentimentLevel,
  emotions: EmotionDetection,
  avgConfidence: number,
  totalAnalyzed: number
): string[] {
  const insights: string[] = [];

  // Overall sentiment
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const positivePercent = total > 0 ? ((distribution.veryPositive + distribution.positive) / total) * 100 : 0;
  const negativePercent = total > 0 ? ((distribution.veryNegative + distribution.negative) / total) * 100 : 0;

  if (positivePercent > 70) {
    insights.push(`Strong positive sentiment: ${positivePercent.toFixed(1)}% of feedback is positive or very positive`);
  } else if (negativePercent > 50) {
    insights.push(`Concerning negative sentiment: ${negativePercent.toFixed(1)}% of feedback is negative - immediate attention needed`);
  }

  // Dominant emotion
  const dominantEmotion = Object.entries(emotions)
    .sort((a, b) => b[1] - a[1])[0];

  if (dominantEmotion && dominantEmotion[1] > 0) {
    const emotionPercent = (dominantEmotion[1] / totalAnalyzed) * 100;
    insights.push(`Dominant emotion: ${dominantEmotion[0]} detected in ${emotionPercent.toFixed(1)}% of feedback`);
  }

  // Confidence level
  if (avgConfidence > 0.7) {
    insights.push(`High confidence analysis: ${(avgConfidence * 100).toFixed(0)}% average confidence in sentiment detection`);
  } else if (avgConfidence < 0.4) {
    insights.push(`Low confidence analysis: consider collecting more detailed feedback for better insights`);
  }

  // Specific emotion insights
  if (emotions.frustrated > totalAnalyzed * 0.3) {
    insights.push(`High frustration detected in ${((emotions.frustrated / totalAnalyzed) * 100).toFixed(1)}% of feedback - investigate usability issues`);
  }

  if (emotions.confused > totalAnalyzed * 0.3) {
    insights.push(`Confusion detected in ${((emotions.confused / totalAnalyzed) * 100).toFixed(1)}% of feedback - improve clarity and documentation`);
  }

  return insights;
}

/**
 * Create empty analysis for periods with no data
 */
function createEmptyAnalysis(startDate: Date, endDate: Date): AdvancedSentimentAnalysis {
  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalAnalyzed: 0,
    sentimentDistribution: {
      veryPositive: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      veryNegative: 0
    },
    emotionDetection: {
      frustrated: 0,
      confused: 0,
      satisfied: 0,
      delighted: 0
    },
    averageConfidence: 0,
    topPhrases: [],
    insights: ['No data available for this period']
  };
}
