// Baselines List Component
// Purpose: Display table of configured baselines with actions
// Phase: Phase 4 - Regression Gates
// Date: 2025-10-28

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import type { Baseline } from '@/lib/services/baseline-manager';
import { supabase } from '@/lib/supabaseClient';

interface BaselinesListProps {
  baselines: Baseline[];
  onDelete: (id: string) => void;
}

export function BaselinesList({ baselines, onDelete }: BaselinesListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  console.log('[BaselinesList] Rendering', baselines.length, 'baselines');

  const handleDelete = async (baseline: Baseline) => {
    if (!confirm(`Delete baseline for ${baseline.metricName}?`)) {
      return;
    }

    console.log('[BaselinesList] Deleting baseline:', baseline.id);
    setDeleting(baseline.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `/api/training/baselines?id=${baseline.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete baseline');
      }

      console.log('[BaselinesList] Baseline deleted');
      onDelete(baseline.id);
    } catch (err) {
      console.error('[BaselinesList] Delete error:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (severity) {
      case 'critical':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'warning':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'info':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return baseClasses;
    }
  };

  const getThresholdDisplay = (baseline: Baseline) => {
    switch (baseline.thresholdType) {
      case 'min':
        return `>= ${baseline.baselineValue}`;
      case 'max':
        return `<= ${baseline.baselineValue}`;
      case 'delta':
        return `${baseline.baselineValue} ± ${baseline.thresholdValue}`;
      case 'ratio':
        return `>= ${(baseline.baselineValue * (1 - baseline.thresholdValue)).toFixed(2)}`;
      default:
        return baseline.baselineValue;
    }
  };

  if (baselines.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium mb-3">Configured Baselines ({baselines.length})</h3>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2">Metric</th>
              <th className="text-left px-4 py-2">Category</th>
              <th className="text-left px-4 py-2">Threshold</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Severity</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {baselines.map((baseline) => (
              <tr key={baseline.id} className="border-b last:border-b-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{baseline.metricName}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">
                  {baseline.metricCategory}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {getThresholdDisplay(baseline)}
                </td>
                <td className="px-4 py-3 capitalize">{baseline.thresholdType}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(baseline.severity)}
                    <span className={getSeverityBadge(baseline.severity)}>
                      {baseline.severity}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(baseline)}
                    disabled={deleting === baseline.id}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
