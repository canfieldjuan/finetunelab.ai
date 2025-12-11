// Baseline Manager UI Component
// Purpose: Create, edit, and manage model baselines for regression detection
// Phase: Phase 4 - Regression Gates
// Date: 2025-10-28

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Plus, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type {
  Baseline,
  ThresholdType,
  MetricCategory,
  Severity,
} from '@/lib/services/baseline-manager';
import { BaselinesList } from './BaselinesList';

// ============================================================================
// Types
// ============================================================================

interface BaselineFormData {
  modelName: string;
  metricName: string;
  metricCategory: MetricCategory;
  baselineValue: string;
  thresholdType: ThresholdType;
  thresholdValue: string;
  severity: Severity;
  description: string;
}

interface BaselineManagerUIProps {
  modelName?: string; // Pre-fill model name if provided
  onBaselineCreated?: (baseline: Baseline) => void;
}

// ============================================================================
// Component
// ============================================================================

export function BaselineManagerUI({ modelName, onBaselineCreated }: BaselineManagerUIProps) {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<BaselineFormData>({
    modelName: modelName || '',
    metricName: '',
    metricCategory: 'accuracy',
    baselineValue: '',
    thresholdType: 'min',
    thresholdValue: '0',
    severity: 'critical',
    description: '',
  });

  console.log('[BaselineManagerUI] Rendering. Model:', modelName);

  // Load baselines on mount
  useEffect(() => {
    if (modelName) {
      loadBaselines(modelName);
    }
  }, [modelName]);

  const loadBaselines = async (model: string) => {
    console.log('[BaselineManagerUI] Loading baselines for:', model);
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `/api/training/baselines?modelName=${encodeURIComponent(model)}`,
        {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load baselines');
      }

      const data = await response.json();
      console.log('[BaselineManagerUI] Loaded', data.baselines.length, 'baselines');
      setBaselines(data.baselines);
    } catch (err) {
      console.error('[BaselineManagerUI] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load baselines');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBaseline = async () => {
    console.log('[BaselineManagerUI] Saving baseline:', formData);
    setSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/training/baselines', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelName: formData.modelName,
          metricName: formData.metricName,
          metricCategory: formData.metricCategory,
          baselineValue: parseFloat(formData.baselineValue),
          thresholdType: formData.thresholdType,
          thresholdValue: parseFloat(formData.thresholdValue),
          severity: formData.severity,
          description: formData.description || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create baseline');
      }

      const result = await response.json();
      console.log('[BaselineManagerUI] Baseline created:', result.baseline.id);

      // Refresh list
      await loadBaselines(formData.modelName);

      // Close form
      setShowForm(false);

      // Reset form
      setFormData({
        modelName: modelName || '',
        metricName: '',
        metricCategory: 'accuracy',
        baselineValue: '',
        thresholdType: 'min',
        thresholdValue: '0',
        severity: 'critical',
        description: '',
      });

      // Notify parent
      onBaselineCreated?.(result.baseline);
    } catch (err) {
      console.error('[BaselineManagerUI] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save baseline');
    } finally {
      setSaving(false);
    }
  };

  const handleBaselineDeleted = (id: string) => {
    console.log('[BaselineManagerUI] Baseline deleted:', id);
    setBaselines(baselines.filter(b => b.id !== id));
  };

  return (
    <Card className="shadow-none border border-border/80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Regression Gates</CardTitle>
            <CardDescription>
              Configure baselines to prevent bad models from reaching production
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? 'outline' : 'default'}
          >
            {showForm ? (
              <>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Baseline
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-4 text-sm text-gray-600">
            Loading baselines...
          </div>
        )}

        {!loading && baselines.length === 0 && !showForm && (
          <div className="text-center py-8 text-sm text-gray-600">
            No baselines configured yet. Click &quot;Add Baseline&quot; to create one.
          </div>
        )}

        {showForm && (
          <div className="space-y-4 mb-6 p-4 border rounded-lg bg-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="modelName">Model Name *</Label>
                <Input
                  id="modelName"
                  value={formData.modelName}
                  onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                  placeholder="e.g., gpt-4-training"
                />
              </div>
              <div>
                <Label htmlFor="metricName">Metric Name *</Label>
                <Input
                  id="metricName"
                  value={formData.metricName}
                  onChange={(e) => setFormData({ ...formData, metricName: e.target.value })}
                  placeholder="e.g., accuracy"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="metricCategory">Metric Category *</Label>
                <Select
                  value={formData.metricCategory}
                  onValueChange={(value: MetricCategory) =>
                    setFormData({ ...formData, metricCategory: value })
                  }
                >
                  <SelectTrigger id="metricCategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accuracy">Accuracy</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="baselineValue">Baseline Value *</Label>
                <Input
                  id="baselineValue"
                  type="number"
                  step="0.01"
                  value={formData.baselineValue}
                  onChange={(e) => setFormData({ ...formData, baselineValue: e.target.value })}
                  placeholder="e.g., 0.85"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="thresholdType">Threshold Type *</Label>
                <Select
                  value={formData.thresholdType}
                  onValueChange={(value: ThresholdType) =>
                    setFormData({ ...formData, thresholdType: value })
                  }
                >
                  <SelectTrigger id="thresholdType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="min">Min (must be &gt;=)</SelectItem>
                    <SelectItem value="max">Max (must be &lt;=)</SelectItem>
                    <SelectItem value="delta">Delta (± range)</SelectItem>
                    <SelectItem value="ratio">Ratio (proportional)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="thresholdValue">Threshold Value *</Label>
                <Input
                  id="thresholdValue"
                  type="number"
                  step="0.01"
                  value={formData.thresholdValue}
                  onChange={(e) => setFormData({ ...formData, thresholdValue: e.target.value })}
                  placeholder="e.g., 0.02"
                />
              </div>
              <div>
                <Label htmlFor="severity">Severity *</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(value: Severity) =>
                    setFormData({ ...formData, severity: value })
                  }
                >
                  <SelectTrigger id="severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical (blocks)</SelectItem>
                    <SelectItem value="warning">Warning (alerts)</SelectItem>
                    <SelectItem value="info">Info (logs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Minimum accuracy threshold for production"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveBaseline}
                disabled={
                  saving ||
                  !formData.modelName ||
                  !formData.metricName ||
                  !formData.baselineValue ||
                  !formData.thresholdValue
                }
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Baseline'}
              </Button>
            </div>
          </div>
        )}

        {!loading && baselines.length > 0 && (
          <BaselinesList
            baselines={baselines}
            onDelete={handleBaselineDeleted}
          />
        )}
      </CardContent>
    </Card>
  );
}
