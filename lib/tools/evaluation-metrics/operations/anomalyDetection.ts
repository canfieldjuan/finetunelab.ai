// Anomaly Detection Operation
// Detects statistical outliers and temporal anomalies in quality data
// Date: October 20, 2025

import { supabase } from '@/lib/supabaseClient';
import type { AnomalyDetection, Anomaly, AnomalySeverity } from '../types';

interface EvaluationRecord {
  id: string;
  rating: number;
  success: boolean;
  created_at: string;
  error_type: string | null;
  fallback_used: boolean;
  tools_used: string[] | null;
}

interface DataPoint {
  id: string;
  timestamp: number;
  rating: number;
  success: boolean;
  hasError: boolean;
  fallbackUsed: boolean;
  toolCount: number;
}

/**
 * Anomaly detection using statistical and temporal methods
 * Identifies outliers and unusual patterns in quality data
 */
export async function getAnomalyDetection(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<AnomalyDetection> {
  console.log('[AnomalyDetection] Starting analysis', {
    userId,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
  });

  // Query evaluation data
  const { data: evaluations, error: queryError } = await supabase
    .from('message_evaluations')
    .select('id, rating, success, created_at, error_type, fallback_used, tools_used')
    .eq('evaluator_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });

  if (queryError) {
    console.error('[AnomalyDetection] Query failed:', queryError);
    throw new Error(`Failed to fetch evaluation data: ${queryError.message}`);
  }

  if (!evaluations || evaluations.length < 5) {
    console.log('[AnomalyDetection] Insufficient data (need ≥5 points)');
    return createInsufficientDataResponse(startDate, endDate, evaluations?.length || 0);
  }

  const typedEvaluations = evaluations as EvaluationRecord[];

  // Convert to data points
  const dataPoints = convertToDataPoints(typedEvaluations);

  console.log('[AnomalyDetection] Data points prepared:', {
    total: dataPoints.length,
    dateRange: {
      first: new Date(dataPoints[0].timestamp).toISOString(),
      last: new Date(dataPoints[dataPoints.length - 1].timestamp).toISOString(),
    },
  });

  // Detect anomalies using multiple methods
  const zScoreAnomalies = detectZScoreAnomalies(dataPoints);
  const iqrAnomalies = detectIQRAnomalies(dataPoints);
  const temporalAnomalies = detectTemporalAnomalies(dataPoints);
  const patternAnomalies = detectPatternAnomalies(dataPoints);

  // Merge and deduplicate anomalies
  const allAnomalies = mergeAnomalies([
    zScoreAnomalies,
    iqrAnomalies,
    temporalAnomalies,
    patternAnomalies,
  ]);

  // Calculate statistics
  const statistics = calculateStatistics(dataPoints);

  // Generate insights
  const insights = generateAnomalyInsights(allAnomalies, dataPoints, statistics);

  const result: AnomalyDetection = {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalEvaluations: dataPoints.length,
    anomaliesDetected: allAnomalies.length,
    anomalies: allAnomalies,
    statistics,
    insights,
  };

  console.log('[AnomalyDetection] Analysis complete:', {
    totalEvaluations: result.totalEvaluations,
    anomaliesDetected: result.anomaliesDetected,
    criticalAnomalies: allAnomalies.filter((a) => a.severity === 'critical').length,
  });

  return result;
}

/**
 * Convert evaluations to data points
 */
function convertToDataPoints(evaluations: EvaluationRecord[]): DataPoint[] {
  return evaluations.map((evaluation) => ({
    id: evaluation.id,
    timestamp: new Date(evaluation.created_at).getTime(),
    rating: evaluation.rating,
    success: evaluation.success,
    hasError: evaluation.error_type !== null,
    fallbackUsed: evaluation.fallback_used,
    toolCount: evaluation.tools_used?.length || 0,
  }));
}

/**
 * Detect anomalies using Z-score method
 * Flags points >3 standard deviations from mean
 */
function detectZScoreAnomalies(dataPoints: DataPoint[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const ratings = dataPoints.map((p) => p.rating);
  const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  const variance =
    ratings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratings.length;
  const stdDev = Math.sqrt(variance);

  dataPoints.forEach((point) => {
    const zScore = Math.abs((point.rating - mean) / stdDev);

    if (zScore > 3) {
      const severity = determineSeverity(zScore, 3, 4, 5);
      anomalies.push({
        id: point.id,
        timestamp: new Date(point.timestamp).toISOString(),
        type: 'statistical_outlier',
        severity,
        value: point.rating,
        expectedRange: {
          lower: Number((mean - 3 * stdDev).toFixed(2)),
          upper: Number((mean + 3 * stdDev).toFixed(2)),
        },
        deviation: Number(zScore.toFixed(2)),
        description: `Rating ${point.rating} is ${zScore.toFixed(1)} standard deviations from mean (${mean.toFixed(2)})`,
        contributingFactors: identifyContributingFactors(point),
        recommendedAction: generateRecommendation('statistical_outlier', severity, point),
      });
    }
  });

  return anomalies;
}

/**
 * Detect anomalies using IQR method
 * Flags points outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
 */
function detectIQRAnomalies(dataPoints: DataPoint[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const sortedRatings = dataPoints.map((p) => p.rating).sort((a, b) => a - b);
  const n = sortedRatings.length;

  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sortedRatings[q1Index];
  const q3 = sortedRatings[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  dataPoints.forEach((point) => {
    if (point.rating < lowerBound || point.rating > upperBound) {
      const distance = point.rating < lowerBound
        ? lowerBound - point.rating
        : point.rating - upperBound;
      const severity = determineSeverity(distance, 1, 1.5, 2);

      anomalies.push({
        id: point.id,
        timestamp: new Date(point.timestamp).toISOString(),
        type: 'iqr_outlier',
        severity,
        value: point.rating,
        expectedRange: {
          lower: Number(lowerBound.toFixed(2)),
          upper: Number(upperBound.toFixed(2)),
        },
        deviation: Number(distance.toFixed(2)),
        description: `Rating ${point.rating} is outside IQR bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
        contributingFactors: identifyContributingFactors(point),
        recommendedAction: generateRecommendation('iqr_outlier', severity, point),
      });
    }
  });

  return anomalies;
}

/**
 * Detect temporal anomalies (sudden drops/spikes)
 */
function detectTemporalAnomalies(dataPoints: DataPoint[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (let i = 1; i < dataPoints.length; i++) {
    const prev = dataPoints[i - 1];
    const curr = dataPoints[i];
    const timeDiff = (curr.timestamp - prev.timestamp) / (1000 * 60 * 60); // hours
    const ratingChange = curr.rating - prev.rating;

    // Sudden drop: >2 star drop in <1 hour
    if (ratingChange <= -2 && timeDiff < 1) {
      anomalies.push({
        id: curr.id,
        timestamp: new Date(curr.timestamp).toISOString(),
        type: 'sudden_drop',
        severity: 'critical',
        value: curr.rating,
        expectedRange: {
          lower: prev.rating - 1,
          upper: prev.rating + 1,
        },
        deviation: Math.abs(ratingChange),
        description: `Sudden drop of ${Math.abs(ratingChange)} stars in ${timeDiff.toFixed(1)} hours`,
        contributingFactors: identifyContributingFactors(curr),
        recommendedAction: 'URGENT: Investigate immediate cause of quality drop',
      });
    }

    // Sudden spike: >2 star increase in <1 hour (unusual, may indicate data issue)
    if (ratingChange >= 2 && timeDiff < 1) {
      anomalies.push({
        id: curr.id,
        timestamp: new Date(curr.timestamp).toISOString(),
        type: 'sudden_spike',
        severity: 'medium',
        value: curr.rating,
        expectedRange: {
          lower: prev.rating - 1,
          upper: prev.rating + 1,
        },
        deviation: Math.abs(ratingChange),
        description: `Sudden spike of ${ratingChange} stars in ${timeDiff.toFixed(1)} hours`,
        contributingFactors: identifyContributingFactors(curr),
        recommendedAction: 'Verify data accuracy and check for environmental changes',
      });
    }
  }

  return anomalies;
}

/**
 * Detect pattern anomalies (sustained degradation)
 */
function detectPatternAnomalies(dataPoints: DataPoint[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const windowSize = 5;

  for (let i = windowSize; i < dataPoints.length; i++) {
    const window = dataPoints.slice(i - windowSize, i);
    const prevWindow = dataPoints.slice(
      Math.max(0, i - windowSize * 2),
      i - windowSize
    );

    if (prevWindow.length < windowSize) continue;

    const currentAvg = window.reduce((sum, p) => sum + p.rating, 0) / window.length;
    const prevAvg = prevWindow.reduce((sum, p) => sum + p.rating, 0) / prevWindow.length;
    const degradation = prevAvg - currentAvg;

    // Sustained degradation: avg drops >1 star over 5 points
    if (degradation > 1) {
      const lastPoint = window[window.length - 1];
      const severity = determineSeverity(degradation, 1, 1.5, 2);

      anomalies.push({
        id: lastPoint.id,
        timestamp: new Date(lastPoint.timestamp).toISOString(),
        type: 'sustained_degradation',
        severity,
        value: currentAvg,
        expectedRange: {
          lower: prevAvg - 0.5,
          upper: prevAvg + 0.5,
        },
        deviation: Number(degradation.toFixed(2)),
        description: `Quality degraded by ${degradation.toFixed(2)} stars over last ${windowSize} evaluations`,
        contributingFactors: aggregateFactors(window),
        recommendedAction: generateRecommendation('sustained_degradation', severity, lastPoint),
      });
    }
  }

  return anomalies;
}

/**
 * Determine severity level based on deviation thresholds
 */
function determineSeverity(
  value: number,
  mediumThreshold: number,
  highThreshold: number,
  criticalThreshold: number
): AnomalySeverity {
  if (value >= criticalThreshold) return 'critical';
  if (value >= highThreshold) return 'high';
  if (value >= mediumThreshold) return 'medium';
  return 'low';
}

/**
 * Identify contributing factors for an anomaly
 */
function identifyContributingFactors(point: DataPoint): string[] {
  const factors: string[] = [];

  if (point.hasError) factors.push('Error occurred');
  if (point.fallbackUsed) factors.push('Fallback mechanism used');
  if (point.toolCount === 0) factors.push('No tools used');
  if (point.toolCount > 5) factors.push('Many tools used');
  if (!point.success) factors.push('Marked as unsuccessful');

  return factors.length > 0 ? factors : ['None identified'];
}

/**
 * Aggregate contributing factors across multiple points
 */
function aggregateFactors(points: DataPoint[]): string[] {
  const errorCount = points.filter((p) => p.hasError).length;
  const fallbackCount = points.filter((p) => p.fallbackUsed).length;
  const failureCount = points.filter((p) => !p.success).length;

  const factors: string[] = [];
  const total = points.length;

  if (errorCount > total * 0.5) {
    factors.push(`High error rate (${((errorCount / total) * 100).toFixed(0)}%)`);
  }
  if (fallbackCount > total * 0.5) {
    factors.push(`Frequent fallback usage (${((fallbackCount / total) * 100).toFixed(0)}%)`);
  }
  if (failureCount > total * 0.5) {
    factors.push(`High failure rate (${((failureCount / total) * 100).toFixed(0)}%)`);
  }

  return factors.length > 0 ? factors : ['No clear pattern'];
}

/**
 * Generate recommended action based on anomaly type and severity
 */
function generateRecommendation(
  type: string,
  severity: AnomalySeverity,
  point: DataPoint
): string {
  const urgency = severity === 'critical' ? 'URGENT: ' : severity === 'high' ? 'HIGH PRIORITY: ' : '';

  switch (type) {
    case 'statistical_outlier':
      return `${urgency}Review evaluation ${point.id} - rating significantly differs from baseline`;
    case 'iqr_outlier':
      return `${urgency}Investigate evaluation ${point.id} - outside normal variation range`;
    case 'sustained_degradation':
      return `${urgency}Quality trending downward - review recent system changes`;
    default:
      return 'Monitor for recurrence';
  }
}

/**
 * Merge anomalies from different detection methods and deduplicate
 */
function mergeAnomalies(anomalyLists: Anomaly[][]): Anomaly[] {
  const anomalyMap = new Map<string, Anomaly>();

  anomalyLists.forEach((list) => {
    list.forEach((anomaly) => {
      const existing = anomalyMap.get(anomaly.id);
      if (!existing || getSeverityRank(anomaly.severity) > getSeverityRank(existing.severity)) {
        anomalyMap.set(anomaly.id, anomaly);
      }
    });
  });

  return Array.from(anomalyMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Get numeric rank for severity (higher = more severe)
 */
function getSeverityRank(severity: AnomalySeverity): number {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

/**
 * Calculate statistical summary
 */
function calculateStatistics(dataPoints: DataPoint[]): {
  mean: number;
  median: number;
  stdDev: number;
  q1: number;
  q3: number;
  iqr: number;
} {
  const ratings = dataPoints.map((p) => p.rating);
  const sorted = [...ratings].sort((a, b) => a - b);
  const n = sorted.length;

  const mean = ratings.reduce((sum, r) => sum + r, 0) / n;
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const variance = ratings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  return {
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    q1: Number(q1.toFixed(2)),
    q3: Number(q3.toFixed(2)),
    iqr: Number(iqr.toFixed(2)),
  };
}

/**
 * Generate insights about detected anomalies
 */
function generateAnomalyInsights(
  anomalies: Anomaly[],
  dataPoints: DataPoint[],
  statistics: { mean: number; median: number; stdDev: number }
): string[] {
  const insights: string[] = [];

  if (anomalies.length === 0) {
    insights.push('No anomalies detected - quality metrics are stable and consistent');
    return insights;
  }

  // Severity breakdown
  const critical = anomalies.filter((a) => a.severity === 'critical').length;
  const high = anomalies.filter((a) => a.severity === 'high').length;

  if (critical > 0) {
    insights.push(
      `CRITICAL: ${critical} critical anomal${critical === 1 ? 'y' : 'ies'} detected - immediate attention required`
    );
  }

  if (high > 0) {
    insights.push(
      `${high} high-severity anomal${high === 1 ? 'y' : 'ies'} detected - investigation recommended`
    );
  }

  // Anomaly rate
  const anomalyRate = (anomalies.length / dataPoints.length) * 100;
  if (anomalyRate > 10) {
    insights.push(
      `High anomaly rate (${anomalyRate.toFixed(1)}%) - quality may be unstable`
    );
  }

  // Type distribution
  const typeGroups = anomalies.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dominantType = Object.entries(typeGroups)
    .sort((a, b) => b[1] - a[1])[0];

  if (dominantType) {
    insights.push(
      `Most common anomaly type: ${dominantType[0].replace(/_/g, ' ')} (${dominantType[1]} occurrence${dominantType[1] === 1 ? '' : 's'})`
    );
  }

  // Data quality
  if (statistics.stdDev > 1.5) {
    insights.push(
      `High variability detected (std dev: ${statistics.stdDev}) - quality is inconsistent`
    );
  }

  return insights;
}

/**
 * Create response for insufficient data
 */
function createInsufficientDataResponse(
  startDate: Date,
  endDate: Date,
  dataPoints: number
): AnomalyDetection {
  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalEvaluations: dataPoints,
    anomaliesDetected: 0,
    anomalies: [],
    statistics: {
      mean: 0,
      median: 0,
      stdDev: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
    },
    insights: [
      `Insufficient data for anomaly detection (need ≥5 evaluations, found ${dataPoints})`,
      'Collect more evaluation data to enable anomaly detection',
    ],
  };
}
