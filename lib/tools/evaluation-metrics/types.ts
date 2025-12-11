// Evaluation Metrics Tool - Type Definitions
// Date: October 13, 2025

export interface EvaluationMetrics {
  userId: string;
  period: string;
  totalEvaluations: number;
  averageRating: number;
  successRate: number;
  qualityDistribution: {
    excellent: number; // 5 stars
    good: number; // 4 stars
    average: number; // 3 stars
    poor: number; // 2 stars
    veryPoor: number; // 1 star
  };
  breakdown: {
    successful: number;
    failed: number;
    unevaluated: number;
  };
}

export interface QualityTrend {
  period: string;
  dataPoints: TrendDataPoint[];
  trend: 'improving' | 'declining' | 'stable';
  changePercentage: number;
}

export interface TrendDataPoint {
  date: string;
  averageRating: number;
  evaluationCount: number;
}

export interface SuccessAnalysis {
  period: string;
  successRate: number;
  failureRate: number;
  totalInteractions: number;
  insights: string[];
  commonFailureTags: string[];
}

export interface PeriodComparison {
  currentPeriod: EvaluationMetrics;
  previousPeriod: EvaluationMetrics;
  changes: {
    ratingChange: number;
    successRateChange: number;
    volumeChange: number;
  };
  summary: string;
}

export interface MetricsOptions {
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
  startDate?: string;
  endDate?: string;
  conversationId?: string;
  minRating?: number;
  maxRating?: number;
}

// ============================================================================
// MODEL-SPECIFIC ANALYTICS TYPES
// ============================================================================

export interface ModelComparison {
  period: string;
  models: ModelPerformance[];
  bestModel: {
    byQuality: string;
    byCost: string;
    byValue: string; // quality per dollar
  };
  recommendations: string[];
}

export interface ModelPerformance {
  modelId: string;
  provider: string;
  averageRating: number;
  successRate: number;
  totalEvaluations: number;
  averageCost: number;
  qualityPerDollar: number;
  trend: 'improving' | 'declining' | 'stable';
}

// ============================================================================
// TOOL IMPACT ANALYSIS TYPES
// ============================================================================

export interface ToolImpactAnalysis {
  period: string;
  toolPerformance: ToolPerformance[];
  correlations: ToolCorrelation[];
  recommendations: string[];
}

export interface ToolPerformance {
  toolName: string;
  usageCount: number;
  averageRating: number;
  successRate: number;
  failureRate: number;
  commonFailureTags: string[];
  averageLatency: number;
}

export interface ToolCorrelation {
  toolName: string;
  qualityImpact: number; // -1 to +1
  significance: 'strong' | 'moderate' | 'weak';
}

// ============================================================================
// COST-QUALITY OPTIMIZATION TYPES
// ============================================================================

export interface CostQualityAnalysis {
  period: string;
  models: CostQualityModel[];
  recommendations: CostOptimizationRecommendation[];
  potentialSavings: number;
}

export interface CostQualityModel {
  modelId: string;
  provider: string;
  averageRating: number;
  averageCost: number;
  qualityPerDollar: number;
  totalSpent: number;
  tier: 'premium' | 'balanced' | 'budget';
}

export interface CostOptimizationRecommendation {
  currentModel: string;
  recommendedModel: string;
  qualityChange: number;
  costChange: number;
  savingsPercent: number;
  rationale: string;
}

// ============================================================================
// STATISTICAL ANALYSIS TYPES
// ============================================================================

export interface QualityStatistics {
  mean: number;
  median: number;
  standardDeviation: number;
  variance: number;
  coefficientOfVariation: number;
  min: number;
  max: number;
  outliers: number[];
}

// ============================================================================
// ERROR ANALYSIS TYPES (Phase 1 - Quick Wins)
// ============================================================================

export interface ErrorAnalysis {
  period: string;
  totalMessages: number;
  messagesWithErrors: number;
  messagesWithFallback: number;
  errorPatterns: ErrorPattern[];
  fallbackImpact: {
    fallbackUsed: { count: number; averageRating: number; successRate: number };
    noFallback: { count: number; averageRating: number; successRate: number };
    improvement: number;
  };
  insights: string[];
}

export interface ErrorPattern {
  errorType: string;
  occurrences: number;
  averageRating: number;
  successRate: number;
  affectedModels: string[];
}

// ============================================================================
// TEMPORAL ANALYSIS TYPES (Phase 1 - Quick Wins)
// ============================================================================

export interface TemporalAnalysis {
  period: string;
  hourlyDistribution: HourlyMetrics[];
  dayOfWeekDistribution: DayOfWeekMetrics[];
  peakPerformance: {
    bestHour: number;
    bestDay: string;
    bestHourRating: number;
    bestDayRating: number;
  };
  insights: string[];
}

export interface HourlyMetrics {
  hour: number;
  evaluationCount: number;
  averageRating: number;
  successRate: number;
}

export interface DayOfWeekMetrics {
  day: string;
  evaluationCount: number;
  averageRating: number;
  successRate: number;
}

// ============================================================================
// TEXTUAL FEEDBACK ANALYSIS TYPES (Phase 2 - Data Enrichment)
// ============================================================================

export interface TextualFeedbackAnalysis {
  period: string;
  totalEvaluations: number;
  evaluationsWithFeedback: number;
  feedbackCompleteness: {
    withNotes: number;
    withExpectedBehavior: number;
    withActualBehavior: number;
    withAllFields: number;
  };
  feedbackPatterns: FeedbackPattern[];
  categories: FeedbackCategory[];
  commonThemes: string[];
  qualityCorrelation: {
    withFeedback: { avgRating: number; successRate: number };
    withoutFeedback: { avgRating: number; successRate: number };
    correlation: string;
  };
  insights: string[];
}

export interface FeedbackPattern {
  keyword: string;
  occurrences: number;
  averageRating: number;
  successRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface FeedbackCategory {
  category: string;
  count: number;
  averageRating: number;
  successRate: number;
  topExamples: string[];
}

// ============================================================================
// BENCHMARK ANALYSIS TYPES (Phase 2 - Data Enrichment)
// ============================================================================

export interface BenchmarkAnalysis {
  period: string;
  benchmarksAnalyzed: number;
  totalJudgments: number;
  overallAccuracy: number;
  benchmarkResults: BenchmarkResult[];
  taskTypePerformance: TaskTypePerformance[];
  passingRate: number;
  insights: string[];
}

export interface BenchmarkResult {
  benchmarkId: string;
  benchmarkName: string;
  taskType: string;
  totalJudgments: number;
  passedJudgments: number;
  failedJudgments: number;
  passRate: number;
  averageScore: number;
  passCriteria: {
    minScore: number;
    requiredValidators: string[];
  };
}

export interface TaskTypePerformance {
  taskType: string;
  benchmarkCount: number;
  totalJudgments: number;
  averagePassRate: number;
  averageScore: number;
  topBenchmark: string;
}

// Phase 3 Tier 1: Advanced Sentiment Analysis Types
export interface AdvancedSentimentAnalysis {
  period: string;
  totalAnalyzed: number;
  sentimentDistribution: SentimentLevel;
  emotionDetection: EmotionDetection;
  averageConfidence: number;
  topPhrases: PhrasePattern[];
  insights: string[];
}

export interface SentimentLevel {
  veryPositive: number;
  positive: number;
  neutral: number;
  negative: number;
  veryNegative: number;
}

export interface EmotionDetection {
  frustrated: number;
  confused: number;
  satisfied: number;
  delighted: number;
}

export interface PhrasePattern {
  phrase: string;
  sentiment: number;
  occurrences: number;
}

// Phase 3 Tier 2: Predictive Quality Modeling Types
export interface PredictiveQualityModel {
  period: string;
  dataPointsAnalyzed: number;
  currentQuality: number;
  predictions: {
    sevenDay: QualityPrediction;
    thirtyDay: QualityPrediction;
  };
  riskScore: RiskScore;
  modelAccuracy: number;
  insights: string[];
}

export interface QualityPrediction {
  predictedRating: number;
  confidence: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  daysAhead: number;
}

export interface RiskScore {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  recommendations: string[];
}

// Phase 3 Tier 3: Anomaly Detection Types
export interface AnomalyDetection {
  period: string;
  totalEvaluations: number;
  anomaliesDetected: number;
  anomalies: Anomaly[];
  statistics: {
    mean: number;
    median: number;
    stdDev: number;
    q1: number;
    q3: number;
    iqr: number;
  };
  insights: string[];
}

export interface Anomaly {
  id: string;
  timestamp: string;
  type: 'statistical_outlier' | 'iqr_outlier' | 'sudden_drop' | 'sudden_spike' | 'sustained_degradation';
  severity: AnomalySeverity;
  value: number;
  expectedRange: {
    lower: number;
    upper: number;
  };
  deviation: number;
  description: string;
  contributingFactors: string[];
  recommendedAction: string;
}

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
