"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TraceView, { type Trace } from './TraceView';
import { supabase } from '@/lib/supabaseClient';

interface TagRow {
  tag: string;
  count: number;
}

interface JudgmentsTableProps {
  data: TagRow[];
  timeRange?: '7d' | '30d' | '90d' | 'all';
}

type ExampleItem = {
  messageId: string;
  createdAt: string;
  role: string;
  modelId: string | null;
  provider: string | null;
  conversationId: string | null;
  content: string | null;
  rating: number | null;
  success: boolean | null;
  failureTags: string[];
};

/**
 * Format tag names to be user-friendly
 * Examples: incorrect_info → Incorrect Info, wrong_tool → Wrong Tool
 */
function formatTagName(tag: string): string {
  return tag
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function JudgmentsTable({ data, timeRange = '30d' }: JudgmentsTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTag, setModalTag] = useState<string | null>(null);
  const [examples, setExamples] = useState<ExampleItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    if (timeRange === 'all') return { startDate: undefined, endDate: undefined };
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [timeRange]);

  const topTags = useMemo(() => data.slice(0, 10), [data]);

  const openModal = async (tag: string) => {
    setModalTag(tag);
    setModalOpen(true);
    setExamples([]);
    setPage(1);
    await loadExamples(tag, 1);
  };

  const loadExamples = async (tag: string, pageNum: number) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const params = new URLSearchParams({ tag, page: String(pageNum), pageSize: String(pageSize) });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/analytics/judgment-examples?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const items: ExampleItem[] = json.items || [];
      setExamples(prev => (pageNum === 1 ? items : [...prev, ...items]));
      setHasMore(!!json.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load examples');
    } finally {
      setLoading(false);
    }
  };

  const loadTrace = async (messageId: string) => {
    try {
      console.log('[JudgmentsTable] Loading trace for message:', messageId);
      setTraceLoading(true);
      setTraceError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const response = await fetch(
        `/api/analytics/traces?message_id=${messageId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load trace: ${response.status}`);
      }

      const result = await response.json();
      console.log('[JudgmentsTable] Trace loaded:', result.data?.length || 0, 'spans');
      setTraces(result.data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load trace';
      console.error('[JudgmentsTable] Trace load error:', errorMsg);
      setTraceError(errorMsg);
    } finally {
      setTraceLoading(false);
    }
  };

  const openTraceModal = async (messageId: string) => {
    console.log('[JudgmentsTable] Opening trace modal for:', messageId);
    setSelectedMessageId(messageId);
    setTraceModalOpen(true);
    await loadTrace(messageId);
  };

  useEffect(() => {
    if (modalOpen && modalTag) {
      // Hot reload safety: reload current page on open
      loadExamples(modalTag, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quality Issues - Detailed View</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Click &quot;View examples&quot; to see specific failed responses with traces for debugging.
        </p>
      </CardHeader>
      <CardContent>
        {topTags.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">No quality issues to display</p>
            <p className="text-xs">
              When evaluating responses, add failure tags to categorize issues (hallucination, formatting, factual_error, etc.)
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-3">Tag</th>
                  <th className="py-2 px-3">Count</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {topTags.map(tag => (
                  <tr key={tag.tag} className="border-b">
                    <td className="py-2 px-3">{formatTagName(tag.tag)}</td>
                    <td className="py-2 px-3">{tag.count}</td>
                    <td className="py-2 px-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openModal(tag.tag)}>
                        View examples
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Simple modal implementation */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" role="dialog" aria-modal="true">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="font-medium">Examples for: {modalTag ? formatTagName(modalTag) : ''}</div>
                <button className="text-sm" onClick={() => setModalOpen(false)}>Close</button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
                {error && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
                )}
                {examples.length === 0 && !loading && !error && (
                  <div className="text-sm text-muted-foreground">No examples found</div>
                )}
                {examples.map((ex) => (
                  <div key={`${ex.messageId}-${ex.createdAt}`} className="border rounded p-2">
                    <div className="flex items-start justify-between mb-1">
                      <div className="text-xs text-gray-500">
                        {new Date(ex.createdAt).toLocaleString()} • {ex.modelId || 'unknown model'} • {ex.provider || 'unknown'}
                      </div>
                      {ex.messageId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openTraceModal(ex.messageId)}
                          className="text-xs h-6"
                        >
                          View Trace
                        </Button>
                      )}
                    </div>
                    {ex.content ? (
                      <div className="text-sm whitespace-pre-wrap">{ex.content}</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No message content captured for this item.</div>
                    )}
                    <div className="text-[11px] text-gray-500 mt-1">
                      Tags: {ex.failureTags.length > 0 ? ex.failureTags.map(formatTagName).join(', ') : '—'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Showing {examples.length} item(s)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!hasMore || loading || !modalTag}
                    onClick={async () => {
                      const next = page + 1;
                      setPage(next);
                      await loadExamples(modalTag!, next);
                    }}
                  >
                    {loading ? 'Loading…' : hasMore ? 'Load more' : 'No more results'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trace modal */}
        {traceModalOpen && (
          <div
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="font-medium">
                  Request Trace - Message {selectedMessageId?.slice(0, 8)}...
                </div>
                <button
                  className="text-sm px-3 py-1 hover:bg-gray-100 rounded"
                  onClick={() => {
                    console.log('[JudgmentsTable] Closing trace modal');
                    setTraceModalOpen(false);
                    setTraces([]);
                    setTraceError(null);
                  }}
                >
                  Close
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[75vh]">
                {traceLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-gray-600">Loading trace data...</div>
                  </div>
                )}

                {traceError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded">
                    <div className="text-sm text-red-700">{traceError}</div>
                  </div>
                )}

                {!traceLoading && !traceError && traces.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-sm text-gray-600">
                      No trace data available for this message.
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Traces are only captured when the trace API is enabled.
                    </div>
                  </div>
                )}

                {!traceLoading && !traceError && traces.length > 0 && (
                  <TraceView traces={traces} />
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
