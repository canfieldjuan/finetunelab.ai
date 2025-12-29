'use client';

/**
 * TraceExplorer Component
 * 
 * Dedicated page for browsing and debugging LLM traces
 * Provides filtering, search, and detailed trace visualization
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import TraceView, { type Trace } from './TraceView';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Filter, RefreshCw, Clock, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronRight, Zap, DollarSign, TrendingUp, Radio, Share2, Save, BookmarkPlus, GitCompare } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface TraceListItem {
  id: string;
  trace_id: string;
  span_name: string;
  operation_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  start_time: string;
  duration_ms?: number;
  model_name?: string;
  model_provider?: string;
  conversation_id?: string;
  message_id?: string;
  session_tag?: string;
  environment?: string;
  error_message?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  ttft_ms?: number;
  tokens_per_second?: number;
  quality_score?: number;
  user_rating?: number;
  passed_validations?: number;
  total_validations?: number;
  has_user_feedback?: boolean;
}

interface SavedPreset {
  id: string;
  name: string;
  filters: {
    searchQuery?: string;
    operationFilter?: string;
    statusFilter?: string;
    timeRange?: string;
    minCost?: number | null;
    maxCost?: number | null;
    minDuration?: number | null;
    maxDuration?: number | null;
    minThroughput?: number | null;
    maxThroughput?: number | null;
  };
}

export function TraceExplorer() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [traces, setTraces] = useState<TraceListItem[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [detailedTrace, setDetailedTrace] = useState<Trace[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live streaming state
  const [liveStreaming, setLiveStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [newTraceCount, setNewTraceCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Advanced features
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [operationFilter, setOperationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('30d');
  
  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minCost, setMinCost] = useState<number | null>(null);
  const [maxCost, setMaxCost] = useState<number | null>(null);
  const [minDuration, setMinDuration] = useState<number | null>(null);
  const [maxDuration, setMaxDuration] = useState<number | null>(null);
  const [minThroughput, setMinThroughput] = useState<number | null>(null);
  const [maxThroughput, setMaxThroughput] = useState<number | null>(null);
  const [hasError, setHasError] = useState<boolean | null>(null);
  const [hasQualityScore, setHasQualityScore] = useState<boolean | null>(null);
  const [minQualityScore, setMinQualityScore] = useState<number | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch traces list
  const fetchTraces = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);
    setNewTraceCount(0); // Reset counter when fetching traces

    try {
      // Calculate start date based on time range
      const now = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case '1h':
          startDate.setHours(now.getHours() - 1);
          break;
        case '24h':
          startDate.setDate(now.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
      }

      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
        start_date: startDate.toISOString(),
      });

      if (operationFilter !== 'all') params.append('operation_type', operationFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      // Add advanced filters to API request (server-side filtering)
      if (minCost !== null) params.append('min_cost', minCost.toString());
      if (maxCost !== null) params.append('max_cost', maxCost.toString());
      if (minDuration !== null) params.append('min_duration', minDuration.toString());
      if (maxDuration !== null) params.append('max_duration', maxDuration.toString());
      if (minThroughput !== null) params.append('min_throughput', minThroughput.toString());
      if (maxThroughput !== null) params.append('max_throughput', maxThroughput.toString());
      if (hasError !== null) params.append('has_error', hasError.toString());
      if (hasQualityScore !== null) params.append('has_quality_score', hasQualityScore.toString());
      if (minQualityScore !== null) params.append('min_quality_score', minQualityScore.toString());

      const response = await fetch(`/api/analytics/traces/list?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[TraceExplorer] API error:', response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch traces (${response.status})`);
      }

      const data = await response.json();
      console.log('[TraceExplorer] Received data:', {
        tracesCount: data.traces?.length || 0,
        total: data.total,
        sampleTrace: data.traces?.[0]
      });
      
      // Map metadata to top-level fields
      const mappedTraces = (data.traces || []).map((t: unknown) => ({
        ...t,
        session_tag: t.metadata?.tags?.[0] || t.metadata?.session_id,
        environment: t.metadata?.environment
      }));

      // Filters are now applied server-side for better performance
      // The API returns already-filtered traces with correct pagination count
      setTraces(mappedTraces);
      setTotalCount(data.total);
    } catch (err) {
      console.error('[TraceExplorer] Error fetching traces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load traces');
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed trace
  const fetchTraceDetails = async (traceId: string) => {
    if (!session?.access_token) return;

    setDetailLoading(true);

    try {
      const response = await fetch(`/api/analytics/traces?trace_id=${traceId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch trace details');

      const data = await response.json();
      console.log('[TraceExplorer] Trace details response:', {
        success: data.success,
        dataType: Array.isArray(data.data) ? 'array' : typeof data.data,
        dataLength: data.data?.length,
        firstTrace: data.data?.[0],
        fullData: data
      });
      setDetailedTrace(data.data || []);
    } catch (err) {
      console.error('[TraceExplorer] Error fetching trace details:', err);
      setDetailedTrace(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Sync filters to URL for sharing
  const syncFiltersToURL = () => {
    const params = new URLSearchParams();

    if (searchQuery) params.set('search', searchQuery);
    if (operationFilter !== 'all') params.set('operation', operationFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (timeRange !== '30d') params.set('time', timeRange);
    if (minCost !== null) params.set('minCost', minCost.toString());
    if (maxCost !== null) params.set('maxCost', maxCost.toString());
    if (minDuration !== null) params.set('minDuration', minDuration.toString());
    if (maxDuration !== null) params.set('maxDuration', maxDuration.toString());
    if (minThroughput !== null) params.set('minThroughput', minThroughput.toString());
    if (maxThroughput !== null) params.set('maxThroughput', maxThroughput.toString());

    const newURL = `${pathname}?${params.toString()}`;
    router.push(newURL, { scroll: false });
  };

  // Copy shareable URL to clipboard
  const shareFilters = async () => {
    syncFiltersToURL();
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      alert('Filter URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  // Save current filters as a preset
  const savePreset = () => {
    if (!presetName.trim()) return;

    const newPreset: SavedPreset = {
      id: Date.now().toString(),
      name: presetName,
      filters: {
        searchQuery,
        operationFilter,
        statusFilter,
        timeRange,
        minCost,
        maxCost,
        minDuration,
        maxDuration,
        minThroughput,
        maxThroughput,
      }
    };

    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem('trace-filter-presets', JSON.stringify(updated));
    setPresetName('');
    setShowSavePreset(false);
  };

  // Load a saved preset
  const loadPreset = (preset: SavedPreset) => {
    if (preset.filters.searchQuery !== undefined) setSearchQuery(preset.filters.searchQuery);
    if (preset.filters.operationFilter) setOperationFilter(preset.filters.operationFilter);
    if (preset.filters.statusFilter) setStatusFilter(preset.filters.statusFilter);
    if (preset.filters.timeRange) setTimeRange(preset.filters.timeRange as '1h' | '24h' | '7d' | '30d');
    if (preset.filters.minCost !== undefined) setMinCost(preset.filters.minCost);
    if (preset.filters.maxCost !== undefined) setMaxCost(preset.filters.maxCost);
    if (preset.filters.minDuration !== undefined) setMinDuration(preset.filters.minDuration);
    if (preset.filters.maxDuration !== undefined) setMaxDuration(preset.filters.maxDuration);
    if (preset.filters.minThroughput !== undefined) setMinThroughput(preset.filters.minThroughput);
    if (preset.filters.maxThroughput !== undefined) setMaxThroughput(preset.filters.maxThroughput);
  };

  // Delete a preset
  const deletePreset = (id: string) => {
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    localStorage.setItem('trace-filter-presets', JSON.stringify(updated));
  };

  // Toggle trace for comparison
  const toggleTraceComparison = (traceId: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(traceId)) {
        return prev.filter(id => id !== traceId);
      } else if (prev.length < 3) {
        // Max 3 traces for comparison
        return [...prev, traceId];
      }
      return prev;
    });
  };

  // Load presets from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('trace-filter-presets');
    if (stored) {
      try {
        setSavedPresets(JSON.parse(stored));
      } catch (err) {
        console.error('[TraceExplorer] Failed to parse saved presets:', err);
      }
    }
  }, []);

  // Load filters from URL on mount
  useEffect(() => {
    if (!searchParams) return;

    const search = searchParams.get('search');
    const operation = searchParams.get('operation');
    const status = searchParams.get('status');
    const time = searchParams.get('time');
    const minCostParam = searchParams.get('minCost');
    const maxCostParam = searchParams.get('maxCost');
    const minDurationParam = searchParams.get('minDuration');
    const maxDurationParam = searchParams.get('maxDuration');
    const minThroughputParam = searchParams.get('minThroughput');
    const maxThroughputParam = searchParams.get('maxThroughput');

    if (search) setSearchQuery(search);
    if (operation) setOperationFilter(operation);
    if (status) setStatusFilter(status);
    if (time) setTimeRange(time as '1h' | '24h' | '7d' | '30d');
    if (minCostParam) setMinCost(parseFloat(minCostParam));
    if (maxCostParam) setMaxCost(parseFloat(maxCostParam));
    if (minDurationParam) setMinDuration(parseInt(minDurationParam));
    if (maxDurationParam) setMaxDuration(parseInt(maxDurationParam));
    if (minThroughputParam) setMinThroughput(parseFloat(minThroughputParam));
    if (maxThroughputParam) setMaxThroughput(parseFloat(maxThroughputParam));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    fetchTraces();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, page, timeRange, operationFilter, statusFilter, minCost, maxCost, minDuration, maxDuration, minThroughput, maxThroughput, hasError, hasQualityScore, minQualityScore]);

  // Auto-expand trace from URL params (e.g., from anomaly navigation)
  useEffect(() => {
    if (!searchParams) return;
    const traceIdFromUrl = searchParams.get('trace_id');
    if (traceIdFromUrl && !loading && traces.length > 0) {
      console.log('[TraceExplorer] Auto-expanding trace from URL:', traceIdFromUrl);

      // Check if trace exists in the list
      const traceExists = traces.some(t => t.trace_id === traceIdFromUrl);

      if (traceExists) {
        // Auto-select and expand the trace
        setSelectedTraceId(traceIdFromUrl);
        fetchTraceDetails(traceIdFromUrl);

        // Scroll to the trace card after a short delay to ensure it's rendered
        setTimeout(() => {
          const traceElement = document.querySelector(`[data-trace-id="${traceIdFromUrl}"]`);
          if (traceElement) {
            traceElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      } else {
        console.warn('[TraceExplorer] Trace not found in current filter results:', traceIdFromUrl);
        // Could potentially fetch the specific trace or adjust filters here
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, traces]);

  // Live streaming via SSE
  useEffect(() => {
    if (!liveStreaming || !session?.access_token) {
      // Disconnect if streaming is disabled
      if (eventSourceRef.current) {
        console.log('[TraceExplorer] Disconnecting SSE stream');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setStreamStatus('disconnected');
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    const connectStream = () => {
      if (eventSourceRef.current) {
        return; // Already connected
      }

      console.log('[TraceExplorer] Connecting to SSE stream...');
      setStreamStatus('connecting');

      // Pass auth token as query param (EventSource doesn't support headers)
      const streamUrl = `/api/analytics/traces/stream?token=${encodeURIComponent(session.access_token)}`;
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[TraceExplorer] SSE stream connected');
        setStreamStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[TraceExplorer] SSE message received:', data.type);

          if (data.type === 'trace') {
            // New trace received - increment counter and refresh
            console.log('[TraceExplorer] New trace detected, refreshing list');
            setNewTraceCount(prev => prev + 1);
            fetchTraces();
          } else if (data.type === 'trace_update') {
            // Trace updated - refresh if it's in the current view
            console.log('[TraceExplorer] Trace updated, refreshing list');
            fetchTraces();
          } else if (data.type === 'connected' || data.type === 'subscribed') {
            console.log('[TraceExplorer] Stream status:', data.message);
          } else if (data.type === 'ping') {
            // Keep-alive ping, no action needed
          } else if (data.type === 'error') {
            console.error('[TraceExplorer] Stream error:', data.message);
            setError(data.message);
          }
        } catch (error) {
          console.error('[TraceExplorer] Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[TraceExplorer] SSE error:', error);
        setStreamStatus('error');

        // Close and cleanup
        eventSource.close();
        eventSourceRef.current = null;

        // Auto-reconnect with exponential backoff
        const attempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempt;
        const delay = Math.min(30000, attempt * 2000); // Max 30s delay

        console.log(`[TraceExplorer] Reconnecting in ${delay}ms (attempt ${attempt})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connectStream();
        }, delay);
      };
    };

    connectStream();

    // Cleanup on unmount or streaming toggle
    return () => {
      if (eventSourceRef.current) {
        console.log('[TraceExplorer] Cleaning up SSE connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveStreaming, session]);

  // Toggle live streaming
  const toggleLiveStreaming = () => {
    setLiveStreaming(prev => {
      if (!prev) {
        // Starting streaming - reset counter
        setNewTraceCount(0);
      }
      return !prev;
    });
  };

  const handleSearch = () => {
    setPage(1);
    setNewTraceCount(0); // Reset counter when manually searching
    fetchTraces();
  };

  const clearAdvancedFilters = () => {
    setMinCost(null);
    setMaxCost(null);
    setMinDuration(null);
    setMaxDuration(null);
    setMinThroughput(null);
    setMaxThroughput(null);
    setHasError(null);
    setHasQualityScore(null);
    setMinQualityScore(null);
  };

  const applyFilterPreset = (preset: string) => {
    clearAdvancedFilters();
    switch (preset) {
      case 'errors':
        setHasError(true);
        setStatusFilter('failed');
        break;
      case 'slow':
        setMinDuration(5000); // > 5 seconds
        break;
      case 'expensive':
        setMinCost(0.01); // > $0.01
        break;
      case 'fast':
        setMaxDuration(1000); // < 1 second
        setMinThroughput(50); // > 50 tok/s
        break;
      case 'quality':
        setHasQualityScore(true);
        setMinQualityScore(0.8); // > 80%
        break;
    }
  };

  const handleTraceClick = (traceId: string) => {
    if (selectedTraceId === traceId) {
      setSelectedTraceId(null);
      setDetailedTrace(null);
    } else {
      setSelectedTraceId(traceId);
      fetchTraceDetails(traceId);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e'; // green-500
      case 'failed': return '#ef4444'; // red-500
      case 'running': return '#3b82f6'; // blue-500
      default: return '#9ca3af'; // gray-400
    }
  };

  const getOperationColor = (type: string) => {
    const colors: Record<string, string> = {
      llm_call: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      tool_call: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      embedding: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      retrieval: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trace Explorer</h1>
          <p className="text-muted-foreground mt-1">
            Browse and debug LLM operation traces
          </p>
        </div>

        {/* Live Streaming & Tools */}
        <div className="flex items-center gap-2">
          {/* Comparison Mode Toggle */}
          <Button
            variant={comparisonMode ? "default" : "outline"}
            size="sm"
            onClick={() => setComparisonMode(!comparisonMode)}
            className="flex items-center gap-2"
          >
            <GitCompare className="h-4 w-4" />
            {comparisonMode ? `Compare (${selectedForComparison.length}/3)` : 'Compare'}
          </Button>

          {/* Share Filters */}
          <Button
            variant="outline"
            size="sm"
            onClick={shareFilters}
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>

          {/* Save Preset */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSavePreset(true)}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>

          {/* Live Streaming Toggle */}
          <Button
            variant={liveStreaming ? "default" : "outline"}
            size="sm"
            onClick={toggleLiveStreaming}
            className="flex items-center gap-2"
          >
            <Radio className={`h-4 w-4 ${streamStatus === 'connected' ? 'animate-pulse text-green-400' : ''}`} />
            {liveStreaming ? 'Live' : 'Start Live'}
          </Button>

          {liveStreaming && (
            <>
              <Badge
                variant={
                  streamStatus === 'connected' ? 'default' :
                  streamStatus === 'connecting' ? 'secondary' :
                  streamStatus === 'error' ? 'destructive' :
                  'outline'
                }
                className="flex items-center gap-1"
              >
                <span className={`h-2 w-2 rounded-full ${
                  streamStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                  streamStatus === 'connecting' ? 'bg-yellow-500' :
                  streamStatus === 'error' ? 'bg-red-500' :
                  'bg-gray-400'
                }`} />
                {streamStatus === 'connected' ? 'Connected' :
                 streamStatus === 'connecting' ? 'Connecting...' :
                 streamStatus === 'error' ? 'Error' :
                 'Disconnected'}
              </Badge>

              {newTraceCount > 0 && (
                <Badge variant="secondary" className="animate-pulse">
                  +{newTraceCount} new
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {/* Save Preset Modal */}
      {showSavePreset && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowSavePreset(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Save Filter Preset</CardTitle>
              <CardDescription>Save current filters for quick access later</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Preset Name</label>
                <Input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., Slow Production Traces"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowSavePreset(false)}>Cancel</Button>
                <Button onClick={savePreset} disabled={!presetName.trim()}>Save Preset</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Saved Presets */}
      {savedPresets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookmarkPlus className="h-5 w-5" />
              Saved Presets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {savedPresets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-md">
                  <button
                    onClick={() => loadPreset(preset)}
                    className="text-sm font-medium hover:text-primary"
                  >
                    {preset.name}
                  </button>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="ml-2 text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              {showAdvancedFilters ? 'Hide' : 'Show'} Advanced
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Filter Presets */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Quick Filters</label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={hasError === true ? "secondary" : "outline"}
                size="sm"
                onClick={() => applyFilterPreset('errors')}
                className={`gap-2 ${hasError === true ? "border-red-200 bg-red-50 hover:bg-red-100 text-red-700" : ""}`}
              >
                <AlertCircle className={`h-4 w-4 ${hasError === true ? "text-red-600" : "text-red-500"}`} />
                Errors Only
              </Button>
              <Button
                variant={minDuration === 5000 ? "secondary" : "outline"}
                size="sm"
                onClick={() => applyFilterPreset('slow')}
                className={`gap-2 ${minDuration === 5000 ? "border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700" : ""}`}
              >
                <Clock className={`h-4 w-4 ${minDuration === 5000 ? "text-orange-600" : "text-orange-500"}`} />
                Slow Traces
              </Button>
              <Button
                variant={minCost === 0.01 ? "secondary" : "outline"}
                size="sm"
                onClick={() => applyFilterPreset('expensive')}
                className={`gap-2 ${minCost === 0.01 ? "border-green-200 bg-green-50 hover:bg-green-100 text-green-700" : ""}`}
              >
                <DollarSign className={`h-4 w-4 ${minCost === 0.01 ? "text-green-600" : "text-green-500"}`} />
                Expensive
              </Button>
              <Button
                variant={maxDuration === 1000 && minThroughput === 50 ? "secondary" : "outline"}
                size="sm"
                onClick={() => applyFilterPreset('fast')}
                className={`gap-2 ${maxDuration === 1000 && minThroughput === 50 ? "border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700" : ""}`}
              >
                <Zap className={`h-4 w-4 ${maxDuration === 1000 && minThroughput === 50 ? "text-blue-600" : "text-blue-500"}`} />
                Fast & Efficient
              </Button>
              <Button
                variant={hasQualityScore === true && minQualityScore === 0.8 ? "secondary" : "outline"}
                size="sm"
                onClick={() => applyFilterPreset('quality')}
                className={`gap-2 ${hasQualityScore === true && minQualityScore === 0.8 ? "border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700" : ""}`}
              >
                <CheckCircle className={`h-4 w-4 ${hasQualityScore === true && minQualityScore === 0.8 ? "text-purple-600" : "text-purple-500"}`} />
                High Quality
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearAdvancedFilters();
                  setOperationFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
              >
                Clear All
              </Button>
            </div>
          </div>

          {/* Basic Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by session tag, trace ID, model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Time Range */}
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as unknown)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            {/* Operation Type */}
            <Select value={operationFilter} onValueChange={setOperationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Operation Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operations</SelectItem>
                <SelectItem value="llm_call">LLM Calls</SelectItem>
                <SelectItem value="tool_call">Tool Calls</SelectItem>
                <SelectItem value="embedding">Embeddings</SelectItem>
                <SelectItem value="retrieval">Retrievals</SelectItem>
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="pt-4 border-t space-y-4">
              <h4 className="text-sm font-semibold">Advanced Filters</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Cost Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cost Range ($)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minCost ?? ''}
                      onChange={(e) => setMinCost(e.target.value ? parseFloat(e.target.value) : null)}
                      step="0.000001"
                      min="0"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxCost ?? ''}
                      onChange={(e) => setMaxCost(e.target.value ? parseFloat(e.target.value) : null)}
                      step="0.000001"
                      min="0"
                    />
                  </div>
                </div>

                {/* Duration Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration Range (ms)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minDuration ?? ''}
                      onChange={(e) => setMinDuration(e.target.value ? parseInt(e.target.value) : null)}
                      step="100"
                      min="0"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxDuration ?? ''}
                      onChange={(e) => setMaxDuration(e.target.value ? parseInt(e.target.value) : null)}
                      step="100"
                      min="0"
                    />
                  </div>
                </div>

                {/* Throughput Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Throughput (tok/s)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minThroughput ?? ''}
                      onChange={(e) => setMinThroughput(e.target.value ? parseFloat(e.target.value) : null)}
                      step="1"
                      min="0"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxThroughput ?? ''}
                      onChange={(e) => setMaxThroughput(e.target.value ? parseFloat(e.target.value) : null)}
                      step="1"
                      min="0"
                    />
                  </div>
                </div>

                {/* Quality Score */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Min Quality Score (%)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 80"
                    value={minQualityScore !== null ? minQualityScore * 100 : ''}
                    onChange={(e) => setMinQualityScore(e.target.value ? parseFloat(e.target.value) / 100 : null)}
                    step="1"
                    min="0"
                    max="100"
                  />
                </div>

                {/* Error Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Error Status</label>
                  <Select 
                    value={hasError === null ? 'all' : hasError ? 'true' : 'false'} 
                    onValueChange={(v) => setHasError(v === 'all' ? null : v === 'true')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">Errors Only</SelectItem>
                      <SelectItem value="false">No Errors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quality Score Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Has Quality Score</label>
                  <Select 
                    value={hasQualityScore === null ? 'all' : hasQualityScore ? 'true' : 'false'} 
                    onValueChange={(v) => setHasQualityScore(v === 'all' ? null : v === 'true')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">With Score</SelectItem>
                      <SelectItem value="false">Without Score</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              {totalCount} traces found
            </p>
            <Button onClick={() => fetchTraces()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Traces List */}
      <Card>
        <CardHeader>
          <CardTitle>Traces</CardTitle>
          <CardDescription>
            Click on a trace to view detailed execution timeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : traces.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No traces found</p>
              <p className="text-sm mt-2">Try adjusting your filters or time range</p>
            </div>
          ) : (
            <div className="space-y-4">
              {traces.map((trace) => (
                <Card key={trace.id} className="overflow-hidden hover:shadow-md transition-all border-l-4" style={{ borderLeftColor: getStatusColor(trace.status) }} data-trace-id={trace.trace_id}>
                  <CardContent className="p-0">
                    <div
                      onClick={() => !comparisonMode && handleTraceClick(trace.trace_id)}
                      className="w-full cursor-pointer hover:bg-muted/5 transition-colors"
                    >
                      <div className="flex items-center p-4 gap-4">
                        {/* Comparison Checkbox */}
                        {comparisonMode && (
                          <input
                            type="checkbox"
                            checked={selectedForComparison.includes(trace.trace_id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleTraceComparison(trace.trace_id);
                            }}
                            className="h-4 w-4"
                            disabled={!selectedForComparison.includes(trace.trace_id) && selectedForComparison.length >= 3}
                          />
                        )}

                        {/* Status & Expand Icon */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                           {selectedTraceId === trace.trace_id ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                           {getStatusIcon(trace.status)}
                        </div>

                        {/* Main Info */}
                        <div className="flex-1 min-w-0 grid gap-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{trace.span_name}</h3>
                            <Badge variant="secondary" className={`text-xs px-1.5 py-0 h-5 ${getOperationColor(trace.operation_type)}`}>
                                  {trace.operation_type}
                            </Badge>
                            {trace.environment && (
                               <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 uppercase ${
                                  trace.environment.toLowerCase() === 'production' 
                                    ? 'bg-green-50 text-green-700 border-green-200' 
                                    : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                               }`}>
                                  {trace.environment}
                               </Badge>
                            )}
                            {trace.error_message && (
                                  <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5">Error</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatTimestamp(trace.start_time)}</span>
                            <span>•</span>
                            <span className="font-mono">{trace.trace_id.slice(0, 8)}</span>
                            {trace.model_name && (
                              <>
                                <span>•</span>
                                <span>{trace.model_name}</span>
                              </>
                            )}
                            {trace.session_tag && (
                                <>
                                  <span>•</span>
                                  <span className="font-medium text-primary">{trace.session_tag}</span>
                                </>
                            )}
                          </div>
                        </div>

                        {/* Metrics - Compact Row */}
                        <div className="flex items-center gap-6 text-sm text-muted-foreground flex-shrink-0">
                           {/* Duration */}
                           <div className="flex flex-col items-end w-20">
                              <span className="text-xs opacity-70">Duration</span>
                              <span className="font-medium text-foreground">{formatDuration(trace.duration_ms)}</span>
                           </div>

                           {/* Tokens */}
                           {trace.total_tokens ? (
                             <div className="flex flex-col items-end w-24">
                                <span className="text-xs opacity-70">Tokens</span>
                                <span className="font-medium text-foreground">{trace.total_tokens.toLocaleString()}</span>
                             </div>
                           ) : <div className="w-24" />}

                           {/* Cost */}
                           {trace.cost_usd != null ? (
                             <div className="flex flex-col items-end w-20">
                                <span className="text-xs opacity-70">Cost</span>
                                <span className="font-medium text-foreground">${trace.cost_usd.toFixed(5)}</span>
                             </div>
                           ) : <div className="w-20" />}
                           
                           {/* Quality/Score (Optional) */}
                           {(trace.quality_score != null || trace.user_rating != null) && (
                              <div className="flex flex-col items-end w-16">
                                <span className="text-xs opacity-70">Score</span>
                                <span className={`font-medium ${trace.quality_score && trace.quality_score > 0.7 ? 'text-green-600' : 'text-foreground'}`}>
                                  {trace.quality_score ? `${(trace.quality_score * 100).toFixed(0)}%` : trace.user_rating ? `${trace.user_rating}/5` : '-'}
                                </span>
                              </div>
                           )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Trace Details */}
                    {selectedTraceId === trace.trace_id && (
                      <div className="border-t bg-muted/10">
                        <div className="p-4">
                          {detailLoading ? (
                            <div className="flex items-center gap-2 py-8 text-muted-foreground justify-center">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Loading trace details...</span>
                            </div>
                          ) : detailedTrace && detailedTrace.length > 0 ? (
                            <TraceView traces={detailedTrace} />
                          ) : (
                            <p className="py-8 text-center text-muted-foreground">No trace details available</p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(totalCount / pageSize)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(totalCount / pageSize)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison View */}
      {comparisonMode && selectedForComparison.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Trace Comparison ({selectedForComparison.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedForComparison([])}
              >
                Clear Selection
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedForComparison.map(traceId => {
                const trace = traces.find(t => t.trace_id === traceId);
                if (!trace) return null;

                return (
                  <div key={traceId} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-sm">{trace.span_name}</h4>
                        <p className="text-xs text-muted-foreground font-mono">{trace.trace_id.slice(0, 8)}</p>
                      </div>
                      <Badge variant="secondary" className={`text-xs ${getOperationColor(trace.operation_type)}`}>
                        {trace.operation_type}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Duration:</span>
                        <div className="font-medium">{formatDuration(trace.duration_ms)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(trace.status)}
                          <span className="capitalize">{trace.status}</span>
                        </div>
                      </div>
                      {trace.total_tokens && (
                        <div>
                          <span className="text-muted-foreground">Tokens:</span>
                          <div className="font-medium">{trace.total_tokens.toLocaleString()}</div>
                        </div>
                      )}
                      {trace.cost_usd && (
                        <div>
                          <span className="text-muted-foreground">Cost:</span>
                          <div className="font-medium">${trace.cost_usd.toFixed(5)}</div>
                        </div>
                      )}
                      {trace.ttft_ms && (
                        <div>
                          <span className="text-muted-foreground">TTFT:</span>
                          <div className="font-medium">{trace.ttft_ms}ms</div>
                        </div>
                      )}
                      {trace.tokens_per_second && (
                        <div>
                          <span className="text-muted-foreground">Speed:</span>
                          <div className="font-medium">{trace.tokens_per_second.toFixed(1)} t/s</div>
                        </div>
                      )}
                    </div>

                    {trace.model_name && (
                      <div className="pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Model: </span>
                        <span className="text-xs font-medium">{trace.model_name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
