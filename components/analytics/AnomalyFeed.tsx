/**
 * AnomalyFeed Component
 *
 * Displays real-time feed of detected anomalies with severity indicators
 * and actionable recommendations
 *
 * Phase 2.3: Anomaly Feed UI
 * Date: 2025-10-25
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Activity,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface Anomaly {
  id: string;
  anomaly_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  metric_name: string;
  model_id?: string;
  conversation_id?: string;
  tool_name?: string;
  detected_value: number;
  expected_value: number;
  threshold_value: number;
  deviation_percentage: number;
  statistics: Record<string, unknown>;
  description: string;
  contributing_factors: string[];
  recommended_actions: string[];
  resolution_status: string;
  acknowledged: boolean;
  detected_at: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  root_cause?: string;
  linked_anomalies?: string[];
}

interface AnomalyFeedProps {
  maxItems?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function AnomalyFeed({
  maxItems = 10,
  autoRefresh = true,
  refreshInterval = 30000
}: AnomalyFeedProps) {
  const router = useRouter();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  // Resolution workflow state
  const [showResolution, setShowResolution] = useState(false);
  const [resolutionStatus, setResolutionStatus] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [linkedAnomalyIds, setLinkedAnomalyIds] = useState<string[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const refetchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch anomalies
  const fetchAnomalies = useCallback(async () => {
    try {
      console.log('[AnomalyFeed] Fetching anomalies, maxItems:', maxItems);
      setLoading(true);
      setError(null);

      // [AUTH_DEBUG] Get session with detailed logging
      console.log('[AnomalyFeed] Retrieving session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[AnomalyFeed] Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session) {
        console.error('[AnomalyFeed] No session found - user not authenticated');
        throw new Error('Not authenticated. Please log in.');
      }

      // [AUTH_DEBUG] Log session details (safe info only)
      console.log('[AnomalyFeed] Session found:', {
        user_id: session.user?.id,
        token_prefix: session.access_token.substring(0, 10) + '...',
        token_length: session.access_token.length,
        expires_at: session.expires_at
      });

      const params = new URLSearchParams({
        resolution_status: 'pending',
        limit: String(maxItems)
      });

      console.log('[AnomalyFeed] Fetching with auth token...');
      const response = await fetch(`/api/analytics/anomalies?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      // [AUTH_DEBUG] Improved error handling with API error message
      if (!response.ok) {
        let errorMessage = `Failed to fetch anomalies: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = `API Error (${response.status}): ${errorData.error}`;
          }
        } catch {
          // Response wasn't JSON, use status code only
        }
        console.error('[AnomalyFeed] API request failed:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[AnomalyFeed] Fetched anomalies:', result.data?.length || 0);
      setAnomalies(result.data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load anomalies';
      console.error('[AnomalyFeed] Fetch error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  // Initial load
  useEffect(() => {
    console.log('[AnomalyFeed] Initial load');
    fetchAnomalies();
  }, [fetchAnomalies]);

  // Live updates (Realtime) with fallback polling
  useEffect(() => {
    let isActive = true;

    const stopFallbackPolling = () => {
      if (pollingIntervalRef.current) {
        console.log('[AnomalyFeed] Stopping fallback polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const startFallbackPolling = () => {
      if (pollingIntervalRef.current) {
        return;
      }

      console.log('[AnomalyFeed] Starting fallback polling, interval:', refreshInterval);
      const poll = async () => {
        try {
          await fetchAnomalies();
        } catch {
          // fetchAnomalies already sets error state
        }
      };

      poll();
      pollingIntervalRef.current = setInterval(poll, refreshInterval);
    };

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const cleanupChannel = async () => {
      if (!channelRef.current) {
        return;
      }

      try {
        await channelRef.current.unsubscribe();
      } catch (err) {
        console.warn('[AnomalyFeed] Error unsubscribing channel:', err);
      }

      try {
        supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn('[AnomalyFeed] Error removing channel:', err);
      }

      channelRef.current = null;
    };

    const scheduleReconnect = () => {
      if (reconnectTimeoutRef.current) {
        return;
      }

      const attempt = reconnectAttemptsRef.current + 1;
      const delay = Math.min(30000, attempt * 5000);
      console.log(`[AnomalyFeed] Scheduling realtime reconnect attempt #${attempt} in ${delay}ms`);

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        reconnectAttemptsRef.current = attempt;
        setupRealtimeSubscription();
      }, delay);
    };

    const scheduleRefetch = () => {
      if (refetchDebounceRef.current) {
        return;
      }
      refetchDebounceRef.current = setTimeout(() => {
        refetchDebounceRef.current = null;
        fetchAnomalies();
      }, 500);
    };

    async function setupRealtimeSubscription() {
      if (!isActive) {
        return;
      }

      if (!autoRefresh) {
        console.log('[AnomalyFeed] Live updates disabled');
        clearReconnectTimeout();
        stopFallbackPolling();
        await cleanupChannel();
        return;
      }

      clearReconnectTimeout();
      stopFallbackPolling();
      await cleanupChannel();

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const userId = session?.user?.id;
        if (!userId) {
          console.warn('[AnomalyFeed] No session; cannot subscribe to realtime');
          return;
        }

        const channelName = `anomaly-feed-${userId}-${Date.now()}`;
        channelRef.current = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'anomaly_detections',
              filter: `user_id=eq.${userId}`,
            },
            () => {
              scheduleRefetch();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'anomaly_detections',
              filter: `user_id=eq.${userId}`,
            },
            () => {
              scheduleRefetch();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'anomaly_detections',
              filter: `user_id=eq.${userId}`,
            },
            () => {
              scheduleRefetch();
            }
          )
          .subscribe((status, err) => {
            if (!isActive) {
              return;
            }

            if (status === 'SUBSCRIBED') {
              reconnectAttemptsRef.current = 0;
              stopFallbackPolling();
              clearReconnectTimeout();
              console.log('[AnomalyFeed] ✅ Realtime subscribed');
              return;
            }

            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              const message = (err && typeof err === 'object')
                ? ((err as { message?: string }).message || JSON.stringify(err))
                : (err || 'Realtime connection failed');
              console.error('[AnomalyFeed] ❌ Realtime connection issue:', status, message);
              startFallbackPolling();
              scheduleReconnect();
            }
          });
      } catch (err) {
        console.error('[AnomalyFeed] Failed to set up realtime:', err);
        startFallbackPolling();
        scheduleReconnect();
      }
    }

    setupRealtimeSubscription();

    return () => {
      isActive = false;
      clearReconnectTimeout();
      stopFallbackPolling();
      if (refetchDebounceRef.current) {
        clearTimeout(refetchDebounceRef.current);
        refetchDebounceRef.current = null;
      }
      void cleanupChannel();
    };
  }, [autoRefresh, refreshInterval, fetchAnomalies]);

  // Get severity icon and color
  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
      case 'high':
        return { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' };
      case 'medium':
        return { icon: AlertCircle, color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' };
      case 'low':
        return { icon: Info, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' };
      default:
        return { icon: Activity, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };
    }
  };

  // Acknowledge anomaly
  const handleAcknowledge = async (anomalyId: string) => {
    try {
      console.log('[AnomalyFeed] Acknowledging anomaly:', anomalyId);

      // [AUTH_DEBUG] Get session with detailed logging
      console.log('[AnomalyFeed] Retrieving session for acknowledgment...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[AnomalyFeed] Session error during acknowledge:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session) {
        console.error('[AnomalyFeed] No session found during acknowledge');
        throw new Error('Not authenticated. Please log in.');
      }

      console.log('[AnomalyFeed] Session found for acknowledge, user:', session.user?.id);

      const response = await fetch('/api/analytics/anomalies', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          anomaly_id: anomalyId,
          acknowledged: true,
          resolution_status: 'investigating'
        }),
      });

      // [AUTH_DEBUG] Improved error handling
      if (!response.ok) {
        let errorMessage = `Failed to acknowledge anomaly: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = `API Error (${response.status}): ${errorData.error}`;
          }
        } catch {
          // Response wasn't JSON
        }
        console.error('[AnomalyFeed] Acknowledge failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('[AnomalyFeed] Anomaly acknowledged successfully');
      await fetchAnomalies();
    } catch (err) {
      console.error('[AnomalyFeed] Acknowledge error:', err);
    }
  };

  // Navigate to trace
  const handleViewTrace = (traceId: string) => {
    console.log('[AnomalyFeed] Navigating to trace:', traceId);
    router.push(`/analytics/traces?trace_id=${traceId}`);
  };

  // Update anomaly resolution
  const handleUpdateResolution = async (anomalyId: string) => {
    try {
      console.log('[AnomalyFeed] Updating resolution for anomaly:', anomalyId);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Not authenticated');
      }

      const updateData: Record<string, unknown> = {
        resolution_status: resolutionStatus,
      };

      if (resolutionNotes) updateData.resolution_notes = resolutionNotes;
      if (rootCause) updateData.root_cause = rootCause;
      if (linkedAnomalyIds.length > 0) updateData.linked_anomalies = linkedAnomalyIds;

      if (resolutionStatus === 'resolved' || resolutionStatus === 'false_positive') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = session.user.id;
      }

      const response = await fetch('/api/analytics/anomalies', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          anomaly_id: anomalyId,
          ...updateData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update resolution');
      }

      console.log('[AnomalyFeed] Resolution updated successfully');

      // Reset form and close
      setShowResolution(false);
      setResolutionStatus('');
      setResolutionNotes('');
      setRootCause('');
      setLinkedAnomalyIds([]);

      await fetchAnomalies();
    } catch (err) {
      console.error('[AnomalyFeed] Resolution update error:', err);
      alert(err instanceof Error ? err.message : 'Failed to update resolution');
    }
  };

  // Open resolution panel
  const openResolutionPanel = (anomaly: Anomaly) => {
    setResolutionStatus(anomaly.resolution_status || 'pending');
    setResolutionNotes(anomaly.resolution_notes || '');
    setRootCause(anomaly.root_cause || '');
    setLinkedAnomalyIds(anomaly.linked_anomalies || []);
    setShowResolution(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Anomaly Feed</h3>
        <button
          onClick={fetchAnomalies}
          disabled={loading}
          className="text-sm px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && anomalies.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-600">
          Loading anomalies...
        </div>
      )}

      {!loading && anomalies.length === 0 && !error && (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <div className="text-sm text-gray-600">No anomalies detected</div>
          <div className="text-xs text-gray-500 mt-1">All metrics are within expected ranges</div>
        </div>
      )}

      <div className="space-y-2">
        {anomalies.map((anomaly) => {
          const severityConfig = getSeverityConfig(anomaly.severity);
          const SeverityIcon = severityConfig.icon;

          return (
            <div
              key={anomaly.id}
              className={`border ${severityConfig.borderColor} ${severityConfig.bgColor} rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => setSelectedAnomaly(anomaly)}
            >
              <div className="flex items-start gap-3">
                <SeverityIcon className={`w-5 h-5 ${severityConfig.color} flex-shrink-0 mt-0.5`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium uppercase ${severityConfig.color}`}>
                      {anomaly.severity}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(anomaly.detected_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-gray-900 mb-1">
                    {anomaly.metric_name}
                  </div>

                  <div className="text-sm text-gray-700 mb-2">
                    {anomaly.description}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>Type: {anomaly.anomaly_type.replace(/_/g, ' ')}</span>
                    <span>Confidence: {(anomaly.confidence_score * 100).toFixed(0)}%</span>
                    <span>Deviation: {anomaly.deviation_percentage.toFixed(1)}%</span>
                  </div>

                  {!anomaly.acknowledged && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAcknowledge(anomaly.id);
                      }}
                      className="mt-2 text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedAnomaly && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setSelectedAnomaly(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Anomaly Details</h3>
              <div className="flex items-center gap-2">
                {selectedAnomaly.statistics?.trace_id ? (
                  <button
                    onClick={() => handleViewTrace(selectedAnomaly.statistics.trace_id as string)}
                    className="text-sm px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Trace
                  </button>
                ) : null}
                <button
                  onClick={() => openResolutionPanel(selectedAnomaly)}
                  className="text-sm px-3 py-1 bg-green-600 text-white hover:bg-green-700 rounded"
                >
                  {showResolution ? 'Hide Resolution' : 'Resolve'}
                </button>
                <button
                  onClick={() => setSelectedAnomaly(null)}
                  className="text-sm px-3 py-1 hover:bg-gray-100 rounded"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Metric</div>
                <div className="text-sm font-medium">{selectedAnomaly.metric_name}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Description</div>
                <div className="text-sm">{selectedAnomaly.description}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Detected Value</div>
                  <div className="text-sm font-medium">{selectedAnomaly.detected_value.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Expected Value</div>
                  <div className="text-sm">{selectedAnomaly.expected_value.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Threshold</div>
                  <div className="text-sm">{selectedAnomaly.threshold_value.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Deviation</div>
                  <div className="text-sm">{selectedAnomaly.deviation_percentage.toFixed(1)}%</div>
                </div>
              </div>

              {selectedAnomaly.contributing_factors && selectedAnomaly.contributing_factors.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Contributing Factors</div>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    {selectedAnomaly.contributing_factors.map((factor, idx) => (
                      <li key={idx}>{factor}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedAnomaly.recommended_actions && selectedAnomaly.recommended_actions.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Recommended Actions</div>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    {selectedAnomaly.recommended_actions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resolution Panel */}
              {showResolution && (
                <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-green-900">Resolution Workflow</h4>

                  {/* Status Dropdown */}
                  <div>
                    <label className="text-xs text-gray-700 font-medium mb-1 block">Status</label>
                    <select
                      value={resolutionStatus}
                      onChange={(e) => setResolutionStatus(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                    >
                      <option value="pending">Pending</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                      <option value="false_positive">False Positive</option>
                    </select>
                  </div>

                  {/* Root Cause */}
                  <div>
                    <label className="text-xs text-gray-700 font-medium mb-1 block">Root Cause</label>
                    <input
                      type="text"
                      value={rootCause}
                      onChange={(e) => setRootCause(e.target.value)}
                      placeholder="e.g., Model timeout, High load, Configuration issue"
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                    />
                  </div>

                  {/* Resolution Notes */}
                  <div>
                    <label className="text-xs text-gray-700 font-medium mb-1 block">Resolution Notes</label>
                    <textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Describe the investigation, actions taken, and outcome..."
                      rows={3}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                    />
                  </div>

                  {/* Linked Anomalies */}
                  <div>
                    <label className="text-xs text-gray-700 font-medium mb-1 block">
                      Linked Anomalies (comma-separated IDs)
                    </label>
                    <input
                      type="text"
                      value={linkedAnomalyIds.join(', ')}
                      onChange={(e) => setLinkedAnomalyIds(e.target.value.split(',').map(id => id.trim()).filter(Boolean))}
                      placeholder="e.g., 123, 456, 789"
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">Link related anomalies with the same root cause</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleUpdateResolution(selectedAnomaly.id)}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                    >
                      Save Resolution
                    </button>
                    <button
                      onClick={() => setShowResolution(false)}
                      className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Current Resolution Info */}
              {(selectedAnomaly.resolved_at || selectedAnomaly.resolution_notes || selectedAnomaly.root_cause) && !showResolution && (
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
                  <h4 className="font-semibold text-sm text-blue-900">Resolution History</h4>

                  {selectedAnomaly.root_cause && (
                    <div>
                      <div className="text-xs text-gray-600 font-medium">Root Cause:</div>
                      <div className="text-sm text-gray-900">{selectedAnomaly.root_cause}</div>
                    </div>
                  )}

                  {selectedAnomaly.resolution_notes && (
                    <div>
                      <div className="text-xs text-gray-600 font-medium">Notes:</div>
                      <div className="text-sm text-gray-900">{selectedAnomaly.resolution_notes}</div>
                    </div>
                  )}

                  {selectedAnomaly.resolved_at && (
                    <div className="text-xs text-gray-600">
                      Resolved: {new Date(selectedAnomaly.resolved_at).toLocaleString()}
                    </div>
                  )}

                  {selectedAnomaly.linked_anomalies && selectedAnomaly.linked_anomalies.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-600 font-medium">Linked Anomalies:</div>
                      <div className="text-sm text-gray-900">{selectedAnomaly.linked_anomalies.join(', ')}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span className="font-medium capitalize">{selectedAnomaly.resolution_status}</span>
                </div>
                <div>
                  <span className="text-gray-500">Acknowledged:</span>{' '}
                  <span className="font-medium">{selectedAnomaly.acknowledged ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}