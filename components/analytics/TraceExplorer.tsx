'use client';

/**
 * TraceExplorer Component
 * 
 * Dedicated page for browsing and debugging LLM traces
 * Provides filtering, search, and detailed trace visualization
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import TraceView, { type Trace } from './TraceView';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Filter, RefreshCw, Clock, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronRight, Zap, DollarSign, TrendingUp } from 'lucide-react';

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

export function TraceExplorer() {
  const { session } = useAuth();
  const [traces, setTraces] = useState<TraceListItem[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [detailedTrace, setDetailedTrace] = useState<Trace[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [operationFilter, setOperationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('7d');
  
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
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch traces list
  const fetchTraces = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

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
      
      // Apply client-side advanced filters
      let filteredTraces = data.traces || [];
      
      if (minCost !== null) {
        filteredTraces = filteredTraces.filter((t: TraceListItem) => 
          t.cost_usd != null && t.cost_usd >= minCost
        );
      }
      if (maxCost !== null) {
        filteredTraces = filteredTraces.filter((t: TraceListItem) => 
          t.cost_usd != null && t.cost_usd <= maxCost
        );
      }
      if (minDuration !== null) {
        filteredTraces = filteredTraces.filter((t: TraceListItem) => 
          t.duration_ms != null && t.duration_ms >= minDuration
        );
      }
      if (maxDuration !== null) {
        filteredTraces = filteredTraces.filter((t: TraceListItem) => 
          t.duration_ms != null && t.duration_ms <= maxDuration
        );
      }
      if (minThroughput !== null) {
        filteredTraces = filteredTraces.filter((t: TraceListItem) => 
          t.tokens_per_second != null && t.tokens_per_second >= minThroughput
        );
      }
      if (maxThroughput !== null) {
        filteredTraces = filteredTraces.filter((t: TraceListItem) => 
          t.tokens_per_second != null && t.tokens_per_second <= maxThroughput
        );
      }
      if (hasError !== null) {
        filteredTraces = filteredTraces.filter((t: TraceListItem) => 
          hasError ? (t.status === 'failed' || t.error_message) : (t.status !== 'failed' && !t.error_message)
        );
      }
      if (hasQualityScore !== null) {
        filteredTraces = filteredTraces.filter((t: TraceListItem) => 
          hasQualityScore ? t.quality_score != null : t.quality_score == null
        );
      }
      if (minQualityScore !== null) {
        filteredTraces = filteredTraces.filter((t: TraceListItem) => 
          t.quality_score != null && t.quality_score >= minQualityScore
        );
      }
      
      setTraces(filteredTraces);
      setTotalCount(filteredTraces.length);
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

  useEffect(() => {
    fetchTraces();
  }, [session, page, timeRange, operationFilter, statusFilter, minCost, maxCost, minDuration, maxDuration, minThroughput, maxThroughput, hasError, hasQualityScore, minQualityScore]);

  const handleSearch = () => {
    setPage(1);
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
      <div>
        <h1 className="text-3xl font-bold">Trace Explorer</h1>
        <p className="text-muted-foreground mt-1">
          Browse and debug LLM operation traces
        </p>
      </div>

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
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
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
                <Card key={trace.id} className="overflow-hidden hover:shadow-md transition-all border-l-4" style={{ borderLeftColor: getStatusColor(trace.status) }}>
                  <CardContent className="p-0">
                    <div
                      onClick={() => handleTraceClick(trace.trace_id)}
                      className="w-full cursor-pointer hover:bg-muted/5 transition-colors"
                    >
                      <div className="flex items-center p-4 gap-4">
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
    </div>
  );
}
