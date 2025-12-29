'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertTriangle, TrendingUp, CheckCircle, XCircle } from 'lucide-react';

interface BudgetStatus {
  budget_type: 'daily' | 'weekly' | 'monthly';
  budget_limit_usd: number;
  current_spend_usd: number;
  spend_percentage: number;
  alert_threshold_percent: number;
  is_alert: boolean;
  is_exceeded: boolean;
  period_start: string;
  period_end: string;
  forecast_spend_usd: number;
  forecast_exceeds_budget: boolean;
  days_until_period_end: number;
}

export function BudgetAlertsPanel() {
  const { session } = useAuth();
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchStatuses() {
    if (!session?.access_token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/analytics/budget-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch budget status');
      }

      const json = await res.json();
      if (json.success && json.data) {
        setStatuses(json.data);
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setLoading(false);
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

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (statuses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget Alerts</CardTitle>
          <CardDescription>No active budgets configured</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Set budget limits in the Budget Settings card to start tracking spending.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getBudgetLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Budget Alerts</CardTitle>
          <AlertTriangle className="h-5 w-5 text-orange-500" />
        </div>
        <CardDescription>Current spending vs budget limits</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {statuses.map((status) => {
            const isWarning = status.is_alert && !status.is_exceeded;
            const isDanger = status.is_exceeded;
            const isOk = !status.is_alert && !status.is_exceeded;

            return (
              <div
                key={status.budget_type}
                className={`border rounded-lg p-4 ${
                  isDanger ? 'bg-red-50 border-red-200' :
                  isWarning ? 'bg-orange-50 border-orange-200' :
                  'bg-green-50 border-green-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{getBudgetLabel(status.budget_type)}</span>
                    {isDanger && <XCircle className="h-4 w-4 text-red-600" />}
                    {isWarning && <AlertTriangle className="h-4 w-4 text-orange-600" />}
                    {isOk && <CheckCircle className="h-4 w-4 text-green-600" />}
                  </div>
                  <span className={`text-xs font-medium ${
                    isDanger ? 'text-red-700' :
                    isWarning ? 'text-orange-700' :
                    'text-green-700'
                  }`}>
                    {status.spend_percentage.toFixed(1)}% used
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        isDanger ? 'bg-red-600' :
                        isWarning ? 'bg-orange-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, status.spend_percentage)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Current: </span>
                      <span className="font-medium">${status.current_spend_usd.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Limit: </span>
                      <span className="font-medium">${status.budget_limit_usd.toFixed(2)}</span>
                    </div>
                  </div>

                  {status.forecast_exceeds_budget && (
                    <div className="flex items-center gap-1 text-xs text-orange-700 bg-orange-100 rounded px-2 py-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>Forecast: ${status.forecast_spend_usd.toFixed(2)} ({status.days_until_period_end}d remaining)</span>
                    </div>
                  )}

                  {isDanger && (
                    <p className="text-xs text-red-700 font-medium">
                      Budget exceeded! Consider reviewing your spending.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
