// Scheduled Evaluation Form Component
// Purpose: Create/edit scheduled batch test evaluations
// Date: 2025-12-16

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { ScheduledEvaluation, ScheduleType } from '@/lib/batch-testing/types';

interface Model {
  id: string;
  name: string;
}

interface TestSuite {
  id: string;
  name: string;
  prompt_count: number;
}

interface ScheduledEvaluationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleToEdit?: ScheduledEvaluation | null;
  onSaved: () => void;
}

export function ScheduledEvaluationForm({
  open,
  onOpenChange,
  scheduleToEdit,
  onSaved,
}: ScheduledEvaluationFormProps) {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('daily');
  const [cronExpression, setCronExpression] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [testSuiteId, setTestSuiteId] = useState('');
  const [modelId, setModelId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [alertOnFailure, setAlertOnFailure] = useState(true);
  const [alertOnRegression, setAlertOnRegression] = useState(false);
  const [regressionThreshold, setRegressionThreshold] = useState(10);

  // Batch test config
  const [promptLimit, setPromptLimit] = useState(25);
  const [concurrency, setConcurrency] = useState(1);
  const [delayMs, setDelayMs] = useState(1000);

  // Data state
  const [models, setModels] = useState<Model[]>([]);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load models and test suites
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (scheduleToEdit) {
      setName(scheduleToEdit.name);
      setDescription(scheduleToEdit.description || '');
      setScheduleType(scheduleToEdit.schedule_type);
      setCronExpression(scheduleToEdit.cron_expression || '');
      setTimezone(scheduleToEdit.timezone);
      setTestSuiteId(scheduleToEdit.test_suite_id);
      setModelId(scheduleToEdit.model_id);
      setIsActive(scheduleToEdit.is_active);
      setAlertOnFailure(scheduleToEdit.alert_on_failure);
      setAlertOnRegression(scheduleToEdit.alert_on_regression);
      setRegressionThreshold(scheduleToEdit.regression_threshold_percent);

      const config = scheduleToEdit.batch_test_config;
      if (config) {
        setPromptLimit(config.prompt_limit || 25);
        setConcurrency(config.concurrency || 1);
        setDelayMs(config.delay_ms || 1000);
      }
    } else {
      resetForm();
    }
  }, [scheduleToEdit, open]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setScheduleType('daily');
    setCronExpression('');
    setTimezone('UTC');
    setTestSuiteId('');
    setModelId('');
    setIsActive(true);
    setAlertOnFailure(true);
    setAlertOnRegression(false);
    setRegressionThreshold(10);
    setPromptLimit(25);
    setConcurrency(1);
    setDelayMs(1000);
    setError(null);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      // Load models
      const modelsResponse = await fetch('/api/models', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        setModels(modelsData.models || []);
      }

      // Load test suites
      const suitesResponse = await fetch('/api/test-suites', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (suitesResponse.ok) {
        const suitesData = await suitesResponse.json();
        setTestSuites(suitesData.testSuites || []);
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load models and test suites');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validation
      if (!name.trim()) {
        setError('Name is required');
        return;
      }

      if (!testSuiteId) {
        setError('Test suite is required');
        return;
      }

      if (!modelId) {
        setError('Model is required');
        return;
      }

      if (scheduleType === 'custom' && !cronExpression.trim()) {
        setError('Cron expression is required for custom schedules');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        schedule_type: scheduleType,
        cron_expression: scheduleType === 'custom' ? cronExpression.trim() : undefined,
        timezone,
        test_suite_id: testSuiteId,
        model_id: modelId,
        is_active: isActive,
        alert_on_failure: alertOnFailure,
        alert_on_regression: alertOnRegression,
        regression_threshold_percent: regressionThreshold,
        batch_test_config: {
          prompt_limit: promptLimit,
          concurrency,
          delay_ms: delayMs,
        },
      };

      const url = scheduleToEdit
        ? `/api/scheduled-evaluations/${scheduleToEdit.id}`
        : '/api/scheduled-evaluations';

      const method = scheduleToEdit ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save scheduled evaluation');
      }

      onSaved();
      onOpenChange(false);
      resetForm();

    } catch (err) {
      console.error('Error saving schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {scheduleToEdit ? 'Edit Scheduled Evaluation' : 'Create Scheduled Evaluation'}
          </DialogTitle>
          <DialogDescription>
            Configure a recurring batch test evaluation to monitor model performance
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Hourly Quality Check"
                disabled={loading || saving}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Monitor model quality every hour"
                disabled={loading || saving}
                rows={2}
              />
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="space-y-4">
            <h3 className="font-medium">Schedule Configuration</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scheduleType">Schedule Type *</Label>
                <Select
                  value={scheduleType}
                  onValueChange={(value) => setScheduleType(value as ScheduleType)}
                  disabled={loading || saving}
                >
                  <SelectTrigger id="scheduleType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily (2 AM)</SelectItem>
                    <SelectItem value="weekly">Weekly (Monday 2 AM)</SelectItem>
                    <SelectItem value="custom">Custom (Cron)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={timezone}
                  onValueChange={setTimezone}
                  disabled={loading || saving}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {scheduleType === 'custom' && (
              <div>
                <Label htmlFor="cronExpression">Cron Expression *</Label>
                <Input
                  id="cronExpression"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 2 * * *"
                  disabled={loading || saving}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: minute hour day month weekday (e.g., "0 2 * * *" for 2 AM daily)
                </p>
              </div>
            )}
          </div>

          {/* Test Configuration */}
          <div className="space-y-4">
            <h3 className="font-medium">Test Configuration</h3>

            <div>
              <Label htmlFor="testSuite">Test Suite *</Label>
              <Select
                value={testSuiteId}
                onValueChange={setTestSuiteId}
                disabled={loading || saving}
              >
                <SelectTrigger id="testSuite">
                  <SelectValue placeholder="Select test suite" />
                </SelectTrigger>
                <SelectContent>
                  {testSuites.map((suite) => (
                    <SelectItem key={suite.id} value={suite.id}>
                      {suite.name} ({suite.prompt_count} prompts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="model">Model *</Label>
              <Select
                value={modelId}
                onValueChange={setModelId}
                disabled={loading || saving}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="promptLimit">Prompt Limit</Label>
                <Input
                  id="promptLimit"
                  type="number"
                  value={promptLimit}
                  onChange={(e) => setPromptLimit(parseInt(e.target.value) || 25)}
                  min={1}
                  max={1000}
                  disabled={loading || saving}
                />
              </div>

              <div>
                <Label htmlFor="concurrency">Concurrency</Label>
                <Input
                  id="concurrency"
                  type="number"
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value) || 1)}
                  min={1}
                  max={10}
                  disabled={loading || saving}
                />
              </div>

              <div>
                <Label htmlFor="delay">Delay (ms)</Label>
                <Input
                  id="delay"
                  type="number"
                  value={delayMs}
                  onChange={(e) => setDelayMs(parseInt(e.target.value) || 1000)}
                  min={0}
                  max={10000}
                  disabled={loading || saving}
                />
              </div>
            </div>
          </div>

          {/* Alerting Configuration */}
          <div className="space-y-4">
            <h3 className="font-medium">Alerting & Status</h3>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isActive">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Enable this schedule
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={loading || saving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="alertOnFailure">Alert on Failure</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when batch tests fail
                </p>
              </div>
              <Switch
                id="alertOnFailure"
                checked={alertOnFailure}
                onCheckedChange={setAlertOnFailure}
                disabled={loading || saving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="alertOnRegression">Alert on Regression</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when quality decreases
                </p>
              </div>
              <Switch
                id="alertOnRegression"
                checked={alertOnRegression}
                onCheckedChange={setAlertOnRegression}
                disabled={loading || saving}
              />
            </div>

            {alertOnRegression && (
              <div>
                <Label htmlFor="regressionThreshold">Regression Threshold (%)</Label>
                <Input
                  id="regressionThreshold"
                  type="number"
                  value={regressionThreshold}
                  onChange={(e) => setRegressionThreshold(parseInt(e.target.value) || 10)}
                  min={1}
                  max={100}
                  disabled={loading || saving}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Alert if quality drops by more than this percentage
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              scheduleToEdit ? 'Update Schedule' : 'Create Schedule'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
