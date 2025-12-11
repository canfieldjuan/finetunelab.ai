/**
 * ExperimentManager Component
 *
 * Manages A/B testing experiments with creation, editing, and monitoring
 *
 * Phase 1.4: Experimentation UI
 * Date: 2025-10-25
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  Plus,
  Edit,
  Trash2,
  BarChart3,
  Users,
  Target,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface ExperimentVariant {
  id: string;
  name: string;
  description: string;
  is_control: boolean;
  traffic_percentage: number;
  total_sessions: number;
  successful_sessions: number;
  average_rating?: number;
  conversion_rate?: number;
  configuration: Record<string, unknown>;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  experiment_type: string;
  primary_metric: string;
  secondary_metrics: string[];
  traffic_percentage: number;
  start_date?: string;
  end_date?: string;
  winner_variant_id?: string;
  statistical_significance?: number;
  confidence_level?: number;
  created_at: string;
  ab_experiment_variants: ExperimentVariant[];
}

interface ExperimentManagerProps {
  onExperimentSelect?: (experiment: Experiment) => void;
}

export default function ExperimentManager({ onExperimentSelect }: ExperimentManagerProps) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch experiments
  const fetchExperiments = async () => {
    try {
      console.log('[ExperimentManager] Fetching experiments...');
      setLoading(true);

      // [AUTH_DEBUG] Get session with detailed logging
      console.log('[ExperimentManager] Retrieving session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[ExperimentManager] Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session) {
        console.error('[ExperimentManager] No session found - user not authenticated');
        throw new Error('Not authenticated. Please log in.');
      }

      // [AUTH_DEBUG] Log session details (safe info only)
      console.log('[ExperimentManager] Session found:', {
        user_id: session.user?.id,
        token_prefix: session.access_token.substring(0, 10) + '...',
        token_length: session.access_token.length,
        expires_at: session.expires_at
      });

      console.log('[ExperimentManager] Fetching with auth token...');
      const response = await fetch('/api/analytics/experiments', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      // [AUTH_DEBUG] Improved error handling with API error message
      if (!response.ok) {
        let errorMessage = `Failed to fetch experiments: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = `API Error (${response.status}): ${errorData.error}`;
          }
        } catch {
          // Response wasn't JSON
        }
        console.error('[ExperimentManager] API request failed:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setExperiments(result.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  // Update experiment status
  const updateExperimentStatus = async (experimentId: string, newStatus: string) => {
    try {
      console.log('[ExperimentManager] Updating experiment status:', experimentId, 'to', newStatus);

      // [AUTH_DEBUG] Get session with detailed logging
      console.log('[ExperimentManager] Retrieving session for update...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[ExperimentManager] Session error during update:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session) {
        console.error('[ExperimentManager] No session found during update');
        throw new Error('Not authenticated. Please log in.');
      }

      console.log('[ExperimentManager] Session found for update, user:', session.user?.id);

      const response = await fetch('/api/analytics/experiments', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          experiment_id: experimentId,
          status: newStatus,
        }),
      });

      // [AUTH_DEBUG] Improved error handling
      if (!response.ok) {
        let errorMessage = `Failed to update experiment: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = `API Error (${response.status}): ${errorData.error}`;
          }
        } catch {
          // Response wasn't JSON
        }
        console.error('[ExperimentManager] Update failed:', errorMessage);
        throw new Error(errorMessage);
      }

      // Refresh experiments list
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update experiment');
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      running: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Calculate experiment performance
  const getExperimentMetrics = (experiment: Experiment) => {
    const totalSessions = experiment.ab_experiment_variants.reduce(
      (sum, variant) => sum + variant.total_sessions, 0
    );

    const averageConversion = experiment.ab_experiment_variants
      .reduce((sum, variant) => sum + (variant.conversion_rate || 0), 0) /
      experiment.ab_experiment_variants.length;

    const winner = experiment.winner_variant_id
      ? experiment.ab_experiment_variants.find(v => v.id === experiment.winner_variant_id)
      : null;

    return {
      totalSessions,
      averageConversion: averageConversion * 100,
      winner: winner?.name,
      significance: experiment.statistical_significance || 0,
    };
  };

  // Render experiment card
  const renderExperimentCard = (experiment: Experiment) => {
    const metrics = getExperimentMetrics(experiment);

    return (
      <div
        key={experiment.id}
        className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer ${
          selectedExperiment?.id === experiment.id ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => {
          setSelectedExperiment(experiment);
          onExperimentSelect?.(experiment);
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-lg">{experiment.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{experiment.description}</p>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(experiment.status)}`}>
            {experiment.status}
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Sessions</span>
            </div>
            <p className="font-semibold">{metrics.totalSessions}</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Conversion</span>
            </div>
            <p className="font-semibold">{metrics.averageConversion.toFixed(1)}%</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Target className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Confidence</span>
            </div>
            <p className="font-semibold">{(metrics.significance * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* Variants preview */}
        <div className="flex flex-wrap gap-2 mb-3">
          {experiment.ab_experiment_variants.map((variant) => (
            <span
              key={variant.id}
              className={`px-2 py-1 rounded text-xs ${
                variant.is_control
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {variant.name} ({variant.traffic_percentage}%)
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {experiment.status === 'draft' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateExperimentStatus(experiment.id, 'running');
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
              >
                <Play className="h-3 w-3" />
                Start
              </button>
            )}

            {experiment.status === 'running' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateExperimentStatus(experiment.id, 'paused');
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                >
                  <Pause className="h-3 w-3" />
                  Pause
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateExperimentStatus(experiment.id, 'completed');
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                >
                  <Square className="h-3 w-3" />
                  Stop
                </button>
              </>
            )}

            {experiment.status === 'paused' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateExperimentStatus(experiment.id, 'running');
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
              >
                <Play className="h-3 w-3" />
                Resume
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implement edit modal
              }}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implement delete functionality
              }}
              className="p-1 text-gray-500 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Winner banner */}
        {metrics.winner && experiment.status === 'completed' && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Winner: {metrics.winner}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Main render
  return (
    <div className="experiment-manager">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">A/B Testing Experiments</h2>
          <p className="text-gray-600 mt-1">
            Create and manage experiments to optimize your AI models
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Experiment
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Experiments grid */}
          {experiments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {experiments.map(renderExperimentCard)}
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No experiments yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first A/B test to start optimizing your AI models
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create Experiment
              </button>
            </div>
          )}
        </>
      )}

      {/* Selected experiment details */}
      {selectedExperiment && (
        <div className="mt-8 bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Experiment Details</h3>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Configuration</h4>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-600">Type:</dt>
                  <dd className="font-medium">{selectedExperiment.experiment_type}</dd>
                </div>
                <div>
                  <dt className="text-gray-600">Primary Metric:</dt>
                  <dd className="font-medium">{selectedExperiment.primary_metric}</dd>
                </div>
                <div>
                  <dt className="text-gray-600">Traffic:</dt>
                  <dd className="font-medium">{selectedExperiment.traffic_percentage}%</dd>
                </div>
              </dl>
            </div>

            <div>
              <h4 className="font-medium mb-2">Hypothesis</h4>
              <p className="text-sm text-gray-700">{selectedExperiment.hypothesis}</p>
            </div>
          </div>

          {/* Variants breakdown */}
          <div className="mt-6">
            <h4 className="font-medium mb-3">Variants Performance</h4>
            <div className="space-y-3">
              {selectedExperiment.ab_experiment_variants.map((variant) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div>
                    <span className="font-medium">{variant.name}</span>
                    {variant.is_control && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                        Control
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{variant.total_sessions} sessions</span>
                    <span>{((variant.conversion_rate || 0) * 100).toFixed(1)}% conversion</span>
                    <span>{variant.traffic_percentage}% traffic</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TODO: Create experiment modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Create New Experiment</h3>
            <p className="text-gray-600 mb-4">
              Experiment creation form will be implemented in the next phase.
            </p>
            <button
              onClick={() => setShowCreateModal(false)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}