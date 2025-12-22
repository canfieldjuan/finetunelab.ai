/**
 * QualityForecastChart Component
 *
 * Visualizes historical quality trends with forecasted predictions
 * Displays confidence intervals and trend indicators
 *
 * Phase 2.5: Quality Forecasting Chart
 * Date: 2025-10-25
 */

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { generateForecast, type ForecastResult } from '@/lib/services/predictive-quality.service';
import { supabase } from '@/lib/supabaseClient';

interface ChartDataPoint {
  date: string;
  actual?: number;
  predicted?: number;
  lowerBound?: number;
  upperBound?: number;
  isHistorical: boolean;
}

type MetricType = 'success_rate' | 'avg_rating' | 'response_time_p95' | 'sla_breach_rate';

interface QualityForecastChartProps {
  metricName: string;
  metricType?: MetricType;  // Which metric to fetch from API
  timeRange?: '7d' | '30d' | '90d';
  forecastDays?: number;
}

export default function QualityForecastChart({
  metricName,
  metricType = 'success_rate',
  timeRange = '30d',
  forecastDays = 7
}: QualityForecastChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);

  // Fetch real historical data from API
  const fetchHistoricalData = async (metric: MetricType, range: string) => {
    console.log('[QualityForecastChart] Fetching real historical data:', { metric, range });

    try {
      // Get auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('[QualityForecastChart] Auth error:', sessionError);
        throw new Error('Authentication required to fetch forecast data');
      }

      const params = new URLSearchParams({
        metric,
        timeRange: range
      });

      const url = `/api/analytics/forecast-data?${params.toString()}`;
      console.log('[QualityForecastChart] Fetching from:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('[QualityForecastChart] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[QualityForecastChart] Error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Unknown error' };
        }
        throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[QualityForecastChart] Real data fetched:', result.historical?.length || 0, 'points');

      return result.historical;
    } catch (err) {
      console.error('[QualityForecastChart] fetchHistoricalData error:', err);
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to fetch forecast data');
    }
  };

  // Build chart data from forecast result
  const buildChartData = (forecast: ForecastResult): ChartDataPoint[] => {
    const combined: ChartDataPoint[] = [];

    forecast.historical.forEach(point => {
      combined.push({
        date: new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        actual: point.value,
        isHistorical: true
      });
    });

    forecast.forecast.forEach(point => {
      combined.push({
        date: new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        predicted: point.predictedValue,
        lowerBound: point.lowerBound,
        upperBound: point.upperBound,
        isHistorical: false
      });
    });

    return combined;
  };

  // Fetch historical data and generate forecast
  const fetchAndForecast = useCallback(async () => {
    try {
      console.log('[QualityForecastChart] ========== FORECAST START ==========');
      console.log('[QualityForecastChart] Metric:', metricName, '| Type:', metricType, '| TimeRange:', timeRange);
      setLoading(true);
      setError(null);

      // Fetch real historical data from API
      const historicalData = await fetchHistoricalData(metricType, timeRange);
      console.log('[QualityForecastChart] ✓ API Response:', {
        dataPoints: historicalData.length,
        firstPoint: historicalData[0],
        lastPoint: historicalData[historicalData.length - 1]
      });

      // Handle empty data
      if (!historicalData || historicalData.length === 0) {
        console.warn('[QualityForecastChart] ⚠️ No data returned from API');
        setError('No historical data available for this metric. Start using the system to collect data!');
        setLoading(false);
        return;
      }

      // Check minimum data requirement
      if (historicalData.length < 7) {
        console.warn('[QualityForecastChart] ⚠️ Insufficient data:', historicalData.length, 'points (need 7+)');
        setError(`Insufficient data: need at least 7 data points for forecasting (currently have ${historicalData.length}). Continue using the system to collect more data!`);
        setLoading(false);
        return;
      }

      // Generate forecast from real data
      console.log('[QualityForecastChart] Generating forecast with', forecastDays, 'days ahead...');
      const forecast = await generateForecast(historicalData, forecastDays, {
        confidenceLevel: 0.95,
        smoothingWindow: 3
      });

      console.log('[QualityForecastChart] ✓ Forecast generated:', {
        trend: forecast.trend,
        accuracy: (forecast.accuracy * 100).toFixed(1) + '%',
        historicalMean: forecast.metadata.historicalMean.toFixed(2),
        forecastMean: forecast.metadata.forecastMean.toFixed(2),
        trendSlope: forecast.metadata.trendSlope.toFixed(4),
        forecastPoints: forecast.forecast.length
      });
      setForecastResult(forecast);

      const combined = buildChartData(forecast);
      console.log('[QualityForecastChart] ✓ Chart data built:', combined.length, 'total points');
      setChartData(combined);
      console.log('[QualityForecastChart] ========== FORECAST SUCCESS ==========');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate forecast';
      console.error('[QualityForecastChart] ❌ ERROR:', errorMsg);
      console.error('[QualityForecastChart] ========== FORECAST FAILED ==========');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [metricName, metricType, timeRange, forecastDays]);

  // Initial load
  useEffect(() => {
    console.log('[QualityForecastChart] Initial load, metric:', metricName);
    fetchAndForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- metricName is included in fetchAndForecast dependencies
  }, [fetchAndForecast]);

  // Get trend icon
  const getTrendIcon = () => {
    if (!forecastResult) return <Activity className="w-5 h-5 text-gray-500" />;

    switch (forecastResult.trend) {
      case 'increasing':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'decreasing':
        return <TrendingDown className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{metricName} - Quality Forecast</CardTitle>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            {forecastResult && (
              <div className="text-sm text-gray-600">
                {forecastResult.trend} ({(forecastResult.accuracy * 100).toFixed(0)}% accuracy)
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-sm text-gray-600">
            Generating forecast...
          </div>
        )}

        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              <Area
                type="monotone"
                dataKey="upperBound"
                stroke="none"
                fill="#93c5fd"
                fillOpacity={0.3}
                name="95% Confidence Interval"
              />
              <Area
                type="monotone"
                dataKey="lowerBound"
                stroke="none"
                fill="#ffffff"
                fillOpacity={1}
              />

              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Historical"
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
                name="Forecast"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {forecastResult && (
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Historical Mean</div>
              <div className="font-medium">{forecastResult.metadata.historicalMean.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500">Forecast Mean</div>
              <div className="font-medium">{forecastResult.metadata.forecastMean.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500">Trend Slope</div>
              <div className="font-medium">{forecastResult.metadata.trendSlope.toFixed(4)}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload as ChartDataPoint;

  return (
    <div className="bg-white border rounded-md p-3 text-xs shadow-lg">
      <div className="font-medium mb-2">{label}</div>
      {data.actual !== undefined && (
        <div className="text-blue-600">Historical: {data.actual.toFixed(2)}</div>
      )}
      {data.predicted !== undefined && (
        <div className="text-green-600">Forecast: {data.predicted.toFixed(2)}</div>
      )}
      {data.upperBound !== undefined && data.lowerBound !== undefined && (
        <div className="text-gray-600 mt-1">
          95% CI: [{data.lowerBound.toFixed(2)}, {data.upperBound.toFixed(2)}]
        </div>
      )}
    </div>
  );
}
