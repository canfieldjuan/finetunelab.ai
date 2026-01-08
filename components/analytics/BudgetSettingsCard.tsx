'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, DollarSign, Save, Trash2 } from 'lucide-react';

interface BudgetSetting {
  id: string;
  budget_type: 'daily' | 'weekly' | 'monthly';
  budget_limit_usd: number;
  alert_threshold_percent: number;
  enabled: boolean;
}

export function BudgetSettingsCard() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<BudgetSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dailyLimit, setDailyLimit] = useState('');
  const [weeklyLimit, setWeeklyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [dailyThreshold, setDailyThreshold] = useState('80');
  const [weeklyThreshold, setWeeklyThreshold] = useState('80');
  const [monthlyThreshold, setMonthlyThreshold] = useState('80');

  useEffect(() => {
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSettings() {
    if (!session?.access_token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/analytics/budget-settings', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch budget settings');
      }

      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
        json.data.forEach((s: BudgetSetting) => {
          if (s.budget_type === 'daily') {
            setDailyLimit(s.budget_limit_usd.toString());
            setDailyThreshold(s.alert_threshold_percent.toString());
          } else if (s.budget_type === 'weekly') {
            setWeeklyLimit(s.budget_limit_usd.toString());
            setWeeklyThreshold(s.alert_threshold_percent.toString());
          } else if (s.budget_type === 'monthly') {
            setMonthlyLimit(s.budget_limit_usd.toString());
            setMonthlyThreshold(s.alert_threshold_percent.toString());
          }
        });
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setLoading(false);
    }
  }

  async function saveBudget(budget_type: 'daily' | 'weekly' | 'monthly') {
    if (!session?.access_token) return;

    const limit = budget_type === 'daily' ? dailyLimit :
                  budget_type === 'weekly' ? weeklyLimit : monthlyLimit;
    const threshold = budget_type === 'daily' ? dailyThreshold :
                      budget_type === 'weekly' ? weeklyThreshold : monthlyThreshold;

    if (!limit || Number(limit) <= 0) {
      setError('Budget limit must be greater than 0');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/analytics/budget-settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budget_type,
          budget_limit_usd: Number(limit),
          alert_threshold_percent: Number(threshold),
          enabled: true,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save budget');
      }

      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteBudget(budget_type: 'daily' | 'weekly' | 'monthly') {
    if (!session?.access_token) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/analytics/budget-settings?budget_type=${budget_type}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to delete budget');
      }

      if (budget_type === 'daily') setDailyLimit('');
      else if (budget_type === 'weekly') setWeeklyLimit('');
      else setMonthlyLimit('');

      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderBudgetRow = (
    type: 'daily' | 'weekly' | 'monthly',
    label: string,
    limit: string,
    setLimit: (val: string) => void,
    threshold: string,
    setThreshold: (val: string) => void
  ) => (
    <div className="space-y-2">
      <div className="font-medium text-sm">{label}</div>
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-5">
          <label className="text-xs text-muted-foreground">Budget Limit ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="10.00"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="col-span-4">
          <label className="text-xs text-muted-foreground">Alert at (%)</label>
          <input
            type="number"
            min="1"
            max="100"
            placeholder="80"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="col-span-3 flex gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={() => saveBudget(type)}
            disabled={saving || !limit}
            className="flex-1"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => deleteBudget(type)}
            disabled={saving || !limit}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Budget Limits</CardTitle>
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <CardDescription>
          Set spending limits and alert thresholds
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-2 mb-4 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-4">
          {renderBudgetRow('daily', 'Daily Budget', dailyLimit, setDailyLimit, dailyThreshold, setDailyThreshold)}
          {renderBudgetRow('weekly', 'Weekly Budget', weeklyLimit, setWeeklyLimit, weeklyThreshold, setWeeklyThreshold)}
          {renderBudgetRow('monthly', 'Monthly Budget', monthlyLimit, setMonthlyLimit, monthlyThreshold, setMonthlyThreshold)}
        </div>
      </CardContent>
    </Card>
  );
}
