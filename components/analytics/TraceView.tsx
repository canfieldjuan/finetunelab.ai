/**
 * TraceView Component
 *
 * Displays detailed hierarchical traces of LLM operations
 * in a waterfall visualization for debugging and performance analysis
 *
 * Phase 1.2: Trace Visualization UI
 * Date: 2025-10-25
 */

import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Clock, AlertCircle, CheckCircle, XCircle, ArrowRight, Zap, Database, TrendingUp, Play } from 'lucide-react';
import { TraceReplayPanel } from './TraceReplayPanel';

export interface Trace {
  id: string;
  trace_id: string;
  parent_trace_id?: string;
  span_id: string;
  span_name: string;
  start_time: string;
  end_time?: string;
  duration_ms?: number;
  operation_type: string;
  model_name?: string;
  model_provider?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  ttft_ms?: number;
  tokens_per_second?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  retry_count?: number;
  retry_reason?: string;
  error_category?: string;
  error_type?: string;
  children?: Trace[];
  input_data?: unknown;
  output_data?: unknown;
  metadata?: Record<string, unknown>;
  judgments?: Array<{
    id: string;
    criterion: string;
    score: number;
    passed: boolean;
    judge_type: string;
    judge_name?: string;
    notes?: string;
  }>;
  user_rating?: number;
  user_notes?: string;
  api_endpoint?: string;
  api_base_url?: string;
  request_headers_sanitized?: Record<string, unknown>;
  provider_request_id?: string;
  queue_time_ms?: number;
  inference_time_ms?: number;
  network_time_ms?: number;
  streaming_enabled?: boolean;
  chunk_usage?: Record<string, unknown>;
  context_tokens?: number;
  retrieval_latency_ms?: number;
  groundedness_score?: number;
  response_quality_breakdown?: Record<string, unknown>;
  warning_flags?: string[];
}

interface TraceViewProps {
  traces: Trace[];
  onTraceClick?: (trace: Trace) => void;
}

export default function TraceView({ traces, onTraceClick }: TraceViewProps) {
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);

  // Deduplicate traces by span_id to prevent React key errors
  const uniqueTraces = useMemo(() => {
    if (!traces || traces.length === 0) return [];

    console.log('[TraceView] Input traces:', {
      count: traces.length,
      spanIds: traces.map(t => t.span_id),
      traces: traces
    });

    const seen = new Set<string>();
    const unique = traces.filter(trace => {
      if (seen.has(trace.span_id)) {
        console.warn(`[TraceView] Filtering duplicate span_id: ${trace.span_id}`);
        return false;
      }
      seen.add(trace.span_id);
      return true;
    });

    console.log('[TraceView] After deduplication:', {
      originalCount: traces.length,
      uniqueCount: unique.length,
      filtered: traces.length - unique.length
    });

    return unique;
  }, [traces]);

  // Auto-expand root traces on load
  React.useEffect(() => {
    if (uniqueTraces.length > 0) {
      const newExpanded = new Set<string>();
      // Expand root traces
      uniqueTraces.forEach(t => newExpanded.add(t.span_id));
      setExpandedTraces(newExpanded);
    }
  }, [uniqueTraces]);

  // Calculate timeline boundaries
  const timeline = useMemo(() => {
    if (!uniqueTraces || uniqueTraces.length === 0) return { start: 0, end: 1000 };

    let minTime = new Date(uniqueTraces[0].start_time).getTime();
    let maxTime = minTime + 1000;

    const processTrace = (trace: Trace) => {
      const startTime = new Date(trace.start_time).getTime();
      const endTime = trace.end_time
        ? new Date(trace.end_time).getTime()
        : startTime + (trace.duration_ms || 0);

      minTime = Math.min(minTime, startTime);
      maxTime = Math.max(maxTime, endTime);

      if (trace.children) {
        trace.children.forEach(processTrace);
      }
    };

    uniqueTraces.forEach(processTrace);
    return { start: minTime, end: maxTime };
  }, [uniqueTraces]);

  // Toggle trace expansion
  const toggleExpanded = (traceId: string) => {
    const newExpanded = new Set(expandedTraces);
    if (newExpanded.has(traceId)) {
      newExpanded.delete(traceId);
    } else {
      newExpanded.add(traceId);
    }
    setExpandedTraces(newExpanded);
  };

  // Handle trace selection
  const handleTraceClick = (trace: Trace) => {
    setSelectedTrace(trace);
    if (onTraceClick) {
      onTraceClick(trace);
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  // Get operation type color
  const getOperationColor = (type: string) => {
    const colors: Record<string, string> = {
      llm_call: 'bg-blue-100 text-blue-800',
      tool_call: 'bg-green-100 text-green-800',
      prompt_generation: 'bg-purple-100 text-purple-800',
      response_processing: 'bg-yellow-100 text-yellow-800',
      embedding: 'bg-pink-100 text-pink-800',
      retrieval: 'bg-indigo-100 text-indigo-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Render a single trace span
  const renderTraceSpan = (trace: Trace, depth: number = 0) => {
    const hasChildren = trace.children && trace.children.length > 0;
    const isExpanded = expandedTraces.has(trace.span_id);

    const startTime = new Date(trace.start_time).getTime();
    const endTime = trace.end_time
      ? new Date(trace.end_time).getTime()
      : startTime + (trace.duration_ms || 0);

    const barStart = ((startTime - timeline.start) / (timeline.end - timeline.start)) * 100;
    const barWidth = ((endTime - startTime) / (timeline.end - timeline.start)) * 100;

    return (
      <div key={trace.span_id} className="trace-span">
        {/* Trace row */}
        <div
          className={`flex items-center border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
            selectedTrace?.span_id === trace.span_id ? 'bg-blue-50' : ''
          }`}
          style={{ paddingLeft: `${depth * 24}px` }}
          onClick={() => handleTraceClick(trace)}
        >
          {/* Expand/collapse button */}
          <button
            className="p-1 mr-2"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(trace.span_id);
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>

          {/* Trace info */}
          <div className="flex-1 py-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(trace.status)}
              <span className="font-medium text-sm">{trace.span_name}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${getOperationColor(trace.operation_type)}`}>
                {trace.operation_type}
              </span>
              {trace.model_name && (
                <span className="text-xs text-gray-500">{trace.model_name}</span>
              )}
            </div>
          </div>

          {/* Duration and tokens */}
          <div className="flex items-center gap-4 pr-4">
            {trace.duration_ms && (
              <span className="text-xs text-gray-600">{trace.duration_ms}ms</span>
            )}
            {trace.total_tokens && (
              <span className="text-xs text-gray-600">{trace.total_tokens} tokens</span>
            )}
            {trace.cost_usd && (
              <span className="text-xs text-gray-600">${trace.cost_usd.toFixed(4)}</span>
            )}
          </div>

          {/* Timeline bar */}
          <div className="w-80 relative h-8 bg-gray-100 rounded-sm">
            {/* Timeline bar with gradient and status-based styling */}
            <div
              className={`absolute h-6 top-1 rounded shadow-sm transition-all ${
                trace.status === 'failed' 
                  ? 'bg-gradient-to-r from-red-400 to-red-500' 
                  : trace.status === 'completed'
                  ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                  : 'bg-gradient-to-r from-yellow-400 to-yellow-500 animate-pulse'
              }`}
              style={{
                left: `${barStart}%`,
                width: `${Math.max(barWidth, 2)}%`,
              }}
              title={`Duration: ${trace.duration_ms}ms`}
            >
              {/* TTFT marker if available */}
              {trace.ttft_ms && trace.duration_ms && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white"
                  style={{
                    left: `${(trace.ttft_ms / trace.duration_ms) * 100}%`,
                  }}
                  title={`TTFT: ${trace.ttft_ms}ms`}
                />
              )}
            </div>
            
            {/* Duration label */}
            {barWidth > 10 && (
              <div 
                className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white pointer-events-none"
                style={{ left: `${barStart}%`, width: `${barWidth}%` }}
              >
                {trace.duration_ms && trace.duration_ms < 1000 
                  ? `${trace.duration_ms}ms` 
                  : `${(trace.duration_ms! / 1000).toFixed(2)}s`
                }
              </div>
            )}
          </div>
        </div>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div>
            {trace.children!.map((child) => renderTraceSpan(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Main render
  return (
    <div className="trace-view bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">Request Trace</h3>
        <p className="text-sm text-gray-600 mt-1">
          Detailed waterfall view of LLM operations
        </p>
      </div>

      {/* Trace list */}
      <div className="trace-list overflow-x-auto">
        {uniqueTraces && uniqueTraces.length > 0 ? (
          uniqueTraces.map((trace) => renderTraceSpan(trace, 0))
        ) : (
          <div className="p-8 text-center text-gray-500">
            No traces available
          </div>
        )}
      </div>

      {/* Details panel */}
      {selectedTrace && (
        <div className="border-t p-4 bg-gray-50/50">
          <div className="flex items-center justify-between mb-4">
             <h4 className="font-semibold text-sm text-gray-900">Trace Details</h4>
             <div className="flex gap-4 text-xs text-gray-500 font-mono">
                <span>Span: {selectedTrace.span_id}</span>
                <span>Trace: {selectedTrace.trace_id}</span>
             </div>
          </div>

          {/* Compact Metrics Grid */}
          <div className="grid grid-cols-4 gap-3 mb-4">
             {/* Status */}
             <div className="bg-white p-2 rounded border flex flex-col justify-center">
                <span className="text-xs text-gray-500 mb-1">Status</span>
                <div className="flex items-center gap-1.5 font-medium text-sm">
                   {getStatusIcon(selectedTrace.status)}
                   <span className="capitalize">{selectedTrace.status}</span>
                </div>
             </div>

             {/* Duration */}
             <div className="bg-white p-2 rounded border flex flex-col justify-center">
                <span className="text-xs text-gray-500 mb-1">Duration</span>
                <div className="font-medium text-sm">{selectedTrace.duration_ms}ms</div>
             </div>

             {/* Cost */}
             {selectedTrace.cost_usd != null && (
                <div className="bg-white p-2 rounded border flex flex-col justify-center">
                   <span className="text-xs text-gray-500 mb-1">Cost</span>
                   <div className="font-medium text-sm text-green-600">${selectedTrace.cost_usd.toFixed(6)}</div>
                </div>
             )}

             {/* Throughput */}
             {selectedTrace.tokens_per_second != null && (
                <div className="bg-white p-2 rounded border flex flex-col justify-center">
                   <span className="text-xs text-gray-500 mb-1">Speed</span>
                   <div className="font-medium text-sm text-blue-600">{selectedTrace.tokens_per_second.toFixed(1)} t/s</div>
                </div>
             )}
          </div>

          {/* Compact Token Flow */}
          {(selectedTrace.input_tokens != null || selectedTrace.output_tokens != null) && (
            <div className="mb-4 p-3 bg-white rounded border border-blue-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-gray-700">Token Flow</span>
              </div>
              
              <div className="flex items-center text-sm">
                {/* Input */}
                <div className="flex-1 flex items-center gap-2">
                   <span className="text-gray-500 text-xs uppercase tracking-wider">Input</span>
                   <span className="font-mono font-medium">{selectedTrace.input_tokens?.toLocaleString() || 0}</span>
                </div>

                <ArrowRight className="h-3 w-3 text-gray-300 mx-2" />

                {/* Cache (if any) */}
                {(selectedTrace.cache_read_input_tokens || selectedTrace.cache_creation_input_tokens) && (
                   <>
                     <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs border border-green-100 mx-2">
                        <Database className="h-3 w-3" />
                        <span className="font-medium">
                           {selectedTrace.cache_read_input_tokens ? 
                              `${selectedTrace.cache_read_input_tokens.toLocaleString()} Hit` : 
                              `${selectedTrace.cache_creation_input_tokens?.toLocaleString()} Write`}
                        </span>
                     </div>
                     <ArrowRight className="h-3 w-3 text-gray-300 mx-2" />
                   </>
                )}

                {/* Output */}
                <div className="flex-1 flex items-center gap-2 justify-center">
                   <span className="text-gray-500 text-xs uppercase tracking-wider">Output</span>
                   <span className="font-mono font-medium text-purple-600">{selectedTrace.output_tokens?.toLocaleString() || 0}</span>
                </div>

                <div className="text-gray-300 mx-3">|</div>

                {/* Total */}
                <div className="flex-1 flex items-center gap-2 justify-end">
                   <span className="text-gray-500 text-xs uppercase tracking-wider">Total</span>
                   <span className="font-mono font-bold text-indigo-600">{selectedTrace.total_tokens?.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Additional Metrics Row (TTFT, Retries) */}
          {(selectedTrace.ttft_ms != null || selectedTrace.retry_count != null) ? (
             <div className="flex gap-3 mb-4">
                {selectedTrace.ttft_ms != null && (
                   <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded border border-purple-100 text-xs">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium">TTFT: {selectedTrace.ttft_ms}ms</span>
                   </div>
                )}
                {selectedTrace.retry_count != null && selectedTrace.retry_count > 0 && (
                   <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 rounded border border-orange-100 text-xs">
                      <span className="font-bold">🔄 {selectedTrace.retry_count}x</span>
                      <span>Retries</span>
                   </div>
                )}
             </div>
          ) : null}

          {/* Error message if failed */}
          {selectedTrace.status === 'failed' && selectedTrace.error_message ? (
            <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-red-800">Error</p>
                    {selectedTrace.error_category && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                        {selectedTrace.error_category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    {selectedTrace.error_message}
                  </p>
                  {selectedTrace.error_type && (
                    <p className="text-xs text-red-600 mt-1">
                      Type: {selectedTrace.error_type}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Technical Details & Metadata */}
          {(selectedTrace.api_endpoint || selectedTrace.request_headers_sanitized || selectedTrace.queue_time_ms || selectedTrace.context_tokens || selectedTrace.retrieval_latency_ms) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Performance Metrics */}
              {(selectedTrace.queue_time_ms !== undefined || selectedTrace.inference_time_ms !== undefined || selectedTrace.chunk_usage) && (
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="bg-blue-50 px-3 py-2 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider">Performance Metrics</span>
                    </div>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {selectedTrace.queue_time_ms !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase">Queue Time</span>
                        <span className="text-xs font-mono font-medium">{selectedTrace.queue_time_ms}ms</span>
                      </div>
                    )}
                    {selectedTrace.inference_time_ms !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase">Inference Time</span>
                        <span className="text-xs font-mono font-medium">{selectedTrace.inference_time_ms}ms</span>
                      </div>
                    )}
                    {selectedTrace.network_time_ms !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase">Network Time</span>
                        <span className="text-xs font-mono font-medium">{selectedTrace.network_time_ms}ms</span>
                      </div>
                    )}
                    {selectedTrace.streaming_enabled !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase">Streaming</span>
                        <span className="text-xs font-mono font-medium">{selectedTrace.streaming_enabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    )}
                  </div>
                  {selectedTrace.chunk_usage && (
                    <div className="p-3 border-t bg-gray-50/30">
                      <span className="text-[10px] text-gray-500 uppercase block mb-1">Chunk Usage</span>
                      <pre className="text-xs font-mono text-gray-800 overflow-x-auto">
                        {JSON.stringify(selectedTrace.chunk_usage, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* RAG Context */}
              {(selectedTrace.context_tokens !== undefined || selectedTrace.retrieval_latency_ms !== undefined) && (
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="bg-indigo-50 px-3 py-2 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">RAG Context</span>
                    </div>
                    {selectedTrace.context_tokens && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                        {selectedTrace.context_tokens} tokens
                      </span>
                    )}
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                     {selectedTrace.retrieval_latency_ms !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase">Retrieval Latency</span>
                        <span className="text-xs font-mono font-medium">{selectedTrace.retrieval_latency_ms}ms</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Request Metadata */}
              {(selectedTrace.api_endpoint || selectedTrace.request_headers_sanitized) && (
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm md:col-span-2">
                  <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Request Metadata</span>
                  </div>
                  <div className="p-3 grid grid-cols-1 gap-2">
                    {selectedTrace.api_endpoint && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase">API Endpoint</span>
                        <span className="text-xs font-mono font-medium break-all">{selectedTrace.api_endpoint}</span>
                      </div>
                    )}
                    {selectedTrace.provider_request_id && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 uppercase">Provider Request ID</span>
                        <span className="text-xs font-mono font-medium">{selectedTrace.provider_request_id}</span>
                      </div>
                    )}
                    {selectedTrace.request_headers_sanitized && (
                      <div className="mt-2">
                        <span className="text-[10px] text-gray-500 uppercase block mb-1">Headers</span>
                        <pre className="p-2 text-xs bg-gray-50 rounded border overflow-x-auto font-mono text-gray-800">
                          {JSON.stringify(selectedTrace.request_headers_sanitized, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Input/Output Data */}
          {(selectedTrace.input_data || selectedTrace.output_data) ? (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedTrace.input_data ? (
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Input Data</span>
                    <span className="text-[10px] text-gray-400">JSON</span>
                  </div>
                  <div className="p-0">
                    <pre className="p-3 text-xs bg-gray-50/30 overflow-x-auto max-h-[300px] overflow-y-auto font-mono text-gray-800">
                      {JSON.stringify(selectedTrace.input_data, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : null}

              {selectedTrace.output_data ? (
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Output Data</span>
                    <span className="text-[10px] text-gray-400">JSON</span>
                  </div>
                  <div className="p-0">
                    <pre className="p-3 text-xs bg-gray-50/30 overflow-x-auto max-h-[300px] overflow-y-auto font-mono text-gray-800">
                      {JSON.stringify(selectedTrace.output_data, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Quality Evaluation Section */}
          {(selectedTrace.judgments && selectedTrace.judgments.length > 0) || selectedTrace.user_rating ? (
            <div className="mt-4 p-3 bg-purple-50/50 rounded border border-purple-100">
              <div className="flex items-center justify-between mb-2">
                 <h4 className="font-semibold text-xs text-purple-900 uppercase tracking-wider">Quality Evaluation</h4>
                 {selectedTrace.user_rating && (
                    <div className="flex items-center gap-1.5 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100">
                       <span className="text-xs font-medium text-yellow-800">User Rating:</span>
                       <span className="text-sm">{'⭐'.repeat(selectedTrace.user_rating)}</span>
                    </div>
                 )}
              </div>

              {selectedTrace.judgments && selectedTrace.judgments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedTrace.judgments.map((judgment) => (
                    <div key={judgment.id} className="flex items-center justify-between p-2 bg-white rounded border border-purple-100 shadow-sm">
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs truncate" title={judgment.criterion}>{judgment.criterion}</span>
                          <span className="text-[10px] text-gray-400 uppercase">{judgment.judge_type}</span>
                        </div>
                        {judgment.notes && (
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">{judgment.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-mono font-medium ${judgment.score > 0.7 ? 'text-green-600' : 'text-orange-600'}`}>
                           {(judgment.score * 100).toFixed(0)}%
                        </span>
                        {judgment.passed ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedTrace.user_notes && (
                 <div className="mt-2 text-xs text-gray-600 italic bg-white/50 p-2 rounded">
                    "{selectedTrace.user_notes}"
                 </div>
              )}
            </div>
          ) : null}

          {/* Trace Replay Section */}
          <div className="mt-4">
            <details className="group border rounded-lg bg-white">
              <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-blue-50 rounded text-blue-600">
                    <Play className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-medium text-sm text-gray-700">Replay Trace</span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="p-3 border-t">
                <TraceReplayPanel trace={selectedTrace} />
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}