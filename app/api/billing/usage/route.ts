/**
 * GET /api/billing/usage
 * Returns real-time usage for the authenticated user's current billing period
 * Usage-based pricing model (two-meter + retention)
 * 
 * Response includes:
 * - Root traces monitored
 * - Payload consumption (compressed)
 * - Retention configuration
 * - Estimated cost breakdown
 * - Usage warnings (if approaching limits)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUsage, getEstimatedCost, checkUsageWarnings } from '@/lib/billing/usage-meter.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - missing authorization header' },
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

    // 2. Get current commitment/tier
    let { data: commitment, error: commitmentError } = await supabase
      .from('usage_commitments')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    // If no active commitment exists, create a default "starter" tier
    if (commitmentError || !commitment) {
      console.log('[Usage API] No active subscription found, creating default starter tier for user:', user.id);
      
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const { data: newCommitment, error: createError } = await supabase
        .from('usage_commitments')
        .insert({
          user_id: user.id,
          tier: 'starter',
          status: 'active',
          minimum_monthly_usd: '250.00',
          included_traces: 100000,
          overage_per_1k_traces: '0.50',
          included_payload_gb: 1,  // 100K traces * 10KB = ~1GB
          overage_per_gb_payload: '0.25',
          base_retention_days: 14,
          retention_multiplier: 1.0,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
        })
        .select()
        .single();

      if (createError || !newCommitment) {
        console.error('[Usage API] Failed to create default subscription:', createError);
        return NextResponse.json(
          { error: 'Failed to initialize subscription' },
          { status: 500 }
        );
      }

      commitment = newCommitment;
      console.log('[Usage API] Created default starter subscription for user:', user.id);
    }

    // 3. Get current usage
    const usage = await getCurrentUsage(user.id);
    if (!usage) {
      // No usage this period - return zeros
      return NextResponse.json({
        period: {
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
        },
        tier: commitment.tier,
        usage: {
          rootTraces: 0,
          includedTraces: commitment.included_traces,
          overageTraces: 0,
          payloadGb: 0,
          includedPayloadGb: 0,
          overagePayloadGb: 0,
          retentionDays: commitment.base_retention_days,
        },
        cost: {
          baseMinimum: parseFloat(commitment.minimum_monthly_usd),
          traceOverage: 0,
          payloadOverage: 0,
          retentionMultiplier: 1.0,
          estimatedTotal: parseFloat(commitment.minimum_monthly_usd),
        },
        warnings: {
          traceWarning: false,
          payloadWarning: false,
          traceUsagePercent: 0,
          payloadUsagePercent: 0,
        },
      });
    }

    // 4. Calculate costs
    const cost = await getEstimatedCost(user.id);
    if (!cost) {
      return NextResponse.json(
        { error: 'Failed to calculate cost' },
        { status: 500 }
      );
    }

    // 5. Check usage warnings
    const warnings = await checkUsageWarnings(user.id);

    // 6. Calculate overage amounts
    const overageTraces = Math.max(0, usage.rootTraces - commitment.included_traces);
    const includedPayloadGb = (usage.rootTraces * commitment.included_kb_per_trace) / 1_048_576;
    const overagePayloadGb = Math.max(0, usage.compressedPayloadGb - includedPayloadGb);

    // 7. Return comprehensive usage data
    return NextResponse.json({
      period: {
        month: usage.periodMonth,
        year: usage.periodYear,
      },
      tier: commitment.tier,
      usage: {
        rootTraces: usage.rootTraces,
        includedTraces: commitment.included_traces,
        overageTraces,
        payloadGb: usage.compressedPayloadGb,
        includedPayloadGb,
        overagePayloadGb,
        retentionDays: usage.retentionDays,
      },
      cost: {
        baseMinimum: cost.baseMinimum,
        traceOverage: cost.traceOverage,
        payloadOverage: cost.payloadOverage,
        retentionMultiplier: cost.retentionMultiplier,
        estimatedTotal: cost.estimatedTotal,
      },
      warnings: warnings || {
        traceWarning: false,
        payloadWarning: false,
        traceUsagePercent: 0,
        payloadUsagePercent: 0,
      },
      lastUpdated: usage.lastUpdated.toISOString(),
    });

  } catch (error) {
    console.error('[Billing Usage API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
