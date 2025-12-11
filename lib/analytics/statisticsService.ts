/**
 * Statistical Analysis Service
 * Provides statistical analysis of analytics metrics
 * Phase 1: Enhanced Data Collection Services
 * Date: October 25, 2025
 */

interface Distribution {
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  range: number;
}

interface Percentiles {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

interface Anomaly {
  value: number;
  timestamp: Date;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  type: 'spike' | 'drop' | 'outlier';
}

interface Correlation {
  metric1: string;
  metric2: string;
  coefficient: number;
  strength: 'weak' | 'moderate' | 'strong';
  direction: 'positive' | 'negative';
}

/**
 * Calculate statistical distribution
 */
export function calculateDistribution(
  values: number[]
): Distribution {
  console.log('[StatisticsService] Calculating distribution', {
    values: values.length,
  });

  if (values.length === 0) {
    return {
      mean: 0, median: 0, mode: 0, stdDev: 0,
      variance: 0, min: 0, max: 0, range: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const mode = calculateMode(values);
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const result = {
    mean,
    median,
    mode,
    stdDev,
    variance,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    range: sorted[sorted.length - 1] - sorted[0],
  };

  console.log('[StatisticsService] Distribution calculated', {
    mean: result.mean.toFixed(2),
    stdDev: result.stdDev.toFixed(2),
  });

  return result;
}

/**
 * Calculate mode (most frequent value)
 */
function calculateMode(values: number[]): number {
  const frequency = new Map<number, number>();
  values.forEach((val) => {
    frequency.set(val, (frequency.get(val) || 0) + 1);
  });

  let maxFreq = 0;
  let mode = values[0];

  frequency.forEach((freq, val) => {
    if (freq > maxFreq) {
      maxFreq = freq;
      mode = val;
    }
  });

  return mode;
}

/**
 * Calculate percentiles
 */
export function calculatePercentiles(
  values: number[]
): Percentiles {
  console.log('[StatisticsService] Calculating percentiles', {
    values: values.length,
  });

  if (values.length === 0) {
    return { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const getPercentile = (p: number) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  const result = {
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
  };

  console.log('[StatisticsService] Percentiles calculated');

  return result;
}

/**
 * Detect anomalies using statistical methods
 */
export function detectAnomalies(
  dataPoints: Array<{ timestamp: Date; value: number }>,
  sensitivity: number = 2.5
): Anomaly[] {
  console.log('[StatisticsService] Detecting anomalies', {
    dataPoints: dataPoints.length,
    sensitivity,
  });

  if (dataPoints.length < 3) {
    return [];
  }

  const values = dataPoints.map((p) => p.value);
  const distribution = calculateDistribution(values);
  const threshold = distribution.stdDev * sensitivity;

  const anomalies: Anomaly[] = dataPoints
    .map((point, index) => {
      const deviation = Math.abs(point.value - distribution.mean);
      
      if (deviation > threshold) {
        const prevValue = index > 0 ? dataPoints[index - 1].value : distribution.mean;
        const changeRate = Math.abs((point.value - prevValue) / prevValue);
        
        return {
          value: point.value,
          timestamp: point.timestamp,
          deviation,
          severity: deviation > threshold * 2 ? 'high' : deviation > threshold * 1.5 ? 'medium' : 'low',
          type: changeRate > 0.5 
            ? (point.value > prevValue ? 'spike' : 'drop')
            : 'outlier',
        };
      }
      return null;
    })
    .filter((a): a is Anomaly => a !== null);

  console.log('[StatisticsService] Anomalies detected', {
    count: anomalies.length,
  });

  return anomalies;
}

/**
 * Calculate correlation between two metrics
 */
export function correlationAnalysis(
  metric1: { name: string; values: number[] },
  metric2: { name: string; values: number[] }
): Correlation {
  console.log('[StatisticsService] Calculating correlation', {
    metric1: metric1.name,
    metric2: metric2.name,
  });

  const minLength = Math.min(metric1.values.length, metric2.values.length);
  const values1 = metric1.values.slice(0, minLength);
  const values2 = metric2.values.slice(0, minLength);

  if (minLength === 0) {
    return {
      metric1: metric1.name,
      metric2: metric2.name,
      coefficient: 0,
      strength: 'weak',
      direction: 'positive',
    };
  }

  const mean1 = values1.reduce((a, b) => a + b, 0) / minLength;
  const mean2 = values2.reduce((a, b) => a + b, 0) / minLength;

  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;

  for (let i = 0; i < minLength; i++) {
    const diff1 = values1[i] - mean1;
    const diff2 = values2[i] - mean2;
    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }

  const coefficient = numerator / Math.sqrt(sumSq1 * sumSq2);
  const absCoeff = Math.abs(coefficient);
  const strength = absCoeff > 0.7 ? 'strong' : absCoeff > 0.4 ? 'moderate' : 'weak';
  const direction = coefficient >= 0 ? 'positive' : 'negative';

  console.log('[StatisticsService] Correlation calculated', {
    coefficient: coefficient.toFixed(3),
    strength,
  });

  return {
    metric1: metric1.name,
    metric2: metric2.name,
    coefficient,
    strength,
    direction,
  };
}
