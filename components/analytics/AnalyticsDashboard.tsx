"use client";

/**
 * Analytics Dashboard Component
 * Phase 4.1: Added lazy loading for performance optimization
 */

import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics, type AnalyticsFilters, type AnalyticsSettings } from '@/hooks/useAnalytics';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { ArrowLeft, MessageSquare, Download, Smile, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { BenchmarkAnalysis } from '@/lib/tools/evaluation-metrics/types';

// Lazy load heavy chart components for better performance
const MetricsOverview = lazy(() => import('./MetricsOverview').then(m => ({ default: m.MetricsOverview })));
const RatingDistribution = lazy(() => import('./RatingDistribution').then(m => ({ default: m.RatingDistribution })));
const SuccessRateChart = lazy(() => import('./SuccessRateChart').then(m => ({ default: m.SuccessRateChart })));
const TokenUsageChart = lazy(() => import('./TokenUsageChart').then(m => ({ default: m.TokenUsageChart })));
const ToolPerformanceChart = lazy(() => import('./ToolPerformanceChart').then(m => ({ default: m.ToolPerformanceChart })));
const ErrorBreakdownChart = lazy(() => import('./ErrorBreakdownChart').then(m => ({ default: m.ErrorBreakdownChart })));
const CostTrackingChart = lazy(() => import('./CostTrackingChart').then(m => ({ default: m.CostTrackingChart })));
const ConversationLengthChart = lazy(() => import('./ConversationLengthChart').then(m => ({ default: m.ConversationLengthChart })));
const ResponseTimeChart = lazy(() => import('./ResponseTimeChart').then(m => ({ default: m.ResponseTimeChart })));
const InsightsPanel = lazy(() => import('./InsightsPanel').then(m => ({ default: m.InsightsPanel })));
const ModelPerformanceTable = lazy(() => import('./ModelPerformanceTable').then(m => ({ default: m.ModelPerformanceTable })));
const SessionComparisonTable = lazy(() => import('./SessionComparisonTable').then(m => ({ default: m.SessionComparisonTable })));
const TrainingEffectivenessChart = lazy(() => import('./TrainingEffectivenessChart').then(m => ({ default: m.TrainingEffectivenessChart })));
const BenchmarkAnalysisChart = lazy(() => import('./BenchmarkAnalysisChart').then(m => ({ default: m.BenchmarkAnalysisChart })));
const SLABreachChart = lazy(() => import('./SLABreachChart').then(m => ({ default: m.SLABreachChart })));
const JudgmentsBreakdown = lazy(() => import('./JudgmentsBreakdown').then(m => ({ default: m.JudgmentsBreakdown })));
const JudgmentsTable = lazy(() => import('./JudgmentsTable').then(m => ({ default: m.JudgmentsTable })));
const AnomalyFeed = lazy(() => import('./AnomalyFeed'));
const QualityForecastChart = lazy(() => import('./QualityForecastChart'));
const SentimentAnalyzer = lazy(() => import('./SentimentAnalyzer'));
const SentimentTrendChart = lazy(() => import('./SentimentTrendChart'));
const ProviderTelemetryPanel = lazy(() => import('./ProviderTelemetryPanel').then(m => ({ default: m.ProviderTelemetryPanel })));
const ResearchJobsPanel = lazy(() => import('./ResearchJobsPanel').then(m => ({ default: m.ResearchJobsPanel })));
const ProviderComparisonView = lazy(() => import('./ProviderComparisonView').then(m => ({ default: m.ProviderComparisonView })));
const ErrorPatternsView = lazy(() => import('./ErrorPatternsView').then(m => ({ default: m.ErrorPatternsView })));
const ModelCostBreakdown = lazy(() => import('./ModelCostBreakdown').then(m => ({ default: m.ModelCostBreakdown })));
const CacheSavingsCard = lazy(() => import('./CacheSavingsCard').then(m => ({ default: m.CacheSavingsCard })));
const OperationCostChart = lazy(() => import('./OperationCostChart').then(m => ({ default: m.OperationCostChart })));
const BudgetSettingsCard = lazy(() => import('./BudgetSettingsCard').then(m => ({ default: m.BudgetSettingsCard })));
const BudgetAlertsPanel = lazy(() => import('./BudgetAlertsPanel').then(m => ({ default: m.BudgetAlertsPanel })));
const EfficiencyRecommendations = lazy(() => import('./EfficiencyRecommendations').then(m => ({ default: m.EfficiencyRecommendations })));

// Keep FilterPanel, ActiveFiltersBar, and ExportModal as regular imports (lightweight UI components)
import { FilterPanel, ActiveFiltersBar, ExportModal } from './index';

// Workspace collaboration components
import { ActivityFeed } from '@/components/workspace/ActivityFeed';

// Loading fallback component
function ChartLoader() {
  return (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Loading chart...</p>
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  const { user, session } = useAuth();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Filter state (data selection)
  const [filters, setFilters] = useState<AnalyticsFilters>({
    ratings: [],
    models: [],
    successFilter: 'all',
    trainingMethods: [],
    sessions: [],
    widgetSessionFilter: 'all'
  });

  // Settings state (computation/visualization)
  const [settings, setSettings] = useState<AnalyticsSettings>({});
  
  // Local state for provider/model pricing editors
  const [provKey, setProvKey] = useState('');
  const [provIn, setProvIn] = useState('');
  const [provOut, setProvOut] = useState('');
  const [modelKey, setModelKey] = useState('');
  const [modelIn, setModelIn] = useState('');
  const [modelOut, setModelOut] = useState('');

  // Collapse state
  const [showFilters, setShowFilters] = useState(false);
  const [showMetricConfig, setShowMetricConfig] = useState(false);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);

  // NEW: Benchmark analysis state
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkAnalysis | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState<boolean>(false);

  const { data, loading, error } = useAnalytics({
    userId: user?.id || '',
    timeRange,
    filters,
    settings
  });

  console.log('[AnalyticsDashboard] State:', {
    timeRange,
    selectedModelId,
    selectedSessionId,
    dataLoaded: !!data,
    modelCount: data?.modelPerformance?.length || 0,
    sessionCount: data?.sessionMetrics?.length || 0,
    filtersActive: filters
  });

  // Extract available filter options from data
  const availableModels = useMemo(() => {
    if (!data?.modelPerformance) return [];
    return data.modelPerformance.map(m => ({
      id: m.modelId,
      name: m.modelName
    }));
  }, [data?.modelPerformance]);

  const availableSessions = useMemo(() => {
    if (!data?.sessionMetrics) return [];
    return data.sessionMetrics.map(s => ({
      id: s.sessionId,
      name: s.experimentName || s.sessionId
    }));
  }, [data?.sessionMetrics]);

  const availableTrainingMethods = useMemo(() => {
    if (!data?.trainingEffectiveness) return [];
    return data.trainingEffectiveness.map(t => t.trainingMethod);
  }, [data?.trainingEffectiveness]);

  // Calculate date range for sentiment chart
  const sentimentDateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'all':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }, [timeRange]);

  // NEW: Keep filters in sync with table selections (model)
  useEffect(() => {
    console.log('[AnalyticsDashboard] selectedModelId changed:', selectedModelId);
    setFilters((prev) => {
      const next = {
        ...prev,
        models: selectedModelId ? [selectedModelId] : []
      };
      console.log('[AnalyticsDashboard] Updating filters:', {
        previousModels: prev.models,
        newModels: next.models,
        selectedModelId,
        changed: JSON.stringify(prev.models) !== JSON.stringify(next.models)
      });
      return next;
    });
  }, [selectedModelId]);

  // NEW: Keep filters in sync with table selections (session)
  useEffect(() => {
    setFilters((prev) => {
      const next = {
        ...prev,
        sessions: selectedSessionId ? [selectedSessionId] : []
      };
      if (JSON.stringify(prev.sessions) !== JSON.stringify(next.sessions)) {
        console.log('[AnalyticsDashboard] Applied session filter from selection:', next.sessions);
      }
      return next;
    });
  }, [selectedSessionId]);

  // Load saved filters + settings from localStorage when user changes
  useEffect(() => {
    if (!user?.id) return;
    try {
      const rawF = localStorage.getItem(`analytics:filters:${user.id}`);
      if (rawF) {
        const saved = JSON.parse(rawF);
        if (saved && typeof saved === 'object') setFilters((prev) => ({ ...prev, ...saved }));
      }
      const rawS = localStorage.getItem(`analytics:settings:${user.id}`);
      if (rawS) {
        const savedS = JSON.parse(rawS);
        if (savedS && typeof savedS === 'object') setSettings((prev) => ({ ...prev, ...savedS }));
      }
    } catch (e) {
      console.warn('[AnalyticsDashboard] Failed to restore prefs', e);
    }
  }, [user?.id]);

  // Persist filters + settings
  useEffect(() => {
    if (!user?.id) return;
    try {
      localStorage.setItem(`analytics:filters:${user.id}`, JSON.stringify(filters));
      localStorage.setItem(`analytics:settings:${user.id}`, JSON.stringify(settings));
    } catch (e) {
      console.warn('[AnalyticsDashboard] Failed to persist prefs', e);
    }
  }, [filters, settings, user?.id]);

  // Helper: compute date range from timeRange
  const computeDateRange = (range: '7d' | '30d' | '90d' | 'all') => {
    const end = new Date();
    if (range === 'all') {
      return { startDate: undefined, endDate: undefined };
    }
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  };

  // Fetch benchmark analysis when auth/timeRange changes
  useEffect(() => {
    if (!user) return;

    const fetchBenchmarks = async () => {
      try {
        setBenchmarkLoading(true);
        setBenchmarkError(null);
        const { startDate, endDate } = computeDateRange(timeRange);
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        // Fallback to period if no dates
        if (!startDate && !endDate) params.set('period', 'all');

        console.log('[AnalyticsDashboard] Fetching benchmark analysis with params:', Object.fromEntries(params.entries()));

        const res = await fetch(`/api/analytics/benchmark-analysis?${params.toString()}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });

        if (!res.ok) {
          const text = await res.text();
          console.error('[AnalyticsDashboard] Benchmark API error:', res.status, text);
          throw new Error(`Benchmark API ${res.status}`);
        }

        const json = await res.json();
        const data = json?.data as BenchmarkAnalysis | undefined;
        setBenchmarkData(data || null);
        console.log('[AnalyticsDashboard] Benchmark analysis loaded:', {
          hasData: !!data,
          benchmarksAnalyzed: data?.benchmarksAnalyzed || 0,
          totalJudgments: data?.totalJudgments || 0,
        });
      } catch (err) {
        setBenchmarkError(err instanceof Error ? err.message : 'Failed to load benchmarks');
      } finally {
        setBenchmarkLoading(false);
      }
    };

    fetchBenchmarks();
  }, [user, session?.access_token, timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Analytics</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          {/* Top Row: Back Button + Action Buttons */}
          <div className="flex items-center justify-between">
            <Link href="/chat">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Chat
              </Button>
            </Link>

            <div className="flex items-center gap-4">
              {/* Analytics Chat Button */}
              <Link href="/analytics/chat">
                <Button variant="secondary" size="sm" className="gap-2 border border-gray-300">
                  <MessageSquare className="w-4 h-4" />
                  Analytics Assistant
                </Button>
              </Link>

              {/* Sentiment Dashboard Button */}
              <Link href="/analytics/sentiment">
                <Button variant="outline" size="sm" className="gap-2">
                  <Smile className="w-4 h-4" />
                  Sentiment
                </Button>
              </Link>

              {/* Export Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportModal(true)}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export Data
              </Button>

              {/* Time Range Filter */}
              <Select value={timeRange} onValueChange={(value: '7d' | '30d' | '90d' | 'all') => setTimeRange(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Page Title - Now on its own row below */}
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Insights from your conversations and evaluations
            </p>
          </div>
        </div>

        {/* Active Filters Bar */}
        <ActiveFiltersBar
          filters={filters}
          selectedModelId={selectedModelId}
          selectedSessionId={selectedSessionId}
          onClearModel={() => setSelectedModelId(null)}
          onClearSession={() => setSelectedSessionId(null)}
          onClearFilter={(filterKey) => {
            setFilters(prev => {
              const next = { ...prev };
              if (filterKey === 'ratings') next.ratings = [];
              else if (filterKey === 'successFilter') next.successFilter = 'all';
              else if (filterKey === 'widgetSessionFilter') next.widgetSessionFilter = 'all';
              else if (filterKey === 'trainingMethods') next.trainingMethods = [];
              return next;
            });
          }}
          availableModels={availableModels}
          availableSessions={availableSessions}
        />

        {/* Controls: Filters and Settings (collapsible) */}
        <div className="flex flex-col gap-3">
          {/* Filters */}
          <div className="bg-card border rounded-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-medium">Filters</div>
              <button className="text-sm text-blue-600 cursor-pointer" onClick={() => setShowFilters(v => !v)}>
                {showFilters ? 'Hide' : 'Show'}
              </button>
            </div>
            {showFilters && (
              <div className="p-4">
                <div className="text-xs text-muted-foreground mb-3">
                  Filters choose which data is included in charts and tables. Clearing filters does not change Settings.
                </div>
                <FilterPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableTrainingMethods={availableTrainingMethods}
                />
              </div>
            )}
          </div>

          {/* Metric Configuration */}
          <div className="bg-card border rounded-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-medium">Metric Configuration</div>
              <button className="text-sm text-blue-600 cursor-pointer" onClick={() => setShowMetricConfig(v => !v)}>
                {showMetricConfig ? 'Hide' : 'Show'}
              </button>
            </div>
            {showMetricConfig && (
              <div className="p-4 space-y-6">
                <div className="text-xs text-muted-foreground">
                  Configure how metrics are calculated (SLA thresholds, pricing models). This does not affect which data is included.
                </div>
                {/* SLA + Default Pricing */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">SLA Threshold (ms)</div>
                    <input
                      type="number"
                      min={1}
                      placeholder="2000"
                      value={settings.slaThresholdMs ?? ''}
                      onChange={(e) => setSettings(s => ({ ...s, slaThresholdMs: Number(e.target.value) || undefined }))}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                    <div className="text-[11px] text-muted-foreground">Used for breach-rate and percentile analysis.</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Default Pricing ($ per 1K tokens)</div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[11px] block mb-1">Input</label>
                        <input
                          type="number"
                          step="0.0001"
                          min={0}
                          placeholder="0.03"
                          value={settings.priceBook?.default?.inputPer1K ?? ''}
                          onChange={(e) => setSettings(s => ({
                            ...s,
                            priceBook: {
                              default: { inputPer1K: Number(e.target.value) || 0, outputPer1K: s.priceBook?.default?.outputPer1K ?? 0.06 },
                              providers: s.priceBook?.providers ?? {},
                              models: s.priceBook?.models ?? {}
                            }
                          }))}
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] block mb-1">Output</label>
                        <input
                          type="number"
                          step="0.0001"
                          min={0}
                          placeholder="0.06"
                          value={settings.priceBook?.default?.outputPer1K ?? ''}
                          onChange={(e) => setSettings(s => ({
                            ...s,
                            priceBook: {
                              default: { inputPer1K: s.priceBook?.default?.inputPer1K ?? 0.03, outputPer1K: Number(e.target.value) || 0 },
                              providers: s.priceBook?.providers ?? {},
                              models: s.priceBook?.models ?? {}
                            }
                          }))}
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Provider Overrides */}
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Provider Override</div>
                  <div className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                    <div>
                      <label className="text-[11px] block mb-1">Provider (e.g., openai, anthropic)</label>
                      <input
                        type="text"
                        value={provKey}
                        onChange={(e) => setProvKey(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="provider"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] block mb-1">Input $/1K</label>
                      <input
                        type="number"
                        step="0.0001"
                        min={0}
                        value={provIn}
                        onChange={(e) => setProvIn(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="0.03"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] block mb-1">Output $/1K</label>
                      <input
                        type="number"
                        step="0.0001"
                        min={0}
                        value={provOut}
                        onChange={(e) => setProvOut(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="0.06"
                      />
                    </div>
                    <button
                      className="text-sm px-3 py-1 border rounded"
                      onClick={() => {
                        if (!provKey.trim()) return;
                        const inRate = Number(provIn);
                        const outRate = Number(provOut);
                        if (!Number.isFinite(inRate) || !Number.isFinite(outRate)) return;
                        const key = provKey.trim().toLowerCase();
                        setSettings(s => ({
                          ...s,
                          priceBook: {
                            default: s.priceBook?.default ?? { inputPer1K: 0.03, outputPer1K: 0.06 },
                            providers: { ...(s.priceBook?.providers ?? {}), [key]: { inputPer1K: inRate, outputPer1K: outRate } },
                            models: s.priceBook?.models ?? {}
                          }
                        }));
                        setProvKey(''); setProvIn(''); setProvOut('');
                      }}
                    >
                      Apply
                    </button>
                  </div>
                  {settings.priceBook && Object.keys(settings.priceBook.providers || {}).length > 0 && (
                    <div className="text-[11px] text-muted-foreground">
                      Active providers: {Object.keys(settings.priceBook.providers || {}).join(', ')}
                    </div>
                  )}
                </div>

                {/* Model Overrides */}
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Model Override</div>
                  <div className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                    <div>
                      <label className="text-[11px] block mb-1">Model ID (exact match)</label>
                      <input
                        type="text"
                        value={modelKey}
                        onChange={(e) => setModelKey(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="model_id"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] block mb-1">Input $/1K</label>
                      <input
                        type="number"
                        step="0.0001"
                        min={0}
                        value={modelIn}
                        onChange={(e) => setModelIn(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="0.03"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] block mb-1">Output $/1K</label>
                      <input
                        type="number"
                        step="0.0001"
                        min={0}
                        value={modelOut}
                        onChange={(e) => setModelOut(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="0.06"
                      />
                    </div>
                    <button
                      className="text-sm px-3 py-1 border rounded"
                      onClick={() => {
                        if (!modelKey.trim()) return;
                        const inRate = Number(modelIn);
                        const outRate = Number(modelOut);
                        if (!Number.isFinite(inRate) || !Number.isFinite(outRate)) return;
                        const key = modelKey.trim();
                        setSettings(s => ({
                          ...s,
                          priceBook: {
                            default: s.priceBook?.default ?? { inputPer1K: 0.03, outputPer1K: 0.06 },
                            providers: s.priceBook?.providers ?? {},
                            models: { ...(s.priceBook?.models ?? {}), [key]: { inputPer1K: inRate, outputPer1K: outRate } }
                          }
                        }));
                        setModelKey(''); setModelIn(''); setModelOut('');
                      }}
                    >
                      Apply
                    </button>
                  </div>
                  {settings.priceBook && Object.keys(settings.priceBook.models || {}).length > 0 && (
                    <div className="text-[11px] text-muted-foreground">
                      Active models: {Object.keys(settings.priceBook.models || {}).join(', ')}
                    </div>
                  )}
                </div>

                {/* Reset Buttons */}
                <div className="mt-2 flex items-center gap-4 pt-4 border-t">
                  <button
                    className="text-sm text-red-600 underline cursor-pointer"
                    onClick={() => setSettings(s => ({ ...s, priceBook: undefined }))}
                    title="Clear all pricing overrides"
                  >
                    Reset Pricing to Default
                  </button>
                  <button
                    className="text-sm text-red-600 underline cursor-pointer"
                    onClick={() => setSettings({})}
                    title="Reset SLA and all Pricing to defaults"
                  >
                    Reset All Settings
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs Interface */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="research">Research</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <Suspense fallback={<ChartLoader />}>
              <MetricsOverview
                totalMessages={data.overview.totalMessages}
                totalConversations={data.overview.totalConversations}
                totalEvaluations={data.overview.totalEvaluations}
                avgRating={data.overview.avgRating}
                successRate={data.overview.successRate}
                totalCost={data.overview.totalCost}
                costPerMessage={data.overview.costPerMessage}
              />
            </Suspense>
            
            {/* AI Insights Panel */}
            {user?.id && (
              <Suspense fallback={<ChartLoader />}>
                <InsightsPanel userId={user.id} timeRange={timeRange} />
              </Suspense>
            )}

            {/* Workspace Activity */}
            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Workspace Activity</h3>
              <ActivityFeed limit={50} height="600px" showLoadMore={true} />
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6 mt-6">
            {/* Model Performance Table */}
            {data.modelPerformance && data.modelPerformance.length > 0 && (
              <Suspense fallback={<ChartLoader />}>
                <ModelPerformanceTable
                  data={data.modelPerformance}
                  selectedModelId={selectedModelId}
                  onModelSelect={setSelectedModelId}
                />
              </Suspense>
            )}

            {/* Session Comparison Table */}
            <Suspense fallback={<ChartLoader />}>
              <SessionComparisonTable
                data={data.sessionMetrics}
                selectedSessionId={selectedSessionId}
                onSessionSelect={setSelectedSessionId}
              />
            </Suspense>

            {/* Training Effectiveness Chart */}
            {data.trainingEffectiveness && data.trainingEffectiveness.length > 0 && (
              <Suspense fallback={<ChartLoader />}>
                <TrainingEffectivenessChart data={data.trainingEffectiveness} />
              </Suspense>
            )}

            {/* Benchmark Analysis Chart */}
            {benchmarkLoading ? (
              <div className="bg-card border rounded-lg p-4 text-sm text-muted-foreground">
                Loading benchmark analysis...
              </div>
            ) : benchmarkError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                Failed to load benchmark analysis: {benchmarkError}
              </div>
            ) : (
              <Suspense fallback={<ChartLoader />}>
                <BenchmarkAnalysisChart data={benchmarkData} />
              </Suspense>
            )}

            {/* Provider Comparison */}
            <Suspense fallback={<ChartLoader />}>
              <ProviderComparisonView />
            </Suspense>

            {/* Error Patterns */}
            <Suspense fallback={<ChartLoader />}>
              <ErrorPatternsView />
            </Suspense>
          </TabsContent>

          {/* Quality Tab */}
          <TabsContent value="quality" className="space-y-6 mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Suspense fallback={<ChartLoader />}>
                <RatingDistribution data={data.ratingDistribution} />
              </Suspense>
              <Suspense fallback={<ChartLoader />}>
                <SuccessRateChart data={data.successFailure} />
              </Suspense>
            </div>

            {/* Judgments Breakdown */}
            {data.failureTags.length > 0 && (
              <>
                <Suspense fallback={<ChartLoader />}>
                  <JudgmentsBreakdown data={data.failureTags} />
                </Suspense>
                <Suspense fallback={<ChartLoader />}>
                  <JudgmentsTable data={data.failureTags} timeRange={timeRange} />
                </Suspense>
              </>
            )}

            {/* Sentiment Analysis */}
            <div className="grid gap-6 md:grid-cols-2">
              <Suspense fallback={<ChartLoader />}>
                <SentimentAnalyzer lookbackDays={timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365} />
              </Suspense>
              <Suspense fallback={<ChartLoader />}>
                <SentimentTrendChart
                  startDate={sentimentDateRange.startDate}
                  endDate={sentimentDateRange.endDate}
                />
              </Suspense>
            </div>
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="space-y-6 mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {data.conversationLengths.some(c => c.count > 0) && (
                <Suspense fallback={<ChartLoader />}>
                  <ConversationLengthChart data={data.conversationLengths} />
                </Suspense>
              )}
              <Suspense fallback={<ChartLoader />}>
                <ResponseTimeChart data={data.responseTimeTrends} />
              </Suspense>
            </div>

            {/* SLA Breach Rate */}
            {data.responseTimeTrends.length > 0 && (
              <Suspense fallback={<ChartLoader />}>
                <SLABreachChart data={data.responseTimeTrends.map(d => ({ date: d.date, slaBreachRate: d.slaBreachRate, sampleSize: d.sampleSize }))} />
              </Suspense>
            )}

            {/* Token Usage */}
            {data.tokenUsage.length > 0 && (
              <Suspense fallback={<ChartLoader />}>
                <TokenUsageChart data={data.tokenUsage} />
              </Suspense>
            )}

            {/* Cost Tracking */}
            {data.costTracking.length > 0 && (
              <Suspense fallback={<ChartLoader />}>
                <CostTrackingChart data={data.costTracking} />
              </Suspense>
            )}
            
            {/* New Cost Components */}
            <div className="grid gap-6 md:grid-cols-2">
              <Suspense fallback={<ChartLoader />}>
                <ModelCostBreakdown />
              </Suspense>
              <Suspense fallback={<ChartLoader />}>
                <CacheSavingsCard />
              </Suspense>
            </div>
            <Suspense fallback={<ChartLoader />}>
              <OperationCostChart />
            </Suspense>

            {/* Budget Tracking - Category 4 Phase 3 */}
            <div className="grid gap-6 md:grid-cols-2">
              <Suspense fallback={<ChartLoader />}>
                <BudgetSettingsCard />
              </Suspense>
              <Suspense fallback={<ChartLoader />}>
                <BudgetAlertsPanel />
              </Suspense>
            </div>

            {/* Efficiency Recommendations - Category 4 Phase 4 */}
            <Suspense fallback={<ChartLoader />}>
              <EfficiencyRecommendations />
            </Suspense>
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="space-y-6 mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Suspense fallback={<ChartLoader />}>
                <AnomalyFeed maxItems={10} autoRefresh={true} refreshInterval={30000} />
              </Suspense>
              {data.errorBreakdown.length > 0 && (
                <Suspense fallback={<ChartLoader />}>
                  <ErrorBreakdownChart data={data.errorBreakdown} />
                </Suspense>
              )}
            </div>
          </TabsContent>

          {/* Research Tab */}
          <TabsContent value="research" className="space-y-6 mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Suspense fallback={<ChartLoader />}>
                <QualityForecastChart
                  metricName="Success Rate"
                  metricType="success_rate"
                  timeRange={timeRange === 'all' ? '90d' : timeRange}
                  forecastDays={7}
                />
              </Suspense>
              {data.toolPerformance.length > 0 && (
                <Suspense fallback={<ChartLoader />}>
                  <ToolPerformanceChart data={data.toolPerformance} />
                </Suspense>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Suspense fallback={<ChartLoader />}>
                <ProviderTelemetryPanel hours={24} />
              </Suspense>
              <Suspense fallback={<ChartLoader />}>
                <ResearchJobsPanel limit={20} />
              </Suspense>
            </div>
          </TabsContent>
        </Tabs>

        {/* Additional Info */}
        {data.overview.totalEvaluations === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Tip:</strong> Rate some responses using the star button to see more detailed analytics!
            </p>
          </div>
        )}
      </div>
      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={data as unknown as Record<string, unknown> | null}
      />
    </div>
  );
}
