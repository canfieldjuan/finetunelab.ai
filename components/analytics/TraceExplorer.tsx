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
import { Search, Filter, RefreshCw, Clock, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('7d'); // Changed default from 24h to 7d

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
      setTraces(data.traces || []);
      setTotalCount(data.total || 0);
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
      setDetailedTrace(data.traces || []);
    } catch (err) {
      console.error('[TraceExplorer] Error fetching trace details:', err);
      setDetailedTrace(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchTraces();
  }, [session, page, timeRange, operationFilter, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchTraces();
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
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
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

          <div className="flex items-center justify-between mt-4">
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
            <div className="space-y-2">
              {traces.map((trace) => (
                <div key={trace.id}>
                  <button
                    onClick={() => handleTraceClick(trace.trace_id)}
                    className="w-full text-left p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {selectedTraceId === trace.trace_id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        {getStatusIcon(trace.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{trace.span_name}</span>
                            <Badge variant="outline" className={getOperationColor(trace.operation_type)}>
                              {trace.operation_type}
                            </Badge>
                            {trace.model_name && (
                              <Badge variant="secondary" className="text-xs">
                                {trace.model_name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            {trace.session_tag && (
                              <span className="font-mono font-semibold text-primary">
                                📋 {trace.session_tag}
                              </span>
                            )}
                            <span className="font-mono text-xs">{trace.trace_id.slice(0, 12)}...</span>
                            <span>{formatTimestamp(trace.start_time)}</span>
                            <span>{formatDuration(trace.duration_ms)}</span>
                          </div>
                        </div>
                      </div>
                      {trace.error_message && (
                        <Badge variant="destructive" className="ml-2">
                          Error
                        </Badge>
                      )}
                    </div>
                  </button>

                  {/* Expanded Trace Details */}
                  {selectedTraceId === trace.trace_id && (
                    <div className="ml-7 mt-2 border-l-2 border-muted pl-4">
                      {detailLoading ? (
                        <div className="flex items-center gap-2 py-4 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading trace details...</span>
                        </div>
                      ) : detailedTrace && detailedTrace.length > 0 ? (
                        <TraceView traces={detailedTrace} />
                      ) : (
                        <p className="py-4 text-muted-foreground">No trace details available</p>
                      )}
                    </div>
                  )}
                </div>
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
