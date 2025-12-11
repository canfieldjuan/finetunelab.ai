// Batch Testing Component
// Purpose: Test HuggingFace models with extracted prompts from Claude Desktop conversations
// Date: 2025-10-18

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Play, Loader2, CheckCircle, AlertCircle, RefreshCw, X, Search, Archive, Trash2, ChevronDown, ChevronRight, Upload, Plus, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
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
    custom_rules?: Record<string, unknown>;
  };
}

interface TestSuite {
  id: string;
  name: string;
  description?: string;
  prompt_count: number;
  created_at: string;
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
  config?: {
    custom_name?: string;
    test_suite_name?: string;
    [key: string]: unknown;
  };
}


export function BatchTesting({ sessionToken }: BatchTestingProps) {
  // Form state
  const [models, setModels] = useState<Model[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState('');
  const [selectedTestSuiteId, setSelectedTestSuiteId] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [promptLimit, setPromptLimit] = useState(25);
  const [concurrency, setConcurrency] = useState(5);
  const [delayMs, setDelayMs] = useState(1000);
  const [testRunName, setTestRunName] = useState('');

  // Session tagging state
  const [useSessionTag, setUseSessionTag] = useState(false);
  const [autoGenerateTag, setAutoGenerateTag] = useState(true);
  const [sessionId, setSessionId] = useState('');
  const [experimentName, setExperimentName] = useState('');

  // Assistant judge state
  const [useAssistantJudge, setUseAssistantJudge] = useState(false);
  const [judgeModel, setJudgeModel] = useState<'gpt-4.1' | 'claude-sonnet-4-5-20250929' | 'claude-haiku-4-5-20251001'>('gpt-4.1');
  const [judgeCriteria, setJudgeCriteria] = useState<string[]>(['helpfulness', 'accuracy', 'clarity']);

  // UI state
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testRuns, setTestRuns] = useState<BatchTestRun[]>([]);

  // Test suite creation state
  const [showCreateSuite, setShowCreateSuite] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuitePrompts, setNewSuitePrompts] = useState('');
  const [creatingSuite, setCreatingSuite] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Archive/filter state
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');
  const [runSearch, setRunSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'running'>('all');
  const [displayLimit, setDisplayLimit] = useState<number>(25);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);

  // Hook for archive operations
  const batchTestRunsHook = useBatchTestRuns();

  log.trace('BatchTesting', 'Component mounted');

  // Helper function to generate session tag
  function generateSessionTag(modelId: string): { sessionId: string; experimentName: string } {
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, '')
      .slice(0, 15); // YYYYMMDDTHHmmss

    const modelShort = modelId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .slice(0, 20);

    return {
      sessionId: `batch-${modelShort}-${timestamp}`,
      experimentName: `batch-testing-${modelShort}`
    };
  }

  // Helper function to get judge cost estimate
  function getJudgeCostEstimate(): number {
    if (!useAssistantJudge) return 0;

    const costPerMessage = judgeModel === 'gpt-4.1' ? 0.005 :
                          judgeModel === 'claude-sonnet-4-5-20250929' ? 0.008 :
                          0.001; // claude-haiku-4-5-20251001

    const criteriaMultiplier = judgeCriteria.length / 5; // Base is 5 criteria
    return promptLimit * costPerMessage * criteriaMultiplier;
  }

  // Define fetch functions before useEffects that depend on them
  const fetchModels = useCallback(async () => {
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
  }, [sessionToken]);

  const fetchBenchmarks = useCallback(async () => {
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
  }, [sessionToken]);

  const fetchTestSuites = useCallback(async () => {
    log.debug('BatchTesting', 'Fetching test suites');
    try {
      const response = await fetch('/api/test-suites', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (!response.ok) {
        log.warn('BatchTesting', 'Failed to fetch test suites', { status: response.status });
        return;
      }

      const data = await response.json();
      const allTestSuites = data.testSuites || [];
      log.debug('BatchTesting', 'Test suites loaded', { count: allTestSuites.length });
      setTestSuites(allTestSuites);
    } catch (err) {
      log.error('BatchTesting', 'Error fetching test suites', { error: err });
    }
  }, [sessionToken]);

  const fetchTestRuns = useCallback(async () => {
    const archived = viewTab === 'archived';
    log.debug('BatchTesting', 'Fetching batch test runs', { archived, displayLimit });
    try {
      const { data, error } = await supabase
        .from('batch_test_runs')
        .select('*')
        .eq('archived', archived)
        .order('created_at', { ascending: false })
        .limit(displayLimit);

      if (error) throw error;

      log.debug('BatchTesting', 'Test runs loaded', { count: data?.length || 0 });
      setTestRuns(data || []);
      setSelectedRunIds([]);
    } catch (err) {
      log.error('BatchTesting', 'Error fetching test runs', { error: err });
    }
  }, [viewTab, displayLimit]);

  // Fetch models, benchmarks, and test suites on mount
  useEffect(() => {
    log.debug('BatchTesting', 'useEffect triggered', { hasSessionToken: !!sessionToken });
    if (sessionToken) {
      // Clear search field on mount to prevent autocomplete issues
      setModelSearch('');
      fetchModels();
      fetchBenchmarks();
      fetchTestSuites();
      fetchTestRuns();
    } else {
      log.warn('BatchTesting', 'No sessionToken available, cannot fetch models');
    }
  }, [sessionToken, fetchBenchmarks, fetchTestSuites, fetchModels, fetchTestRuns]);

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
  }, [hasRunningTests, sessionToken, fetchTestRuns]);

  // Filter models based on search query
  // Memoize filtered models to prevent re-filtering on every render
  const filteredModels = useMemo(() => {
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
  }, [models, modelSearch]);

  // Memoize grouped models to prevent infinite render loop
  const groupedModels = useMemo(() => {
    const grouped: Record<string, Model[]> = {};

    filteredModels.forEach(model => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    });

    log.debug('BatchTesting', 'Models grouped by provider', { providerCount: Object.keys(grouped).length });
    return grouped;
  }, [filteredModels]);

  async function handleCreateTestSuite() {
    if (!newSuiteName.trim()) {
      setError('Please enter a name for the test suite');
      return;
    }

    if (!newSuitePrompts.trim()) {
      setError('Please enter at least one prompt');
      return;
    }

    // Parse prompts (one per line)
    const prompts = newSuitePrompts
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (prompts.length === 0) {
      setError('No valid prompts found');
      return;
    }

    setCreatingSuite(true);
    setError(null);

    try {
      const response = await fetch('/api/test-suites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          name: newSuiteName.trim(),
          prompts: prompts
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create test suite');
      }

      const data = await response.json();
      log.debug('BatchTesting', 'Test suite created', { id: data.testSuite.id });

      // Refresh test suites list
      await fetchTestSuites();

      // Select the new suite
      setSelectedTestSuiteId(data.testSuite.id);

      // Reset form
      setNewSuiteName('');
      setNewSuitePrompts('');
      setShowCreateSuite(false);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test suite');
    } finally {
      setCreatingSuite(false);
    }
  }

  function processFile(file: File) {
    // Check file type
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.json') && !file.name.endsWith('.jsonl')) {
      setError('Please upload a .txt, .json, or .jsonl file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;

      try {
        let prompts: string[] = [];

        if (file.name.endsWith('.json')) {
          // Parse JSON array
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            prompts = parsed.map(item => {
              if (typeof item === 'string') return item;
              if (item.prompt) return item.prompt;
              if (item.question) return item.question;
              if (item.text) return item.text;
              return JSON.stringify(item);
            });
          }
        } else if (file.name.endsWith('.jsonl')) {
          // Parse JSONL (one JSON object per line)
          prompts = content.split('\n')
            .filter(line => line.trim())
            .map(line => {
              try {
                const item = JSON.parse(line);
                if (typeof item === 'string') return item;
                if (item.prompt) return item.prompt;
                if (item.question) return item.question;
                if (item.text) return item.text;
                return JSON.stringify(item);
              } catch {
                return line; // If not valid JSON, use as plain text
              }
            });
        } else {
          // Plain text - one prompt per line
          prompts = content.split('\n').filter(line => line.trim());
        }

        // Set the prompts
        setNewSuitePrompts(prompts.join('\n'));

        // Auto-fill name from filename if empty
        if (!newSuiteName.trim()) {
          const nameWithoutExt = file.name.replace(/\.(txt|json|jsonl)$/, '');
          setNewSuiteName(nameWithoutExt);
        }

        log.debug('BatchTesting', 'File uploaded', {
          filename: file.name,
          promptCount: prompts.length
        });
      } catch (err) {
        setError('Failed to parse file. Please check the format.');
        log.error('BatchTesting', 'File parse error', { error: err });
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
    };

    reader.readAsText(file);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Reset file input so same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!creatingSuite) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (creatingSuite) return;

    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  async function handleStartTest() {
    if (!selectedModelId) {
      setError('Please select a model');
      return;
    }

    if (!selectedTestSuiteId) {
      setError('Please select a test suite');
      return;
    }

    log.debug('BatchTesting', 'Starting batch test', {
      modelId: selectedModelId,
      testSuiteId: selectedTestSuiteId,
      benchmarkId: selectedBenchmarkId || 'none'
    });
    setStarting(true);
    setError(null);

    try {
      // Prepare session tag if enabled
      let sessionTag = null;
      if (useSessionTag) {
        if (autoGenerateTag) {
          const generated = generateSessionTag(selectedModelId);
          sessionTag = {
            session_id: generated.sessionId,
            experiment_name: generated.experimentName
          };
        } else if (sessionId.trim()) {
          sessionTag = {
            session_id: sessionId.trim(),
            experiment_name: experimentName.trim() || undefined
          };
        }
      }

      // Prepare judge config if enabled
      let judgeConfig = null;
      if (useAssistantJudge && judgeCriteria.length > 0) {
        judgeConfig = {
          enabled: true,
          model: judgeModel,
          criteria: judgeCriteria
        };
      }

      log.debug('BatchTesting', 'Starting batch test with config', {
        modelId: selectedModelId,
        testSuiteId: selectedTestSuiteId,
        sessionTag,
        judgeConfig
      });

      const response = await fetch('/api/batch-testing/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          config: {
            model_id: selectedModelId,
            test_suite_id: selectedTestSuiteId,
            prompt_limit: promptLimit,
            concurrency: concurrency,
            delay_ms: delayMs,
            benchmark_id: selectedBenchmarkId || undefined,
            test_run_name: testRunName.trim() || undefined,
            session_tag: sessionTag,
            judge_config: judgeConfig
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
      const errorMessage = err instanceof Error ? err.message : String(err);
      log.error('BatchTesting', 'Error starting test', {
        error: errorMessage,
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(errorMessage || 'Failed to start batch test');
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


  // Helper function to get model name from model ID
  function getModelName(modelId: string): string {
    const model = models.find(m => m.id === modelId);
    return model?.name || modelId;
  }

  // Filter test runs by search and status
  function getFilteredTestRuns(): BatchTestRun[] {
    let filtered = testRuns;

    // Filter by search
    if (runSearch.trim()) {
      const search = runSearch.toLowerCase();
      filtered = filtered.filter(run => {
        const modelName = getModelName(run.model_name).toLowerCase();
        const customName = run.config?.custom_name?.toLowerCase() || '';
        return modelName.includes(search) || customName.includes(search);
      });
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
            Test any base model or fine-tuned variant with validation prompts to each model to compare responses and extract analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model-select">LLM Model</Label>
              <Select value={selectedModelId} onValueChange={setSelectedModelId} disabled={starting}>
                <SelectTrigger id="model-select">
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 z-10 bg-popover p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="model-search"
                        name="model-search-field"
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Search models or providers..."
                        className="pl-10 h-9"
                        autoComplete="off"
                        data-lpignore="true"
                        data-form-type="other"
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {Object.entries(groupedModels).map(([provider, providerModels]) => (
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
            <Label htmlFor="test-run-name">Test Run Name (Optional)</Label>
            <Input
              id="test-run-name"
              type="text"
              placeholder="e.g., GPT-4 Customer Support Test"
              value={testRunName}
              onChange={(e) => setTestRunName(e.target.value)}
              disabled={starting}
            />
            <p className="text-xs text-muted-foreground">
              Give this test run a custom name. If empty, a name will be auto-generated from model and test suite.
            </p>
          </div>

          {/* Session Tagging Section */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use-session-tag"
                checked={useSessionTag}
                onChange={(e) => setUseSessionTag(e.target.checked)}
                disabled={starting}
                className="rounded border-input"
              />
              <Label htmlFor="use-session-tag" className="font-medium cursor-pointer">
                Session Tagging for Analytics
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Tag this batch test with a session ID to track it in analytics and compare with other test runs
            </p>

            {useSessionTag && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-generate-tag"
                    checked={autoGenerateTag}
                    onChange={(e) => setAutoGenerateTag(e.target.checked)}
                    disabled={starting}
                    className="rounded border-input"
                  />
                  <Label htmlFor="auto-generate-tag" className="text-sm cursor-pointer">
                    Auto-generate session tag
                  </Label>
                </div>

                {!autoGenerateTag ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="session-id" className="text-sm">Session ID</Label>
                      <Input
                        id="session-id"
                        type="text"
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        placeholder="e.g., baseline-gpt4-test"
                        disabled={starting}
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="experiment-name" className="text-sm">Experiment Name (Optional)</Label>
                      <Input
                        id="experiment-name"
                        type="text"
                        value={experimentName}
                        onChange={(e) => setExperimentName(e.target.value)}
                        placeholder="e.g., model-comparison"
                        disabled={starting}
                        className="text-sm"
                      />
                    </div>
                  </>
                ) : (
                  selectedModelId && (
                    <div className="p-2 bg-background rounded border text-xs">
                      <p className="font-medium mb-1 text-muted-foreground">Preview (auto-generated):</p>
                      <p className="font-mono text-xs">
                        <strong>Session:</strong> {generateSessionTag(selectedModelId).sessionId}
                      </p>
                      <p className="font-mono text-xs">
                        <strong>Experiment:</strong> {generateSessionTag(selectedModelId).experimentName}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Assistant Judge Section */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use-assistant-judge"
                checked={useAssistantJudge}
                onChange={(e) => setUseAssistantJudge(e.target.checked)}
                disabled={starting}
                className="rounded border-input"
              />
              <Label htmlFor="use-assistant-judge" className="font-medium cursor-pointer">
                Assistant as Judge (LLM Evaluation)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically evaluate response quality using an LLM judge after each response
            </p>

            {useAssistantJudge && (
              <div className="space-y-3 pt-2">
                {/* Judge Model Selection */}
                <div className="space-y-2">
                  <Label htmlFor="judge-model" className="text-sm">Judge Model</Label>
                  <Select value={judgeModel} onValueChange={(v) => setJudgeModel(v as typeof judgeModel)} disabled={starting}>
                    <SelectTrigger id="judge-model" className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4.1">GPT-4.1 (Fast, ~$0.005/eval)</SelectItem>
                      <SelectItem value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Balanced, ~$0.008/eval)</SelectItem>
                      <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fastest/cheapest, ~$0.001/eval)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Criteria Selection */}
                <div className="space-y-2">
                  <Label className="text-sm">Evaluation Criteria</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['helpfulness', 'accuracy', 'clarity', 'safety', 'completeness'].map(criterion => (
                      <div key={criterion} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`criterion-${criterion}`}
                          checked={judgeCriteria.includes(criterion)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setJudgeCriteria([...judgeCriteria, criterion]);
                            } else {
                              setJudgeCriteria(judgeCriteria.filter(c => c !== criterion));
                            }
                          }}
                          disabled={starting}
                          className="rounded border-input"
                        />
                        <Label htmlFor={`criterion-${criterion}`} className="text-xs capitalize cursor-pointer">
                          {criterion}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cost Estimate */}
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <p className="font-medium text-yellow-800">Cost Estimate:</p>
                  <p className="text-yellow-700">
                    ~${getJudgeCostEstimate().toFixed(2)} for {promptLimit} prompts
                    ({judgeCriteria.length} {judgeCriteria.length === 1 ? 'criterion' : 'criteria'})
                  </p>
                  <p className="text-yellow-600 mt-1">
                    Judge evaluation happens in real-time after each response
                  </p>
                </div>
              </div>
            )}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="test-suite-select">Test Suite</Label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCreateSuite(!showCreateSuite)}
                disabled={starting}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Suite
              </Button>
            </div>

            {showCreateSuite && (
              <div className="p-4 border rounded-lg space-y-3 bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="new-suite-name">Suite Name</Label>
                  <Input
                    id="new-suite-name"
                    value={newSuiteName}
                    onChange={(e) => setNewSuiteName(e.target.value)}
                    placeholder="e.g., Customer Support Edge Cases"
                    disabled={creatingSuite}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prompts File</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.json,.jsonl"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <div
                    onClick={() => !creatingSuite && fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      creatingSuite ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-muted/50'
                    } ${isDragging ? 'border-primary bg-primary/10' : ''} ${
                      newSuitePrompts && !isDragging ? 'border-green-500 bg-green-50' : ''
                    } ${!newSuitePrompts && !isDragging ? 'border-muted-foreground/25' : ''}`}
                  >
                    {isDragging ? (
                      <div className="space-y-1">
                        <Upload className="h-8 w-8 mx-auto text-primary animate-bounce" />
                        <p className="font-medium text-primary">Drop file here</p>
                      </div>
                    ) : newSuitePrompts ? (
                      <div className="space-y-1">
                        <FileText className="h-8 w-8 mx-auto text-green-600" />
                        <p className="font-medium text-green-700">
                          {newSuitePrompts.split('\n').filter(p => p.trim()).length} prompts loaded
                        </p>
                        <p className="text-xs text-muted-foreground">Click or drag to replace</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="font-medium">Drag & drop or click to upload</p>
                        <p className="text-xs text-muted-foreground">.txt, .json, or .jsonl</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateTestSuite}
                    disabled={creatingSuite || !newSuiteName.trim() || !newSuitePrompts.trim()}
                    size="sm"
                  >
                    {creatingSuite ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Create Suite
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateSuite(false)}
                    disabled={creatingSuite}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <Select value={selectedTestSuiteId} onValueChange={setSelectedTestSuiteId} disabled={starting}>
              <SelectTrigger id="test-suite-select">
                <SelectValue placeholder="Select a test suite..." />
              </SelectTrigger>
              <SelectContent>
                {testSuites.map(suite => (
                  <SelectItem key={suite.id} value={suite.id}>
                    {suite.name} ({suite.prompt_count} prompts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select a test suite containing prompts for evaluation (separate from training data)
            </p>
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
            disabled={!selectedModelId || !selectedTestSuiteId || starting}
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
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'completed' | 'failed' | 'running')}>
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
                <Select value={displayLimit.toString()} onValueChange={(v) => setDisplayLimit(parseInt(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Show 10</SelectItem>
                    <SelectItem value="25">Show 25</SelectItem>
                    <SelectItem value="50">Show 50</SelectItem>
                    <SelectItem value="100">Show 100</SelectItem>
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
                <div className="space-y-2">
                  {getFilteredTestRuns().map(run => {
                    return (
                      <div
                        key={run.id}
                        className={`p-3 border rounded-md space-y-2 transition-colors ${
                          selectedRunIds.includes(run.id) ? 'bg-accent border-accent' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedRunIds.includes(run.id)}
                            onChange={() => toggleSelectRun(run.id)}
                            className="rounded border-input flex-shrink-0"
                          />
                          <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-sm">{run.config?.custom_name || getModelName(run.model_name)}</h4>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(run.started_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {run.status === 'running' && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                              )}
                              {run.status === 'completed' && (
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                              )}
                              {run.status === 'failed' && (
                                <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                              )}
                              <span className="text-xs font-medium capitalize">{run.status}</span>
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

                        <div className="space-y-1.5 pl-8">
                          <div className="flex justify-between text-xs">
                            <span>Progress: {run.completed_prompts} / {run.total_prompts}</span>
                            <span>{Math.round((run.completed_prompts / run.total_prompts) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-gray-700 h-1.5 rounded-full transition-all"
                              style={{ width: `${(run.completed_prompts / run.total_prompts) * 100}%` }}
                            />
                          </div>
                          {run.failed_prompts > 0 && (
                            <p className="text-xs text-red-600">
                              {run.failed_prompts} prompts failed
                            </p>
                          )}
                          {run.error && (
                            <p className="text-xs text-red-600">Error: {run.error}</p>
                          )}
                        </div>
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
