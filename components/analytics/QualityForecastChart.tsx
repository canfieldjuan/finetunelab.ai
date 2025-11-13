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

import React, { useState, useEffect } from 'react';
import {
  LineChart,
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

interface ChartDataPoint {
  date: string;
  actual?: number;
  predicted?: number;
  lowerBound?: number;
  upperBound?: number;
  isHistorical: boolean;
}

interface QualityForecastChartProps {
  metricName: string;
  timeRange?: '7d' | '30d' | '90d';
  forecastDays?: number;
}

export default function QualityForecastChart({
  metricName,
  timeRange = '30d',
  forecastDays = 7
}: QualityForecastChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);

  // Generate mock historical data
  const generateMockHistoricalData = (range: string) => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data = [];
    const now = new Date();

    for (let i = days; i > 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const baseValue = 85 + Math.random() * 10;
      const trend = (days - i) * 0.1;
      const value = baseValue + trend + (Math.random() - 0.5) * 5;

      data.push({
        timestamp: date.toISOString(),
        value: Math.max(0, Math.min(100, value))
      });
    }

    return data;
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
  const fetchAndForecast = async () => {
    try {
      console.log('[QualityForecastChart] Fetching data for metric:', metricName);
      setLoading(true);
      setError(null);

      const historicalData = generateMockHistoricalData(timeRange);
      console.log('[QualityForecastChart] Generated', historicalData.length, 'historical points');

      const forecast = await generateForecast(historicalData, forecastDays, {
        confidenceLevel: 0.95,
        smoothingWindow: 3
      });

      console.log('[QualityForecastChart] Forecast generated, trend:', forecast.trend);
      setForecastResult(forecast);

      const combined = buildChartData(forecast);
      setChartData(combined);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate forecast';
      console.error('[QualityForecastChart] Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    console.log('[QualityForecastChart] Initial load, metric:', metricName);
    fetchAndForecast();
  }, [metricName, timeRange, forecastDays]);

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
function CustomTooltip({ active, payload, label }: any) {
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
