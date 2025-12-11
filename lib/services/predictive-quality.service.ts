// Predictive Quality Service
// Purpose: Forecast quality trends using time-series analysis
// Date: 2025-10-25
// Phase: 2.4 - Predictive Intelligence

export interface DataPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface ForecastPoint {
  timestamp: string;
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

export interface ForecastResult {
  historical: DataPoint[];
  forecast: ForecastPoint[];
  model: string;
  accuracy: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  metadata: {
    historicalMean: number;
    forecastMean: number;
    trendSlope: number;
  };
}

/**
 * Calculate linear regression slope for trend analysis
 */
function calculateTrendSlope(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

/**
 * Calculate moving average for smoothing
 */
function calculateMovingAverage(values: number[], window: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const windowValues = values.slice(start, i + 1);
    const avg = windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length;
    result.push(avg);
  }

  return result;
}

/**
 * Calculate standard deviation for confidence intervals
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Build final forecast result with metadata
 */
function buildForecastResult(
  dataPoints: DataPoint[],
  forecast: ForecastPoint[],
  slope: number,
  historicalMean: number
): ForecastResult {
  const forecastMean = forecast.reduce((sum, fp) => sum + fp.predictedValue, 0) / forecast.length;

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (Math.abs(slope) > 0.01) {
    trend = slope > 0 ? 'increasing' : 'decreasing';
  }

  const accuracy = calculateForecastAccuracy(dataPoints.map(dp => dp.value), slope);

  return {
    historical: dataPoints,
    forecast,
    model: 'linear_regression',
    accuracy,
    trend,
    metadata: {
      historicalMean,
      forecastMean,
      trendSlope: slope
    }
  };
}

/**
 * Calculate forecast accuracy using historical data
 */
function calculateForecastAccuracy(values: number[], slope: number): number {
  if (values.length < 10) {
    return 0.7;
  }

  const predictions: number[] = [];
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const intercept = mean - slope * ((values.length - 1) / 2);

  for (let i = 0; i < values.length; i++) {
    predictions.push(intercept + slope * i);
  }

  const errors = values.map((val, i) => Math.abs(val - predictions[i]));
  const mae = errors.reduce((sum, err) => sum + err, 0) / errors.length;
  const range = Math.max(...values) - Math.min(...values);

  const accuracy = Math.max(0, 1 - (mae / (range || 1)));
  return Math.min(1, accuracy);
}

/**
 * Generate linear regression forecast
 */
async function generateLinearForecast(
  dataPoints: DataPoint[],
  smoothedValues: number[],
  forecastDays: number,
  confidenceLevel: number
): Promise<ForecastResult> {
  const n = smoothedValues.length;
  const slope = calculateTrendSlope(smoothedValues);
  const mean = smoothedValues.reduce((sum, val) => sum + val, 0) / n;
  const stdDev = calculateStdDev(smoothedValues);

  console.log('[PredictiveQuality] Trend slope:', slope.toFixed(4), 'stdDev:', stdDev.toFixed(4));

  const intercept = mean - slope * ((n - 1) / 2);
  const forecast: ForecastPoint[] = [];
  const lastTimestamp = new Date(dataPoints[dataPoints.length - 1].timestamp);
  const zScore = confidenceLevel === 0.95 ? 1.96 : 2.58;

  for (let i = 1; i <= forecastDays; i++) {
    const forecastValue = intercept + slope * (n - 1 + i);
    const confidenceInterval = zScore * stdDev * Math.sqrt(1 + 1 / n);
    const forecastDate = new Date(lastTimestamp);
    forecastDate.setDate(forecastDate.getDate() + i);

    forecast.push({
      timestamp: forecastDate.toISOString(),
      predictedValue: forecastValue,
      lowerBound: forecastValue - confidenceInterval,
      upperBound: forecastValue + confidenceInterval,
      confidence: confidenceLevel
    });
  }

  console.log('[PredictiveQuality] Generated', forecast.length, 'forecast points');
  return buildForecastResult(dataPoints, forecast, slope, mean);
}

/**
 * Main export: Generate forecast using linear regression
 */
export async function generateForecast(
  dataPoints: DataPoint[],
  forecastDays: number,
  options: {
    confidenceLevel?: number;
    smoothingWindow?: number;
  } = {}
): Promise<ForecastResult> {
  console.log('[PredictiveQuality] Generating forecast for', dataPoints.length, 'points');

  if (dataPoints.length < 7) {
    throw new Error('Insufficient data: need at least 7 data points for forecasting');
  }

  const confidenceLevel = options.confidenceLevel || 0.95;
  const smoothingWindow = options.smoothingWindow || 3;
  const rawValues = dataPoints.map(dp => dp.value);
  const smoothedValues = calculateMovingAverage(rawValues, smoothingWindow);

  console.log('[PredictiveQuality] Smoothed values, window:', smoothingWindow);
  return await generateLinearForecast(dataPoints, smoothedValues, forecastDays, confidenceLevel);
}
