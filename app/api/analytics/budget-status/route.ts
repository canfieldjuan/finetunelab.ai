/**
 * Budget Status API
 * GET /api/analytics/budget-status - Get current budget status, alerts, and forecasts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface BudgetSetting {
  id: string;
  budget_type: 'daily' | 'weekly' | 'monthly';
  budget_limit_usd: number;
  alert_threshold_percent: number;
  enabled: boolean;
}

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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('budget_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true);

    if (settingsError) {
      console.error('[BudgetStatus] Settings fetch error:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch budget settings' }, { status: 500 });
    }

    if (!settings || settings.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No active budget settings',
      });
    }

    const statuses: BudgetStatus[] = [];

    for (const setting of settings as BudgetSetting[]) {
      const { period_start, period_end } = getPeriodDates(setting.budget_type);

      const { data: traces, error: tracesError } = await supabase
        .from('llm_traces')
        .select('cost_usd')
        .eq('user_id', user.id)
        .gte('created_at', period_start)
        .lte('created_at', period_end)
        .not('cost_usd', 'is', null);

      if (tracesError) {
        console.error('[BudgetStatus] Traces fetch error:', tracesError);
        continue;
      }

      const current_spend = traces?.reduce((sum, t) => sum + (t.cost_usd || 0), 0) || 0;
      const spend_percentage = setting.budget_limit_usd > 0
        ? (current_spend / setting.budget_limit_usd) * 100
        : 0;

      const now = new Date();
      const start = new Date(period_start);
      const end = new Date(period_end);
      const total_days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const elapsed_days = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const days_remaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      const daily_avg_spend = elapsed_days > 0 ? current_spend / elapsed_days : 0;
      const forecast_spend = daily_avg_spend * total_days;

      statuses.push({
        budget_type: setting.budget_type,
        budget_limit_usd: setting.budget_limit_usd,
        current_spend_usd: parseFloat(current_spend.toFixed(4)),
        spend_percentage: parseFloat(spend_percentage.toFixed(2)),
        alert_threshold_percent: setting.alert_threshold_percent,
        is_alert: spend_percentage >= setting.alert_threshold_percent,
        is_exceeded: current_spend >= setting.budget_limit_usd,
        period_start,
        period_end,
        forecast_spend_usd: parseFloat(forecast_spend.toFixed(4)),
        forecast_exceeds_budget: forecast_spend >= setting.budget_limit_usd,
        days_until_period_end: days_remaining,
      });
    }

    return NextResponse.json({
      success: true,
      data: statuses,
    });
  } catch (error) {
    console.error('[BudgetStatus] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getPeriodDates(budget_type: 'daily' | 'weekly' | 'monthly'): { period_start: string; period_end: string } {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (budget_type === 'daily') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (budget_type === 'weekly') {
    const day = now.getDay();
    const diff = now.getDate() - day;
    start = new Date(now.setDate(diff));
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (budget_type === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return {
    period_start: start.toISOString(),
    period_end: end.toISOString(),
  };
}
