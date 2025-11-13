// Evaluation Metrics Tool - Configuration
// Date: October 13, 2025

export const evaluationMetricsConfig = {
  enabled: true,

  // Default analysis period
  defaultPeriod: 'week' as const,

  // Thresholds for quality assessment
  thresholds: {
    excellentRating: 4.5, // >= 4.5 is excellent
    goodRating: 3.5, // >= 3.5 is good
    poorRating: 2.5, // < 2.5 is poor
    minSuccessRate: 0.8, // 80% success rate target
  },

  // Trend detection
  trendDetection: {
    improvingThreshold: 0.1, // +10% improvement
    decliningThreshold: -0.1, // -10% decline
    minDataPoints: 3, // Need 3+ points for trend
  },

  // Query limits
  maxEvaluationsAnalyzed: 10000,
  maxTrendDataPoints: 100,
};
