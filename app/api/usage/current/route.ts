import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GetUsageResponse, UsageMetrics, PlanLimits, SubscriptionPlan } from '@/lib/subscriptions/types';

export const runtime = 'nodejs';

/**
 * GET /api/usage/current
 * Fetch current month's usage with plan limits
 */
export async function GET(request: NextRequest) {
  console.log('[Usage API] GET /api/usage/current');

  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Usage API] Fetching usage for user:', user.id);

    // Fetch current usage from materialized view
    type UsageSummaryRow = {
      metric_type: string;
      total_value: number;
    };

    const { data: usageSummary, error: usageError } = await supabase
      .from('current_usage_summary')
      .select('*')
      .eq('user_id', user.id);

    if (usageError) {
      console.error('[Usage API] Error fetching usage:', usageError);
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      );
    }

    console.log('[Usage API] Usage summary:', usageSummary);

    // Fetch user's subscription with plan limits
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      console.error('[Usage API] Error fetching subscription:', subError);
      return NextResponse.json(
        { error: 'Failed to fetch subscription data' },
        { status: 500 }
      );
    }

    console.log('[Usage API] Subscription:', subscription.plan?.name);

    // Build usage metrics from summary
    const usage: UsageMetrics = {
      api_calls: (usageSummary as UsageSummaryRow[] | null)?.find((u) => u.metric_type === 'api_call')?.total_value || 0,
      tokens: (usageSummary as UsageSummaryRow[] | null)?.find((u) => u.metric_type === 'token_usage')?.total_value || 0,
      storage_mb: (usageSummary as UsageSummaryRow[] | null)?.find((u) => u.metric_type === 'storage_mb')?.total_value || 0,
      training_jobs: (usageSummary as UsageSummaryRow[] | null)?.find((u) => u.metric_type === 'training_job')?.total_value || 0,
      models: (usageSummary as UsageSummaryRow[] | null)?.find((u) => u.metric_type === 'model_created')?.total_value || 0,
    };

    // Extract plan limits (type assertion needed due to Supabase join structure)
    const plan = subscription.plan as SubscriptionPlan | null;
    if (!plan) {
      console.error('[Usage API] Subscription missing plan details');
      return NextResponse.json(
        { error: 'Subscription missing plan information' },
        { status: 500 }
      );
    }

    const limits: PlanLimits = plan.limits;

    // Calculate percentages (-1 means unlimited)
    const calculatePercentage = (current: number, limit: number): number => {
      if (limit === -1) return -1; // Unlimited
      if (limit === 0) return 0;
      return Math.round((current / limit) * 100);
    };

    const percentages = {
      api_calls: calculatePercentage(usage.api_calls, limits.api_calls_per_month),
      storage: calculatePercentage(usage.storage_mb, limits.storage_mb),
      models: calculatePercentage(usage.models, limits.models_limit),
    };

    console.log('[Usage API] Usage:', usage);
    console.log('[Usage API] Limits:', limits);
    console.log('[Usage API] Percentages:', percentages);

    // Build response
    const response: GetUsageResponse = {
      usage,
      limits,
      percentages,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Usage API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
