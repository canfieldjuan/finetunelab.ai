"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { SessionMetrics } from '@/hooks/useAnalytics';
import { MetricSelector, SESSION_METRICS, type MetricKey } from './MetricSelector';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useSignificance } from './hooks/useSignificance';
import { formatSessionName } from '@/lib/utils/format-labels';

interface SessionComparisonTableProps {
  data: SessionMetrics[];
  onSessionSelect?: (sessionId: string | null) => void;
  selectedSessionId?: string | null;
}

export function SessionComparisonTable({
  data,
  onSessionSelect,
  selectedSessionId
}: SessionComparisonTableProps) {
  // Get default visible metrics
  const defaultMetrics = SESSION_METRICS.filter(m => m.defaultVisible).map(m => m.key);

  // State for selected metrics
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(defaultMetrics);
  const [showMetricSelector, setShowMetricSelector] = useState(false);

  // Significance calculations across all sessions
  const { sessions: significanceSessions, pairwise } = useSignificance(data);
  const sigBySessionId = useMemo(() => {
    const map: Record<string, { ciLow: number; ciHigh: number; evaluationCount: number; successCount: number }> = {};
    significanceSessions.forEach(s => {
      map[s.sessionId] = {
        ciLow: s.ciLow,
        ciHigh: s.ciHigh,
        evaluationCount: s.evaluationCount,
        successCount: s.successCount,
      };
    });
    return map;
  }, [significanceSessions]);

  console.log('[SessionComparisonTable] Rendering with data:', {
    sessionCount: data?.length || 0,
    selectedSessionId,
    selectedMetrics: selectedMetrics.length,
    showMetricSelector
  });

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session-Based A/B Testing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No session data available. Start an A/B test by setting session_id and experiment_name when creating conversations.
          </p>
          <div className="mt-3 text-xs text-gray-400">
            <p>To enable A/B testing:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Set session_id when creating conversations (e.g., &quot;sess_baseline_test&quot;)</li>
              <li>Set experiment_name to group sessions (e.g., &quot;gpt4-vs-claude&quot;)</li>
              <li>Compare metrics across different sessions and experiments</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group sessions by experiment for better organization
  const sessionsByExperiment: Record<string, SessionMetrics[]> = {};
  data.forEach(session => {
    const expName = session.experimentName || 'No Experiment';
    if (!sessionsByExperiment[expName]) {
      sessionsByExperiment[expName] = [];
    }
    sessionsByExperiment[expName].push(session);
  });

  // Helper function to format metric values
  const formatMetricValue = (key: MetricKey, value: unknown): string => {
    const metric = SESSION_METRICS.find(m => m.key === key);
    if (!metric || value === null || value === undefined) return '-';

    switch (metric.format) {
      case 'percentage': {
        const num = typeof value === 'number' ? value : Number(value);
        return isNaN(num) ? '-' : `${num.toFixed(1)}%`;
      }
      case 'currency': {
        const num = typeof value === 'number' ? value : Number(value);
        return isNaN(num) ? '-' : `$${num.toFixed(4)}`;
      }
      case 'tokens': {
        const num = typeof value === 'number' ? value : Number(value);
        return isNaN(num) ? '-' : `${Math.round(num).toLocaleString()} tokens`;
      }
      case 'time': {
        const num = typeof value === 'number' ? value : Number(value);
        return isNaN(num) ? '-' : `${Math.round(num)}ms`;
      }
      case 'date': {
        const d = value instanceof Date ? value : new Date(String(value));
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
      }
      case 'number': {
        const num = typeof value === 'number' ? value : Number(value);
        return isNaN(num) ? '-' : num.toFixed(1);
      }
      default:
        return String(value);
    }
  };

  return (
    <>
      {/* Metric Selector (collapsible) */}
      {showMetricSelector && (
        <MetricSelector
          type="session"
          selectedMetrics={selectedMetrics}
          onMetricsChange={(metrics) => {
            console.log('[SessionComparisonTable] Metrics changed:', metrics);
            setSelectedMetrics(metrics);
          }}
          className="mb-4"
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Session-Based A/B Testing</CardTitle>
              <CardDescription className="mt-1">
                Compare performance across different testing sessions. Click any row to filter all charts to that session. Active filter shown above.
              </CardDescription>
              {pairwise && (
                <div className="mt-1 text-xs">
                  <span className="text-gray-500">Top two sessions p-value: </span>
                  <span className={`font-medium ${pairwise.pValue < 0.05 ? 'text-green-700' : 'text-gray-700'}`}>
                    {pairwise.pValue.toFixed(3)}{pairwise.pValue < 0.05 ? ' (significant at 95%)' : ''}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                console.log('[SessionComparisonTable] Toggle metric selector:', !showMetricSelector);
                setShowMetricSelector(!showMetricSelector);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
            >
              {showMetricSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showMetricSelector ? 'Hide' : 'Show'} Metrics
            </button>
          </div>
        </CardHeader>
        <CardContent>
        <div className="space-y-6">
          {Object.entries(sessionsByExperiment).map(([experimentName, sessions]) => (
            <div key={experimentName}>
              <h3 className="text-sm font-semibold mb-2 text-gray-700">
                {experimentName}
                <span className="ml-2 text-xs font-normal text-gray-500">
                  ({sessions.length} session{sessions.length !== 1 ? 's' : ''})
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-2 px-3">Session ID</th>
                      {selectedMetrics.map(metricKey => {
                        const metric = SESSION_METRICS.find(m => m.key === metricKey);
                        return metric ? (
                          <th key={metricKey} className="py-2 px-3 text-right">
                            {metric.label}
                          </th>
                        ) : null;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => {
                      const isSelected = selectedSessionId === session.sessionId;
                      return (
                        <tr
                          key={session.sessionId}
                          className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                          onClick={() => {
                            console.log('[SessionComparisonTable] Session clicked:', {
                              sessionId: session.sessionId,
                              isSelected,
                              willDeselect: isSelected
                            });
                            onSessionSelect?.(isSelected ? null : session.sessionId);
                          }}
                        >
                          <td className="py-2 px-3">
                            <div className="font-medium truncate max-w-[200px]" title={session.sessionId}>
                              {formatSessionName(session.sessionId)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(session.firstConversation).toLocaleDateString()} - {new Date(session.lastConversation).toLocaleDateString()}
                            </div>
                          </td>
                          {selectedMetrics.map(metricKey => {
                            const metric = SESSION_METRICS.find(m => m.key === metricKey);
                            if (!metric) return null;

                            const value = session[metricKey as keyof SessionMetrics];
                            const formattedValue = formatMetricValue(metricKey, value);

                            // Special styling for certain metrics
                            let className = "py-2 px-3 text-right";
                            let displayValue: React.ReactNode = formattedValue;

                            if (metricKey === 'avgRating' && session.evaluationCount > 0) {
                              className += " text-yellow-600";
                              displayValue = `${formattedValue} ⭐`;
                            } else if (metricKey === 'successRate' && session.evaluationCount > 0) {
                              const rate = value as number;
                              className += rate >= 80 ? " text-green-600 font-medium" :
                                         rate >= 60 ? " text-yellow-600" :
                                         " text-red-600 font-medium";

                              const sig = sigBySessionId[session.sessionId];
                              if (sig) {
                                const low = sig.ciLow.toFixed(1);
                                const high = sig.ciHigh.toFixed(1);
                                const ci = (
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    95% CI [{low}% – {high}%]
                                  </div>
                                );
                                const isWinner = pairwise && pairwise.pValue < 0.05 && pairwise.a === session.sessionId;
                                displayValue = (
                                  <div className="inline-flex flex-col items-end">
                                    <div>
                                      {formattedValue}
                                      {isWinner && (
                                        <span className="ml-2 inline-block rounded bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-medium align-middle">
                                          Significant
                                        </span>
                                      )}
                                    </div>
                                    {ci}
                                  </div>
                                );
                              }
                            } else if (metricKey === 'totalCost') {
                              className += " font-mono";
                            }

                            return (
                              <td key={metricKey} className={className}>
                                {formattedValue !== '-' ? displayValue : <span className="text-gray-400">-</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
          <span>Click a row to filter all charts to that session</span>
          {selectedSessionId && (
            <button
              onClick={() => onSessionSelect?.(null)}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Clear filter
            </button>
          )}
        </div>
      </CardContent>
    </Card>
    </>
  );
}
