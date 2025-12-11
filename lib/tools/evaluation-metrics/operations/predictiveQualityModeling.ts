// Predictive Quality Modeling Operation
// Uses linear regression to predict future quality scores and identify risks
// Date: October 20, 2025

import { supabase } from '@/lib/supabaseClient';
import type { PredictiveQualityModel, QualityPrediction, RiskScore } from '../types';

interface EvaluationRecord {
  id: string;
  rating: number;
  success: boolean;
  created_at: string;
  error_type: string | null;
  fallback_used: boolean;
  tools_used: string[] | null;
}

interface TimeSeriesPoint {
  timestamp: number;
  rating: number;
  success: boolean;
  errorCount: number;
  fallbackUsed: boolean;
  toolCount: number;
}

/**
 * Predictive quality modeling using linear regression
 * Forecasts future quality trends and identifies risks
 */
export async function getPredictiveQualityModeling(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<PredictiveQualityModel> {
  console.log('[PredictiveModel] Starting analysis', {
    userId,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
  });

  // Query historical evaluation data
  const { data: evaluations, error: queryError } = await supabase
    .from('message_evaluations')
    .select('id, rating, success, created_at, error_type, fallback_used, tools_used')
    .eq('evaluator_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });

  if (queryError) {
    console.error('[PredictiveModel] Query failed:', queryError);
    throw new Error(`Failed to fetch evaluation data: ${queryError.message}`);
  }

  if (!evaluations || evaluations.length < 10) {
    console.log('[PredictiveModel] Insufficient data (need ≥10 points)');
    return createInsufficientDataModel(startDate, endDate, evaluations?.length || 0);
  }

  const typedEvaluations = evaluations as EvaluationRecord[];

  // Convert to time series
  const timeSeries = createTimeSeries(typedEvaluations);

  console.log('[PredictiveModel] Time series created:', {
    dataPoints: timeSeries.length,
    dateRange: {
      first: new Date(timeSeries[0].timestamp).toISOString(),
      last: new Date(timeSeries[timeSeries.length - 1].timestamp).toISOString(),
    },
  });

  // Extract features and train model
  const model = trainLinearModel(timeSeries);

  // Generate predictions
  const sevenDayPrediction = predictFutureQuality(model, timeSeries, 7);
  const thirtyDayPrediction = predictFutureQuality(model, timeSeries, 30);

  // Calculate risk scores
  const riskScore = calculateRiskScore(timeSeries, sevenDayPrediction);

  // Generate insights
  const insights = generatePredictiveInsights(
    timeSeries,
    sevenDayPrediction,
    thirtyDayPrediction,
    riskScore
  );

  const result: PredictiveQualityModel = {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    dataPointsAnalyzed: timeSeries.length,
    currentQuality: calculateCurrentQuality(timeSeries),
    predictions: {
      sevenDay: sevenDayPrediction,
      thirtyDay: thirtyDayPrediction,
    },
    riskScore,
    modelAccuracy: model.accuracy,
    insights,
  };

  console.log('[PredictiveModel] Analysis complete:', {
    dataPoints: result.dataPointsAnalyzed,
    currentQuality: result.currentQuality,
    sevenDayPrediction: result.predictions.sevenDay.predictedRating,
    riskLevel: result.riskScore.level,
  });

  return result;
}

/**
 * Create time series from evaluations
 */
function createTimeSeries(evaluations: EvaluationRecord[]): TimeSeriesPoint[] {
  return evaluations.map((evaluation) => ({
    timestamp: new Date(evaluation.created_at).getTime(),
    rating: evaluation.rating,
    success: evaluation.success,
    errorCount: evaluation.error_type ? 1 : 0,
    fallbackUsed: evaluation.fallback_used,
    toolCount: evaluation.tools_used?.length || 0,
  }));
}

/**
 * Train simple linear regression model
 * Features: time, historical average, error rate, fallback rate, tool usage
 */
function trainLinearModel(timeSeries: TimeSeriesPoint[]): {
  coefficients: number[];
  intercept: number;
  accuracy: number;
} {
  const n = timeSeries.length;
  const features: number[][] = [];
  const targets: number[] = [];

  // Normalize timestamps to 0-1 range
  const minTime = timeSeries[0].timestamp;
  const maxTime = timeSeries[n - 1].timestamp;
  const timeRange = maxTime - minTime || 1;

  // Extract features for each point
  for (let i = 5; i < n; i++) {
    // Need history
    const recentHistory = timeSeries.slice(i - 5, i);
    const historicalAvg = recentHistory.reduce((sum, p) => sum + p.rating, 0) / 5;
    const errorRate = recentHistory.filter((p) => p.errorCount > 0).length / 5;
    const fallbackRate = recentHistory.filter((p) => p.fallbackUsed).length / 5;
    const avgToolCount = recentHistory.reduce((sum, p) => sum + p.toolCount, 0) / 5;
    const normalizedTime = (timeSeries[i].timestamp - minTime) / timeRange;

    features.push([
      normalizedTime,
      historicalAvg,
      errorRate,
      fallbackRate,
      avgToolCount,
    ]);
    targets.push(timeSeries[i].rating);
  }

  // Simple linear regression using normal equation
  const coefficients = calculateCoefficients(features, targets);
  const intercept = calculateIntercept(features, targets, coefficients);

  // Calculate R-squared for accuracy
  const predictions = features.map((f) => predict(f, coefficients, intercept));
  const accuracy = calculateRSquared(targets, predictions);

  return { coefficients, intercept, accuracy };
}

/**
 * Calculate regression coefficients using gradient descent approximation
 */
function calculateCoefficients(features: number[][], targets: number[]): number[] {
  const numFeatures = features[0].length;
  const coefficients = new Array(numFeatures).fill(0);
  const learningRate = 0.01;
  const iterations = 1000;

  for (let iter = 0; iter < iterations; iter++) {
    const gradients = new Array(numFeatures).fill(0);

    features.forEach((featureRow, i) => {
      const predicted = featureRow.reduce((sum, val, j) => sum + val * coefficients[j], 0);
      const error = predicted - targets[i];

      featureRow.forEach((val, j) => {
        gradients[j] += error * val;
      });
    });

    // Update coefficients
    coefficients.forEach((_, j) => {
      coefficients[j] -= (learningRate * gradients[j]) / features.length;
    });
  }

  return coefficients;
}

/**
 * Calculate intercept
 */
function calculateIntercept(
  features: number[][],
  targets: number[],
  coefficients: number[]
): number {
  const predictions = features.map((f) =>
    f.reduce((sum, val, j) => sum + val * coefficients[j], 0)
  );
  const avgTarget = targets.reduce((sum, val) => sum + val, 0) / targets.length;
  const avgPrediction = predictions.reduce((sum, val) => sum + val, 0) / predictions.length;

  return avgTarget - avgPrediction;
}

/**
 * Make prediction with trained model
 */
function predict(features: number[], coefficients: number[], intercept: number): number {
  const sum = features.reduce((acc, val, i) => acc + val * coefficients[i], 0);
  return sum + intercept;
}

/**
 * Calculate R-squared accuracy metric
 */
function calculateRSquared(actual: number[], predicted: number[]): number {
  const mean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
  const ssTotal = actual.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  const ssResidual = actual.reduce(
    (sum, val, i) => sum + Math.pow(val - predicted[i], 2),
    0
  );

  return Math.max(0, 1 - ssResidual / ssTotal);
}

/**
 * Predict future quality for specified days ahead
 */
function predictFutureQuality(
  model: { coefficients: number[]; intercept: number; accuracy: number },
  timeSeries: TimeSeriesPoint[],
  daysAhead: number
): QualityPrediction {
  const lastPoints = timeSeries.slice(-5);
  const historicalAvg = lastPoints.reduce((sum, p) => sum + p.rating, 0) / 5;
  const errorRate = lastPoints.filter((p) => p.errorCount > 0).length / 5;
  const fallbackRate = lastPoints.filter((p) => p.fallbackUsed).length / 5;
  const avgToolCount = lastPoints.reduce((sum, p) => sum + p.toolCount, 0) / 5;

  // Project time forward
  const lastTime = timeSeries[timeSeries.length - 1].timestamp;
  const firstTime = timeSeries[0].timestamp;
  const timeRange = lastTime - firstTime || 1;
  const futureTime = lastTime + daysAhead * 24 * 60 * 60 * 1000;
  const normalizedTime = (futureTime - firstTime) / timeRange;

  // Create feature vector
  const features = [normalizedTime, historicalAvg, errorRate, fallbackRate, avgToolCount];

  // Predict
  const predictedRating = Math.max(1, Math.min(5, predict(features, model.coefficients, model.intercept)));

  // Calculate confidence based on model accuracy and prediction horizon
  const horizonFactor = Math.max(0, 1 - daysAhead / 60); // Decrease confidence over time
  const confidence = model.accuracy * horizonFactor;

  // Calculate confidence interval (± 1 std dev)
  const stdDev = Math.sqrt((1 - model.accuracy) * 2); // Estimate from residuals
  const lowerBound = Math.max(1, predictedRating - stdDev);
  const upperBound = Math.min(5, predictedRating + stdDev);

  return {
    predictedRating: Number(predictedRating.toFixed(2)),
    confidence: Number(confidence.toFixed(2)),
    confidenceInterval: {
      lower: Number(lowerBound.toFixed(2)),
      upper: Number(upperBound.toFixed(2)),
    },
    daysAhead,
  };
}

/**
 * Calculate risk score for quality decline
 */
function calculateRiskScore(
  timeSeries: TimeSeriesPoint[],
  prediction: QualityPrediction
): RiskScore {
  const recentPoints = timeSeries.slice(-14); // Last 2 weeks

  // Calculate trend
  const trendSlope = calculateTrend(recentPoints);

  // Risk factors
  const decliningTrend = trendSlope < -0.05;
  const lowPrediction = prediction.predictedRating < 3.5;
  const highErrorRate = recentPoints.filter((p) => p.errorCount > 0).length / recentPoints.length > 0.2;
  const lowConfidence = prediction.confidence < 0.6;

  // Calculate risk score (0-100)
  let score = 0;
  if (decliningTrend) score += 30;
  if (lowPrediction) score += 25;
  if (highErrorRate) score += 25;
  if (lowConfidence) score += 20;

  // Determine level
  let level: 'low' | 'medium' | 'high' | 'critical';
  if (score >= 75) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 25) level = 'medium';
  else level = 'low';

  // Generate recommendations
  const recommendations: string[] = [];
  if (decliningTrend) {
    recommendations.push('Quality is declining - investigate recent changes');
  }
  if (lowPrediction) {
    recommendations.push('Predicted quality below threshold - improve response quality');
  }
  if (highErrorRate) {
    recommendations.push('High error rate detected - review error handling');
  }
  if (lowConfidence) {
    recommendations.push('Low prediction confidence - collect more evaluation data');
  }

  return {
    score,
    level,
    probability: Number((score / 100).toFixed(2)),
    recommendations,
  };
}

/**
 * Calculate trend slope
 */
function calculateTrend(points: TimeSeriesPoint[]): number {
  const n = points.length;
  if (n < 2) return 0;

  const xValues = points.map((_, i) => i);
  const yValues = points.map((p) => p.rating);

  const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
  const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;

  const numerator = xValues.reduce((sum, x, i) => sum + (x - xMean) * (yValues[i] - yMean), 0);
  const denominator = xValues.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0);

  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Calculate current quality metrics
 */
function calculateCurrentQuality(timeSeries: TimeSeriesPoint[]): number {
  const recent = timeSeries.slice(-7);
  return Number(
    (recent.reduce((sum, p) => sum + p.rating, 0) / recent.length).toFixed(2)
  );
}

/**
 * Generate predictive insights
 */
function generatePredictiveInsights(
  timeSeries: TimeSeriesPoint[],
  sevenDay: QualityPrediction,
  thirtyDay: QualityPrediction,
  risk: RiskScore
): string[] {
  const insights: string[] = [];
  const currentQuality = calculateCurrentQuality(timeSeries);

  // Trend insights
  const sevenDayChange = sevenDay.predictedRating - currentQuality;
  const thirtyDayChange = thirtyDay.predictedRating - currentQuality;

  if (sevenDayChange > 0.3) {
    insights.push(
      `Quality expected to improve by ${(sevenDayChange * 100 / currentQuality).toFixed(1)}% over next 7 days`
    );
  } else if (sevenDayChange < -0.3) {
    insights.push(
      `Quality expected to decline by ${Math.abs(sevenDayChange * 100 / currentQuality).toFixed(1)}% over next 7 days`
    );
  } else {
    insights.push('Quality expected to remain stable over next 7 days');
  }

  // Long-term trend
  if (Math.abs(thirtyDayChange) > 0.5) {
    const direction = thirtyDayChange > 0 ? 'improve' : 'decline';
    insights.push(
      `30-day forecast shows ${direction} to ${thirtyDay.predictedRating.toFixed(1)} stars (${thirtyDay.confidence > 0.7 ? 'high' : 'moderate'} confidence)`
    );
  }

  // Risk insights
  if (risk.level === 'critical' || risk.level === 'high') {
    insights.push(
      `${risk.level.toUpperCase()} risk of quality decline (${(risk.probability * 100).toFixed(0)}% probability)`
    );
  }

  // Confidence insights
  if (sevenDay.confidence < 0.5) {
    insights.push(
      'Low prediction confidence - more evaluation data needed for accurate forecasting'
    );
  }

  return insights;
}

/**
 * Create model for insufficient data scenarios
 */
function createInsufficientDataModel(
  startDate: Date,
  endDate: Date,
  dataPoints: number
): PredictiveQualityModel {
  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    dataPointsAnalyzed: dataPoints,
    currentQuality: 0,
    predictions: {
      sevenDay: {
        predictedRating: 0,
        confidence: 0,
        confidenceInterval: { lower: 0, upper: 0 },
        daysAhead: 7,
      },
      thirtyDay: {
        predictedRating: 0,
        confidence: 0,
        confidenceInterval: { lower: 0, upper: 0 },
        daysAhead: 30,
      },
    },
    riskScore: {
      score: 0,
      level: 'low',
      probability: 0,
      recommendations: [],
    },
    modelAccuracy: 0,
    insights: [
      `Insufficient data for prediction (need ≥10 evaluations, found ${dataPoints})`,
      'Collect more evaluation data to enable quality forecasting',
    ],
  };
}
