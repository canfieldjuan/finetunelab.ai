// Batch Testing Component
// Purpose: Test HuggingFace models with extracted prompts from Claude Desktop conversations
// Date: 2025-10-18

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Play, Loader2, CheckCircle, AlertCircle, RefreshCw, X, Search, Archive, Trash2, ChevronDown, ChevronRight, CodeXml } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';
import { useBatchTestRuns } from '@/hooks/useBatchTestRuns';
import { log } from '@/lib/utils/logger';

interface BatchTestingProps {
  sessionToken?: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
}

interface Benchmark {
  id: string;
  name: string;
  description?: string;
  task_type: string;
  pass_criteria: {
    min_score: number;
    required_validators?: string[];
    custom_rules?: Record<string, any>;
  };
}

interface BatchTestRun {
  id: string;
  model_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_prompts: number;
  completed_prompts: number;
  failed_prompts: number;
  progress: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}

interface ValidatorStats {
  judge_name: string;
  judge_type: string;
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  criteria: Record<string, { total: number; passed: number; failed: number }>;
}

interface ValidatorBreakdown {
  validators: ValidatorStats[];
  total_messages: number;
}

export function BatchTesting({ sessionToken }: BatchTestingProps) {
  // Form state
  const [models, setModels] = useState<Model[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  // widgetApiKey removed - now using session token authentication
  const [sourcePath, setSourcePath] = useState('/home/juan-canfield/Desktop/web-ui/datasets/conversations_chunks');
  const [promptLimit, setPromptLimit] = useState(25);
  const [concurrency, setConcurrency] = useState(5);
  const [delayMs, setDelayMs] = useState(1000);

  // UI state
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testRuns, setTestRuns] = useState<BatchTestRun[]>([]);

  // Archive/filter state
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');
  const [runSearch, setRunSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'running'>('all');
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [validatorBreakdowns, setValidatorBreakdowns] = useState<Record<string, ValidatorBreakdown>>({});

  // Hook for archive operations
  const batchTestRunsHook = useBatchTestRuns();

  log.trace('BatchTesting', 'Component mounted');

  // Fetch models and benchmarks on mount
  useEffect(() => {
    log.debug('BatchTesting', 'useEffect triggered', { hasSessionToken: !!sessionToken });
    if (sessionToken) {
      // Clear search field on mount to prevent autocomplete issues
      setModelSearch('');
      fetchModels();
      fetchBenchmarks();
      fetchTestRuns();
    } else {
      log.warn('BatchTesting', 'No sessionToken available, cannot fetch models');
    }
  }, [sessionToken]);

  // Refetch when viewTab changes
  useEffect(() => {
    if (sessionToken) {
      fetchTestRuns();
    }
  }, [viewTab, sessionToken, fetchTestRuns]);

  // Memoize hasRunningTests to prevent unnecessary effect re-runs
  const hasRunningTests = useMemo(() => {
    const hasRunning = testRuns.some(run =>
      run.status === 'running' || run.status === 'pending'
    );
    console.log('[BatchTesting] Has running tests:', hasRunning, 'Total runs:', testRuns.length);
    return hasRunning;
  }, [testRuns]);

  // Auto-refresh test runs while any are running
  useEffect(() => {
    if (!hasRunningTests) {
      console.log('[BatchTesting] No running tests, skipping auto-refresh setup');
      return;
    }

    console.log('[BatchTesting] Setting up auto-refresh interval (2s)');
    const interval = setInterval(() => {
      console.log('[BatchTesting] Auto-refreshing test runs');
      fetchTestRuns();
    }, 2000); // Poll every 2 seconds

    return () => {
      console.log('[BatchTesting] Cleaning up auto-refresh interval');
      clearInterval(interval);
    };
  }, [hasRunningTests, sessionToken]);

  async function fetchModels() {
    log.debug('BatchTesting', 'Fetching models from /api/models', {
      hasSessionToken: !!sessionToken,
      tokenLength: sessionToken?.length || 0,
      tokenFormat: sessionToken ? (sessionToken.split('.').length === 3 ? 'valid JWT' : 'invalid JWT') : 'no token'
    });
    
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
        log.debug('BatchTesting', 'Added Authorization header');
      } else {
        log.warn('BatchTesting', 'No sessionToken - will only get global models');
      }
      
      const response = await fetch('/api/models', { headers });

      log.debug('BatchTesting', 'Models API response received', { status: response.status });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('BatchTesting', 'Models API error', { status: response.status, errorText });
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      const allModels = data.models || [];
      log.debug('BatchTesting', 'Models loaded', { 
        count: allModels.length, 
        sampleModel: allModels[0]?.name 
      });
      setModels(allModels);
    } catch (err) {
      log.error('BatchTesting', 'Error fetching models', { error: err });
      setError('Failed to load models');
    } finally {
      setLoading(false);
    }
  }

  async function fetchBenchmarks() {
    log.debug('BatchTesting', 'Fetching benchmarks');
    try {
      const response = await fetch('/api/benchmarks', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (!response.ok) {
        log.warn('BatchTesting', 'Failed to fetch benchmarks', { status: response.status });
        return;
      }

      const data = await response.json();
      const allBenchmarks = data.benchmarks || [];
      log.debug('BatchTesting', 'Benchmarks loaded', { count: allBenchmarks.length });
      setBenchmarks(allBenchmarks);
    } catch (err) {
      log.error('BatchTesting', 'Error fetching benchmarks', { error: err });
    }
  }

  async function fetchTestRuns() {
    const archived = viewTab === 'archived';
    log.debug('BatchTesting', 'Fetching batch test runs', { archived });
    try {
      const { data, error } = await supabase
        .from('batch_test_runs')
        .select('*')
        .eq('archived', archived)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      log.debug('BatchTesting', 'Test runs loaded', { count: data?.length || 0 });
      setTestRuns(data || []);
      setSelectedRunIds([]);
    } catch (err) {
      log.error('BatchTesting', 'Error fetching test runs', { error: err });
    }
  }

  // Filter models based on search query
  function getFilteredModels(): Model[] {
    log.trace('BatchTesting', 'Filtering models', { totalModels: models.length, search: modelSearch });
    if (!modelSearch.trim()) {
      log.trace('BatchTesting', 'No search filter, returning all models', { count: models.length });
      return models;
    }

    const search = modelSearch.toLowerCase();
    const filtered = models.filter(model =>
      model.name.toLowerCase().includes(search) ||
      model.provider.toLowerCase().includes(search)
    );

    log.debug('BatchTesting', 'Models filtered', { filtered: filtered.length, total: models.length });
    return filtered;
  }

  // Group models by provider
  function getGroupedModels(): Record<string, Model[]> {
    const filtered = getFilteredModels();
    const grouped: Record<string, Model[]> = {};

    filtered.forEach(model => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    });

    log.debug('BatchTesting', 'Models grouped by provider', { providerCount: Object.keys(grouped).length });
    return grouped;
  }

  async function handleStartTest() {
    if (!selectedModelId) {
      setError('Please select a model');
      return;
    }

    log.debug('BatchTesting', 'Starting batch test', {
      modelId: selectedModelId,
      benchmarkId: selectedBenchmarkId || 'none'
    });
    setStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/batch-testing/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          config: {
            model_id: selectedModelId,
            // widget_api_key removed - using session token from Authorization header
            source_path: sourcePath,
            prompt_limit: promptLimit,
            concurrency: concurrency,
            delay_ms: delayMs,
            benchmark_id: selectedBenchmarkId || undefined
          }
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to start batch test');
        } else {
          const text = await response.text();
          log.error('BatchTesting', 'Non-JSON error response', { preview: text.substring(0, 200) });
          throw new Error(`Failed to start batch test: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      log.debug('BatchTesting', 'Batch test started successfully', { testRunId: data.test_run_id });

      fetchTestRuns();
    } catch (err) {
      log.error('BatchTesting', 'Error starting test', { error: err });
      setError(err instanceof Error ? err.message : 'Failed to start batch test');
    } finally {
      setStarting(false);
    }
  }

  async function handleCancelTest(testRunId: string) {
    log.debug('BatchTesting', 'Cancelling test run', { testRunId });

    try {
      const response = await fetch('/api/batch-testing/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ test_run_id: testRunId })
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to cancel test');
        } else {
          const text = await response.text();
          log.error('BatchTesting', 'Non-JSON cancel response', { preview: text.substring(0, 200) });
          throw new Error(`Failed to cancel test: ${response.status} ${response.statusText}`);
        }
      }

      log.debug('BatchTesting', 'Test cancelled successfully');
      fetchTestRuns(); // Refresh the list
    } catch (err) {
      log.error('BatchTesting', 'Error cancelling test', { error: err });
      setError(err instanceof Error ? err.message : 'Failed to cancel test');
    }
  }

  async function fetchValidatorBreakdown(testRunId: string) {
    log.debug('BatchTesting', 'Fetching validator breakdown', { testRunId });

    try {
      const response = await fetch(`/api/batch-testing/${testRunId}/validators`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (!response.ok) {
        log.warn('BatchTesting', 'Failed to fetch validator breakdown', { status: response.status });
        return;
      }

      const data = await response.json();
      log.debug('BatchTesting', 'Validator breakdown loaded', { testRunId, validatorCount: data?.length || 0 });
      
      setValidatorBreakdowns(prev => ({
        ...prev,
        [testRunId]: data
      }));
    } catch (err) {
      log.error('BatchTesting', 'Error fetching validator breakdown', { error: err });
    }
  }

  function toggleExpandRun(testRunId: string) {
    if (expandedRunId === testRunId) {
      setExpandedRunId(null);
    } else {
      setExpandedRunId(testRunId);
      // Fetch validator breakdown if not already loaded
      if (!validatorBreakdowns[testRunId]) {
        fetchValidatorBreakdown(testRunId);
      }
    }
  }

  // Filter test runs by search and status
  function getFilteredTestRuns(): BatchTestRun[] {
    let filtered = testRuns;

    // Filter by search
    if (runSearch.trim()) {
      const search = runSearch.toLowerCase();
      filtered = filtered.filter(run =>
        run.model_name.toLowerCase().includes(search)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(run => run.status === statusFilter);
    }

    return filtered;
  }

  // Multi-select handlers
  function toggleSelectRun(id: string) {
    setSelectedRunIds(prev =>
      prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  }

  function toggleSelectAll() {
    const filtered = getFilteredTestRuns();
    if (selectedRunIds.length === filtered.length) {
      setSelectedRunIds([]);
    } else {
      setSelectedRunIds(filtered.map(run => run.id));
    }
  }

  // Bulk action handlers
  async function handleArchiveSelected() {
    if (selectedRunIds.length === 0) return;

    try {
      await batchTestRunsHook.archive({ testRunIds: selectedRunIds });
      await fetchTestRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive test runs');
    }
  }

  async function handleRestoreSelected() {
    if (selectedRunIds.length === 0) return;

    try {
      await batchTestRunsHook.restore({ testRunIds: selectedRunIds });
      await fetchTestRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore test runs');
    }
  }

  async function handleDeleteSelected() {
    if (selectedRunIds.length === 0) return;

    const confirmed = window.confirm(
      `Permanently delete ${selectedRunIds.length} test run(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await batchTestRunsHook.permanentDelete({ testRunIds: selectedRunIds });
      await fetchTestRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete test runs');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Batch Testing Configuration</CardTitle>
          <CardDescription>
            Test any LLM model with extracted prompts from Claude Desktop conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model-select">LLM Model</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="model-search"
                  name="model-search-field"
                  type="text"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Search models or providers..."
                  className="pl-10"
                  disabled={starting}
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                />
              </div>
              <Select value={selectedModelId} onValueChange={setSelectedModelId} disabled={starting}>
                <SelectTrigger id="model-select">
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(getGroupedModels()).map(([provider, providerModels]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{provider}</SelectLabel>
                      {providerModels.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="benchmark-select">Benchmark (Optional)</Label>
            <Select value={selectedBenchmarkId} onValueChange={setSelectedBenchmarkId} disabled={starting}>
              <SelectTrigger id="benchmark-select">
                <SelectValue placeholder="No benchmark (basic evaluation only)" />
              </SelectTrigger>
              <SelectContent>
                {benchmarks.map(benchmark => {
                  const validatorCount = benchmark.pass_criteria.required_validators?.length || 0;
                  const minScore = benchmark.pass_criteria.min_score || 0;
                  const hasCustomRules = Object.keys(benchmark.pass_criteria.custom_rules || {}).length > 0;

                  return (
                    <SelectItem key={benchmark.id} value={benchmark.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{benchmark.name}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{benchmark.task_type}</span>
                        {validatorCount > 0 && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-green-600 font-medium">{validatorCount} validator{validatorCount !== 1 ? 's' : ''}</span>
                          </>
                        )}
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">min {minScore}%</span>
                        {hasCustomRules && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-blue-600">custom rules</span>
                          </>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select a benchmark to run task-specific validators during evaluation
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-path">Source Directory Path</Label>
            <Input
              id="source-path"
              value={sourcePath}
              onChange={(e) => setSourcePath(e.target.value)}
              placeholder="/path/to/claude/conversations"
              disabled={starting}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-limit">Prompt Limit</Label>
              <Input
                id="prompt-limit"
                type="number"
                min="1"
                max="1000"
                value={promptLimit}
                onChange={(e) => setPromptLimit(parseInt(e.target.value) || 25)}
                disabled={starting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="concurrency">Concurrency</Label>
              <Input
                id="concurrency"
                type="number"
                min="1"
                max="10"
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value) || 5)}
                disabled={starting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delay">Delay (ms)</Label>
              <Input
                id="delay"
                type="number"
                min="0"
                max="10000"
                value={delayMs}
                onChange={(e) => setDelayMs(parseInt(e.target.value) || 1000)}
                disabled={starting}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleStartTest}
            disabled={!selectedModelId || starting}
            variant="secondary"
            className="w-full"
          >
            {starting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Batch Test...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Batch Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Batch Test Runs</CardTitle>
            <Button
              onClick={fetchTestRuns}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as 'active' | 'archived')}>
            <TabsList className="mb-4">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>

            <TabsContent value={viewTab} className="space-y-4">
              {/* Search and Filter */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={runSearch}
                    onChange={(e) => setRunSearch(e.target.value)}
                    placeholder="Search by model name..."
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bulk Actions Toolbar */}
              {selectedRunIds.length > 0 && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedRunIds.length} selected
                  </span>
                  <div className="flex gap-2">
                    {viewTab === 'active' && (
                      <Button
                        onClick={handleArchiveSelected}
                        variant="outline"
                        size="sm"
                        disabled={batchTestRunsHook.loading}
                      >
                        <Archive className="h-3 w-3 mr-1" />
                        Archive
                      </Button>
                    )}
                    {viewTab === 'archived' && (
                      <Button
                        onClick={handleRestoreSelected}
                        variant="outline"
                        size="sm"
                        disabled={batchTestRunsHook.loading}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    )}
                    <Button
                      onClick={handleDeleteSelected}
                      variant="destructive"
                      size="sm"
                      disabled={batchTestRunsHook.loading}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}

              {/* Select All */}
              {getFilteredTestRuns().length > 0 && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="selectAll"
                    checked={selectedRunIds.length === getFilteredTestRuns().length}
                    onChange={toggleSelectAll}
                    className="rounded border-input"
                  />
                  <label htmlFor="selectAll" className="text-sm">
                    Select all ({getFilteredTestRuns().length})
                  </label>
                </div>
              )}

              {/* Test Runs List */}
              {getFilteredTestRuns().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {testRuns.length === 0
                    ? `No ${viewTab} test runs yet.`
                    : 'No test runs match your filters.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {getFilteredTestRuns().map(run => {
                    const isExpanded = expandedRunId === run.id;
                    const breakdown = validatorBreakdowns[run.id];

                    return (
                      <div
                        key={run.id}
                        className={`p-4 border rounded-lg space-y-3 ${
                          selectedRunIds.includes(run.id) ? 'bg-accent border-accent' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedRunIds.includes(run.id)}
                            onChange={() => toggleSelectRun(run.id)}
                            className="mt-1 rounded border-input"
                          />
                          <div className="flex-1 flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{run.model_name}</h4>
                              <p className="text-sm text-muted-foreground">
                                Started: {new Date(run.started_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {run.status === 'running' && (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              )}
                              {run.status === 'completed' && (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                              {run.status === 'failed' && (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className="text-sm font-medium capitalize">{run.status}</span>
                              {(run.status === 'running' || run.status === 'pending') && (
                                <Button
                                  onClick={() => handleCancelTest(run.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                >
                                  <X className="h-3 w-3" />
                                  <span className="ml-1 text-xs">Cancel</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress: {run.completed_prompts} / {run.total_prompts}</span>
                            <span>{Math.round((run.completed_prompts / run.total_prompts) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gray-700 h-2 rounded-full transition-all"
                              style={{ width: `${(run.completed_prompts / run.total_prompts) * 100}%` }}
                            />
                          </div>
                          {run.failed_prompts > 0 && (
                            <p className="text-sm text-red-600">
                              {run.failed_prompts} prompts failed
                            </p>
                          )}
                          {run.error && (
                            <p className="text-sm text-red-600">Error: {run.error}</p>
                          )}
                        </div>

                        {/* Validator Breakdown Section */}
                        {run.status === 'completed' && (
                          <div className="border-t pt-3">
                            <button
                              onClick={() => toggleExpandRun(run.id)}
                              className="flex items-center gap-2 text-sm font-medium hover:text-blue-600 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span>Validator Results</span>
                              {breakdown && breakdown.validators.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ({breakdown.validators.length} validator{breakdown.validators.length !== 1 ? 's' : ''})
                                </span>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="mt-3 space-y-2">
                                {!breakdown ? (
                                  <div className="flex items-center justify-center p-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-sm text-muted-foreground">Loading validator results...</span>
                                  </div>
                                ) : breakdown.validators.length === 0 ? (
                                  <div className="text-sm text-muted-foreground p-3 bg-gray-50 rounded">
                                    No validators ran for this test. Add validators to your benchmark for detailed evaluation.
                                  </div>
                                ) : (
                                  <>
                                    <div className="text-xs text-muted-foreground mb-2">
                                      Evaluated {breakdown.total_messages} message{breakdown.total_messages !== 1 ? 's' : ''}
                                    </div>
                                    {breakdown.validators.map(validator => (
                                      <div
                                        key={validator.judge_name}
                                        className="p-3 bg-gray-50 rounded-lg space-y-2"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{validator.judge_name}</span>
                                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                              {validator.judge_type}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className={`text-sm font-medium ${
                                              validator.pass_rate >= 80 ? 'text-green-600' :
                                              validator.pass_rate >= 60 ? 'text-yellow-600' :
                                              'text-red-600'
                                            }`}>
                                              {validator.pass_rate}% pass rate
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex gap-4 text-xs text-muted-foreground">
                                          <span className="text-green-600">✓ {validator.passed} passed</span>
                                          <span className="text-red-600">✗ {validator.failed} failed</span>
                                          <span>Total: {validator.total}</span>
                                        </div>
                                        {/* Per-criterion breakdown if available */}
                                        {Object.keys(validator.criteria).length > 0 && (
                                          <div className="mt-2 pt-2 border-t border-gray-200">
                                            <p className="text-xs font-medium text-muted-foreground mb-1">By Criterion:</p>
                                            <div className="space-y-1">
                                              {Object.entries(validator.criteria).map(([criterion, stats]) => (
                                                <div key={criterion} className="flex items-center justify-between text-xs">
                                                  <span className="text-muted-foreground">{criterion}</span>
                                                  <span className="text-muted-foreground">
                                                    {stats.passed}/{stats.total} passed
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
      </TabsContent>
    </Tabs>
  </CardContent>
</Card>
    </div>
  );
}
