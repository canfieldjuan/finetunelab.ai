// Validation History View Component
// Purpose: Display timeline of validation results with pass/fail status and metric comparisons
// Phase: Phase 4 - Regression Gates
// Date: 2025-10-28

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type {
  ValidationResult,
  ValidationStatus,
  BaselineComparison,
} from '@/lib/services/baseline-manager';

// ============================================================================
// Types
// ============================================================================

interface ValidationHistoryViewProps {
  modelName?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

// ============================================================================
// Component
// ============================================================================

export function ValidationHistoryView({
  modelName,
  autoRefresh = false,
  refreshInterval = 30000,
}: ValidationHistoryViewProps) {
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(modelName || '');
  const [limit, setLimit] = useState<string>('10');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  console.log('[ValidationHistoryView] Rendering. Model:', selectedModel);

  // Load validations on mount and when model changes
  useEffect(() => {
    if (selectedModel) {
      loadValidations(selectedModel, parseInt(limit, 10));
    }
  }, [selectedModel, limit]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !selectedModel) {
      return;
    }

    const intervalId = setInterval(() => {
      console.log('[ValidationHistoryView] Auto-refreshing validations');
      loadValidations(selectedModel, parseInt(limit, 10));
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, selectedModel, limit, refreshInterval]);

  const loadValidations = async (model: string, resultLimit: number) => {
    console.log('[ValidationHistoryView] Loading validations for:', model, 'limit:', resultLimit);
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `/api/training/validations?modelName=${encodeURIComponent(model)}&limit=${resultLimit}`,
        {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load validations');
      }

      const data = await response.json();
      console.log('[ValidationHistoryView] Loaded', data.validations.length, 'validations');
      setValidations(data.validations);
    } catch (err) {
      console.error('[ValidationHistoryView] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load validations');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (selectedModel) {
      loadValidations(selectedModel, parseInt(limit, 10));
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStatusIcon = (status: ValidationStatus) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: ValidationStatus) => {
    const baseClasses = 'px-3 py-1 text-sm font-medium rounded-full';
    switch (status) {
      case 'passed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'warning':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getComparisonIcon = (comparison: BaselineComparison) => {
    if (comparison.passed) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (comparison.severity === 'critical') {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
    if (comparison.severity === 'warning') {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
    return <Info className="h-4 w-4 text-blue-600" />;
  };

  return (
    <Card className="shadow-none border border-border/80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Validation History</CardTitle>
            <CardDescription>
              View past validation results and metric comparisons
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={loading || !selectedModel}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 grid grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50">
          <div>
            <Label htmlFor="modelFilter">Model Name</Label>
            <Input
              id="modelFilter"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder="e.g., gpt-4-training"
              disabled={!!modelName} // Disable if pre-filled
            />
          </div>
          <div>
            <Label htmlFor="limitFilter">Results Limit</Label>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger id="limitFilter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 results</SelectItem>
                <SelectItem value="10">10 results</SelectItem>
                <SelectItem value="20">20 results</SelectItem>
                <SelectItem value="50">50 results</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8 text-sm text-gray-600">
            <RefreshCw className="inline h-5 w-5 animate-spin mr-2" />
            Loading validations...
          </div>
        )}

        {!loading && validations.length === 0 && selectedModel && (
          <div className="text-center py-8 text-sm text-gray-600">
            <Calendar className="inline h-8 w-8 mb-2 text-gray-400" />
            <p>No validation history found for this model.</p>
            <p className="mt-2 text-xs text-gray-500">
              Validations are created when models are evaluated against baselines.
            </p>
          </div>
        )}

        {!loading && !selectedModel && (
          <div className="text-center py-8 text-sm text-gray-600">
            <AlertCircle className="inline h-8 w-8 mb-2 text-gray-400" />
            <p>Enter a model name to view validation history.</p>
          </div>
        )}

        {/* Validation Timeline */}
        {!loading && validations.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium mb-3">
              Validation Timeline ({validations.length})
            </h3>
            {validations.map((validation) => (
              <div
                key={validation.id}
                className="border rounded-lg overflow-hidden"
              >
                {/* Validation Header */}
                <div
                  className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleExpanded(validation.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(validation.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={getStatusBadge(validation.status)}>
                            {validation.status.toUpperCase()}
                          </span>
                          {validation.modelVersion && (
                            <span className="text-xs text-gray-500">
                              v{validation.modelVersion}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(validation.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {validation.baselineComparisons.length} metrics checked
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === validation.id && (
                  <div className="p-4 border-t">
                    {/* Failures */}
                    {validation.failures.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Critical Failures ({validation.failures.length})
                        </h4>
                        <ul className="space-y-1">
                          {validation.failures.map((failure, idx) => (
                            <li key={idx} className="text-sm text-red-600 pl-6">
                              • {failure}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Warnings */}
                    {validation.warnings.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-yellow-700 mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Warnings ({validation.warnings.length})
                        </h4>
                        <ul className="space-y-1">
                          {validation.warnings.map((warning, idx) => (
                            <li key={idx} className="text-sm text-yellow-600 pl-6">
                              • {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Metric Comparisons */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Metric Comparisons</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left px-3 py-2">Status</th>
                              <th className="text-left px-3 py-2">Metric</th>
                              <th className="text-right px-3 py-2">Actual</th>
                              <th className="text-right px-3 py-2">Baseline</th>
                              <th className="text-left px-3 py-2">Threshold</th>
                            </tr>
                          </thead>
                          <tbody>
                            {validation.baselineComparisons.map((comparison, idx) => (
                              <tr
                                key={idx}
                                className={`border-b last:border-b-0 ${
                                  !comparison.passed ? 'bg-red-50' : ''
                                }`}
                              >
                                <td className="px-3 py-2">
                                  {getComparisonIcon(comparison)}
                                </td>
                                <td className="px-3 py-2 font-medium">
                                  {comparison.metricName}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs">
                                  {comparison.actualValue.toFixed(4)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs">
                                  {comparison.baselineValue.toFixed(4)}
                                </td>
                                <td className="px-3 py-2 capitalize text-gray-600">
                                  {comparison.thresholdType}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
