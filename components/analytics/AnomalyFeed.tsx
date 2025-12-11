/**
 * AnomalyFeed Component
 *
 * Displays real-time feed of detected anomalies with severity indicators
 * and actionable recommendations
 *
 * Phase 2.3: Anomaly Feed UI
 * Date: 2025-10-25
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

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
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

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

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) {
      console.log('[AnomalyFeed] Auto-refresh disabled');
      return;
    }

    console.log('[AnomalyFeed] Setting up auto-refresh, interval:', refreshInterval);
    const interval = setInterval(fetchAnomalies, refreshInterval);

    return () => {
      console.log('[AnomalyFeed] Clearing auto-refresh interval');
      clearInterval(interval);
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
          resolution_status: 'acknowledged'
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
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="text-sm px-3 py-1 hover:bg-gray-100 rounded"
              >
                Close
              </button>
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

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span className="font-medium">{selectedAnomaly.resolution_status}</span>
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