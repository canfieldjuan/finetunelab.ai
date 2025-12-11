// Anomaly Detection Service
// Purpose: Detect statistical anomalies and outliers in analytics metrics
// Date: 2025-10-25
// Phase: 2.1 - Proactive Monitoring

import { createClient } from '@/lib/supabase/client';

interface DataPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, unknown>;
}

interface AnomalyResult {
  isAnomaly: boolean;
  type: 'statistical_outlier' | 'iqr_outlier' | 'sudden_drop' | 'sudden_spike' | 'sustained_degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  detectedValue: number;
  expectedRange: { lower: number; upper: number };
  deviation: number;
  description: string;
  contributingFactors: string[];
  recommendedActions: string[];
}

interface StatisticalMetrics {
  mean: number;
  median: number;
  stdDev: number;
  q1: number;
  q3: number;
  iqr: number;
}

/**
 * Calculate statistical metrics for a dataset
 */
function calculateStatistics(values: number[]): StatisticalMetrics {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, q1: 0, q3: 0, iqr: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // Calculate mean
  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  // Calculate median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // Calculate standard deviation
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Calculate quartiles
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  return { mean, median, stdDev, q1, q3, iqr };
}

/**
 * Detect statistical outliers using z-score
 */
function detectStatisticalOutlier(
  value: number,
  stats: StatisticalMetrics,
  threshold: number = 3
): { isOutlier: boolean; zScore: number } {
  if (stats.stdDev === 0) {
    return { isOutlier: false, zScore: 0 };
  }

  const zScore = Math.abs((value - stats.mean) / stats.stdDev);
  return {
    isOutlier: zScore > threshold,
    zScore
  };
}

/**
 * Detect outliers using IQR method
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function detectIQROutlier(
  value: number,
  stats: StatisticalMetrics
): { isOutlier: boolean; distance: number } {
  const lowerBound = stats.q1 - 1.5 * stats.iqr;
  const upperBound = stats.q3 + 1.5 * stats.iqr;

  const isOutlier = value < lowerBound || value > upperBound;
  const distance = value < lowerBound
    ? lowerBound - value
    : value > upperBound
      ? value - upperBound
      : 0;

  return { isOutlier, distance };
}

/**
 * Analyze data points for anomalies
 */
export async function detectAnomalies(
  dataPoints: DataPoint[],
  metricName: string,
  options: {
    zScoreThreshold?: number;
    suddenChangeThreshold?: number;
  } = {}
): Promise<AnomalyResult[]> {
  console.log(`[AnomalyDetection] Analyzing ${dataPoints.length} data points for ${metricName}`);

  if (dataPoints.length < 10) {
    console.log('[AnomalyDetection] Insufficient data for analysis');
    return [];
  }

  const values = dataPoints.map(dp => dp.value);
  const stats = calculateStatistics(values);
  const anomalies: AnomalyResult[] = [];

  console.log('[AnomalyDetection] Statistics:', stats);

  // Check latest value for anomalies
  const latestPoint = dataPoints[dataPoints.length - 1];
  const latestValue = latestPoint.value;

  // Statistical outlier detection
  const outlierCheck = detectStatisticalOutlier(
    latestValue,
    stats,
    options.zScoreThreshold || 3
  );

  if (outlierCheck.isOutlier) {
    const deviationPercent = ((latestValue - stats.mean) / stats.mean) * 100;

    anomalies.push({
      isAnomaly: true,
      type: 'statistical_outlier',
      severity: outlierCheck.zScore > 5 ? 'critical' : outlierCheck.zScore > 4 ? 'high' : 'medium',
      confidence: Math.min(outlierCheck.zScore / 5, 1),
      detectedValue: latestValue,
      expectedRange: {
        lower: stats.mean - 3 * stats.stdDev,
        upper: stats.mean + 3 * stats.stdDev
      },
      deviation: deviationPercent,
      description: `${metricName} is ${deviationPercent.toFixed(1)}% ${latestValue > stats.mean ? 'above' : 'below'} expected range`,
      contributingFactors: [],
      recommendedActions: ['Investigate recent changes', 'Review related metrics']
    });
  }

  return anomalies;
}

/**
 * Save detected anomaly to database
 */
export async function saveAnomaly(
  userId: string,
  metricName: string,
  anomaly: AnomalyResult,
  options: {
    modelId?: string;
    conversationId?: string;
    toolName?: string;
  } = {}
): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log(`[AnomalyDetection] Saving anomaly for ${metricName}`);

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('anomaly_detections')
      .insert({
        user_id: userId,
        anomaly_type: anomaly.type,
        severity: anomaly.severity,
        confidence_score: anomaly.confidence,
        metric_name: metricName,
        model_id: options.modelId,
        conversation_id: options.conversationId,
        tool_name: options.toolName,
        detected_value: anomaly.detectedValue,
        expected_value: (anomaly.expectedRange.lower + anomaly.expectedRange.upper) / 2,
        threshold_value: anomaly.expectedRange.upper,
        deviation_percentage: anomaly.deviation,
        statistics: {
          expectedRange: anomaly.expectedRange,
          confidence: anomaly.confidence
        },
        description: anomaly.description,
        contributing_factors: anomaly.contributingFactors,
        recommended_actions: anomaly.recommendedActions
      })
      .select('id')
      .single();

    if (error) {
      console.error('[AnomalyDetection] Save error:', error);
      return { success: false, error: error.message };
    }

    console.log('[AnomalyDetection] Anomaly saved:', data.id);
    return { success: true, id: data.id };
  } catch (err) {
    console.error('[AnomalyDetection] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}