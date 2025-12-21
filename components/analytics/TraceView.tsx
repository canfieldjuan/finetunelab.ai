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
import { ChevronRight, ChevronDown, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

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
          <div className="w-64 relative h-6">
            <div
              className={`absolute h-4 top-1 rounded ${
                trace.status === 'failed' ? 'bg-red-300' : 'bg-blue-300'
              }`}
              style={{
                left: `${barStart}%`,
                width: `${Math.max(barWidth, 1)}%`,
              }}
            />
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
        <div className="border-t p-4">
          <h4 className="font-semibold mb-3">Trace Details</h4>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Span ID:</p>
              <p className="font-mono">{selectedTrace.span_id}</p>
            </div>
            <div>
              <p className="text-gray-600">Trace ID:</p>
              <p className="font-mono">{selectedTrace.trace_id}</p>
            </div>
            <div>
              <p className="text-gray-600">Status:</p>
              <p className="flex items-center gap-1">
                {getStatusIcon(selectedTrace.status)}
                {selectedTrace.status}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Duration:</p>
              <p>{selectedTrace.duration_ms}ms</p>
            </div>

            {/* Token metrics */}
            {selectedTrace.input_tokens != null && (
              <div>
                <p className="text-gray-600">Input Tokens:</p>
                <p className="font-mono">{selectedTrace.input_tokens.toLocaleString()}</p>
              </div>
            )}
            {selectedTrace.output_tokens != null && (
              <div>
                <p className="text-gray-600">Output Tokens:</p>
                <p className="font-mono">{selectedTrace.output_tokens.toLocaleString()}</p>
              </div>
            )}
            {selectedTrace.total_tokens != null && (
              <div>
                <p className="text-gray-600">Total Tokens:</p>
                <p className="font-mono font-semibold">{selectedTrace.total_tokens.toLocaleString()}</p>
              </div>
            )}

            {/* Cost */}
            {selectedTrace.cost_usd != null && selectedTrace.cost_usd > 0 && (
              <div>
                <p className="text-gray-600">Cost:</p>
                <p className="font-semibold text-green-600">${selectedTrace.cost_usd.toFixed(6)}</p>
              </div>
            )}

            {/* Performance metrics */}
            {selectedTrace.tokens_per_second != null && selectedTrace.tokens_per_second > 0 && (
              <div>
                <p className="text-gray-600">Throughput:</p>
                <p className="text-blue-600">{selectedTrace.tokens_per_second.toFixed(1)} tok/s</p>
              </div>
            )}
            {selectedTrace.ttft_ms != null && selectedTrace.ttft_ms > 0 && (
              <div>
                <p className="text-gray-600">TTFT:</p>
                <p className="text-purple-600">{selectedTrace.ttft_ms}ms</p>
              </div>
            )}

            {/* Cache metrics (Anthropic prompt caching) */}
            {selectedTrace.cache_read_input_tokens != null && selectedTrace.cache_read_input_tokens > 0 && (
              <div>
                <p className="text-gray-600">Cache Hits:</p>
                <p className="text-green-600 font-semibold">
                  {selectedTrace.cache_read_input_tokens.toLocaleString()} tokens
                  {selectedTrace.input_tokens && (
                    <span className="text-xs ml-1 font-normal">
                      ({((selectedTrace.cache_read_input_tokens / selectedTrace.input_tokens) * 100).toFixed(1)}%)
                    </span>
                  )}
                </p>
              </div>
            )}
            {selectedTrace.cache_creation_input_tokens != null && selectedTrace.cache_creation_input_tokens > 0 && (
              <div>
                <p className="text-gray-600">Cache Writes:</p>
                <p className="text-amber-600">{selectedTrace.cache_creation_input_tokens.toLocaleString()} tokens</p>
              </div>
            )}

            {/* Retry information */}
            {selectedTrace.retry_count != null && selectedTrace.retry_count > 0 && (
              <div>
                <p className="text-gray-600">Retries:</p>
                <p className="text-orange-600 font-semibold">
                  {selectedTrace.retry_count}x
                  {selectedTrace.retry_reason && (
                    <span className="text-xs ml-1 font-normal text-gray-500">({selectedTrace.retry_reason})</span>
                  )}
                </p>
              </div>
            )}
          </div>

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

          {/* Input/Output data preview */}
          {(selectedTrace.input_data || selectedTrace.output_data) ? (
            <div className="mt-4 space-y-3">
              {selectedTrace.input_data ? (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium">
                    Input Data
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedTrace.input_data, null, 2)}
                  </pre>
                </details>
              ) : null}

              {selectedTrace.output_data ? (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium">
                    Output Data
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedTrace.output_data, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}

          {/* Quality Evaluation Section */}
          {(selectedTrace.judgments && selectedTrace.judgments.length > 0) || selectedTrace.user_rating ? (
            <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold mb-3 text-purple-900">Quality Evaluation</h4>

              {selectedTrace.judgments && selectedTrace.judgments.length > 0 && (
                <div className="space-y-2">
                  {selectedTrace.judgments.map((judgment) => (
                    <div key={judgment.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{judgment.criterion}</span>
                          <span className="text-xs text-gray-500">({judgment.judge_type})</span>
                        </div>
                        {judgment.notes && (
                          <p className="text-xs text-gray-600 mt-1">{judgment.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono">{(judgment.score * 100).toFixed(0)}%</span>
                        {judgment.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTrace.user_rating && (
                <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">User Rating:</span>
                    <span className="text-lg">{'⭐'.repeat(selectedTrace.user_rating)}</span>
                    <span className="text-sm text-gray-600">({selectedTrace.user_rating}/5)</span>
                  </div>
                  {selectedTrace.user_notes && (
                    <p className="text-sm text-gray-700 mt-2">{selectedTrace.user_notes}</p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}