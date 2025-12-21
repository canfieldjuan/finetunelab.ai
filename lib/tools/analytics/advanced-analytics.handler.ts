/**
 * Advanced Analytics Tool Handler
 *
 * Provides access to pre-computed analytics data.
 * Operations:
 * - model_comparison: Compare model performance
 * - benchmark_analysis: Benchmark results and accuracy
 * - cohort_analysis: Cohort performance metrics
 * - anomaly_detection: Detected anomalies and outliers
 * - sentiment_trends: Sentiment analysis trends
 * - quality_forecast: Predictive quality modeling
 */

interface AdvancedAnalyticsArgs {
  operation: 'model_comparison' | 'benchmark_analysis' | 'cohort_analysis' | 'anomaly_detection' | 'sentiment_trends' | 'quality_forecast';
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
  startDate?: string;
  endDate?: string;
  cohortId?: string;
  modelIds?: string[];
  threshold?: number;
}

export async function executeAdvancedAnalytics(
  args: Record<string, unknown>,
  userId: string,
  authHeader?: string,
  _authClient?: unknown
): Promise<unknown> {
  console.log('[AdvancedAnalytics] Executing:', args.operation);

  const { operation, period, startDate, endDate, cohortId, modelIds, threshold } = args as unknown as AdvancedAnalyticsArgs;

  try {
    switch (operation) {
      case 'model_comparison':
        return await modelComparison(period, startDate, endDate, modelIds, authHeader!);

      case 'benchmark_analysis':
        return await benchmarkAnalysis(period, startDate, endDate, authHeader!);

      case 'cohort_analysis':
        if (!cohortId) {
          return { error: 'cohortId is required for cohort_analysis' };
        }
        return await cohortAnalysis(cohortId, period, startDate, endDate, authHeader!);

      case 'anomaly_detection':
        return await anomalyDetection(period, startDate, endDate, threshold, authHeader!);

      case 'sentiment_trends':
        return await sentimentTrends(period, startDate, endDate, authHeader!);

      case 'quality_forecast':
        return await qualityForecast(period, startDate, endDate, authHeader!);

      default:
        return { error: `Unknown operation: ${operation}` };
    }
  } catch (error) {
    console.error('[AdvancedAnalytics] Error:', error);
    return {
      error: error instanceof Error ? error.message : 'Advanced analytics operation failed'
    };
  }
}

/**
 * Compare model performance
 */
async function modelComparison(
  period: string = 'month',
  startDate?: string,
  endDate?: string,
  modelIds?: string[],
  authHeader?: string
): Promise<unknown> {
  console.log('[AdvancedAnalytics] Model comparison:', { period, startDate, endDate });

  try {
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analytics/model-comparison?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader!,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AdvancedAnalytics] Model comparison error:', response.status, errorText);
      return {
        error: `Failed to get model comparison: ${response.status}`,
        details: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    console.log('[AdvancedAnalytics] Model comparison retrieved:', data.data?.models?.length || 0, 'models');

    return {
      success: true,
      ...data.data,
    };
  } catch (error) {
    console.error('[AdvancedAnalytics] modelComparison error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get model comparison'
    };
  }
}

/**
 * Get benchmark analysis results
 */
async function benchmarkAnalysis(
  period: string = 'month',
  startDate?: string,
  endDate?: string,
  authHeader?: string
): Promise<unknown> {
  console.log('[AdvancedAnalytics] Benchmark analysis:', { period, startDate, endDate });

  try {
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analytics/benchmark-analysis?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader!,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AdvancedAnalytics] Benchmark analysis error:', response.status, errorText);
      return {
        error: `Failed to get benchmark analysis: ${response.status}`,
        details: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    console.log('[AdvancedAnalytics] Benchmark analysis retrieved');

    return {
      success: true,
      ...(data.data || data),
    };
  } catch (error) {
    console.error('[AdvancedAnalytics] benchmarkAnalysis error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get benchmark analysis'
    };
  }
}

/**
 * Get cohort analysis
 */
async function cohortAnalysis(
  cohortId: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string,
  authHeader?: string
): Promise<unknown> {
  console.log('[AdvancedAnalytics] Cohort analysis:', cohortId);

  try {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analytics/cohorts/${cohortId}/metrics?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader!,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AdvancedAnalytics] Cohort analysis error:', response.status, errorText);
      return {
        error: `Failed to get cohort analysis: ${response.status}`,
        details: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    console.log('[AdvancedAnalytics] Cohort analysis retrieved');

    return {
      success: true,
      cohort_id: cohortId,
      ...(data.data || data),
    };
  } catch (error) {
    console.error('[AdvancedAnalytics] cohortAnalysis error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get cohort analysis'
    };
  }
}

/**
 * Detect anomalies
 */
async function anomalyDetection(
  period: string = 'week',
  startDate?: string,
  endDate?: string,
  threshold?: number,
  authHeader?: string
): Promise<unknown> {
  console.log('[AdvancedAnalytics] Anomaly detection:', { period, threshold });

  try {
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (threshold) params.append('threshold', threshold.toString());

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analytics/anomalies?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader!,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AdvancedAnalytics] Anomaly detection error:', response.status, errorText);
      return {
        error: `Failed to detect anomalies: ${response.status}`,
        details: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    console.log('[AdvancedAnalytics] Anomaly detection retrieved:', data.anomalies?.length || 0, 'anomalies');

    return {
      success: true,
      ...(data.data || data),
    };
  } catch (error) {
    console.error('[AdvancedAnalytics] anomalyDetection error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to detect anomalies'
    };
  }
}

/**
 * Get sentiment trends
 */
async function sentimentTrends(
  period: string = 'month',
  startDate?: string,
  endDate?: string,
  authHeader?: string
): Promise<unknown> {
  console.log('[AdvancedAnalytics] Sentiment trends:', { period, startDate, endDate });

  try {
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analytics/sentiment/trends?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader!,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AdvancedAnalytics] Sentiment trends error:', response.status, errorText);
      return {
        error: `Failed to get sentiment trends: ${response.status}`,
        details: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    console.log('[AdvancedAnalytics] Sentiment trends retrieved');

    return {
      success: true,
      ...(data.data || data),
    };
  } catch (error) {
    console.error('[AdvancedAnalytics] sentimentTrends error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get sentiment trends'
    };
  }
}

/**
 * Get quality forecast
 */
async function qualityForecast(
  period: string = 'month',
  startDate?: string,
  endDate?: string,
  authHeader?: string
): Promise<unknown> {
  console.log('[AdvancedAnalytics] Quality forecast:', { period, startDate, endDate });

  try {
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analytics/forecast-data?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader!,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AdvancedAnalytics] Quality forecast error:', response.status, errorText);
      return {
        error: `Failed to get quality forecast: ${response.status}`,
        details: errorText.slice(0, 200),
      };
    }

    const data = await response.json();
    console.log('[AdvancedAnalytics] Quality forecast retrieved');

    return {
      success: true,
      ...(data.data || data),
    };
  } catch (error) {
    console.error('[AdvancedAnalytics] qualityForecast error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get quality forecast'
    };
  }
}
