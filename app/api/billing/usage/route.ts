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
import {
  getCurrentUsage,
  getEstimatedCost,
  checkUsageWarnings,
  type UsageStats,
  type CostEstimate,
  type UsageWarning
} from '@/lib/billing/usage-meter.service';

export const runtime = 'nodejs';

// Type for usage_commitments table
interface UsageCommitment {
  id: string;
  user_id: string;
  tier: 'starter' | 'growth' | 'business' | 'enterprise';
  minimum_monthly_usd: string;
  price_per_thousand_traces: string;
  included_traces: number;
  included_kb_per_trace: number;
  overage_price_per_gb: string;
  base_retention_days: number;
  trace_commitment?: number;
  discount_percent?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  starts_at: string;
  ends_at?: string;
  status: 'active' | 'cancelled' | 'expired';
  created_at?: string;
  updated_at?: string;
}

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
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
      .single() as { data: UsageCommitment | null; error: any };

    // If no active commitment exists, create a default "starter" tier
    if (commitmentError || !commitment) {
      console.log('[Usage API] No active subscription found, attempting to create default starter tier for user:', user.id);
      
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Use upsert to handle potential race conditions or existing records
      const { data: newCommitment, error: createError } = await supabase
        .from('usage_commitments')
        .upsert({
          user_id: user.id,
          tier: 'starter',
          status: 'active',
          minimum_monthly_usd: '250.00',
          included_traces: 100000,
          price_per_thousand_traces: '0.50',
          included_kb_per_trace: 10,  // 10KB per trace included
          overage_price_per_gb: '0.25',
          base_retention_days: 14,
          starts_at: periodStart.toISOString(),
          ends_at: periodEnd.toISOString(),
        }, {
          onConflict: 'user_id,status',
          ignoreDuplicates: false, // Update if exists
        })
        .select()
        .single();

      if (createError) {
        console.error('[Usage API] Failed to create/update default subscription:', createError);
        
        // Try one more time to fetch existing commitment
        const { data: existingCommitment } = await supabase
          .from('usage_commitments')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        if (existingCommitment) {
          console.log('[Usage API] Found existing commitment after upsert failure');
          commitment = existingCommitment;
        } else {
          return NextResponse.json(
            { error: 'Failed to initialize subscription' },
            { status: 500 }
          );
        }
      } else {
        commitment = newCommitment;
        console.log('[Usage API] Created/updated default starter subscription for user:', user.id);
      }
    }

    // Ensure commitment is not null after fetch/create logic
    if (!commitment) {
      return NextResponse.json(
        { error: 'Failed to load subscription data' },
        { status: 500 }
      );
    }

    // 3. Get current usage
    const usage: UsageStats | null = await getCurrentUsage(user.id);
    if (!usage) {
      // No usage this period - return zeros
      console.log('[Usage API] No usage data for current period', {
        userId: user.id,
        tier: commitment!.tier,
        periodMonth: new Date().getMonth() + 1,
        periodYear: new Date().getFullYear(),
      });
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
    let cost: CostEstimate | null;
    try {
      cost = await getEstimatedCost(user.id);
    } catch (costError) {
      console.error('[Usage API] getEstimatedCost error:', costError);
      // If cost calculation fails, use defaults from commitment
      cost = {
        baseMinimum: parseFloat(commitment!.minimum_monthly_usd),
        traceOverage: 0,
        payloadOverage: 0,
        retentionMultiplier: 1.0,
        estimatedTotal: parseFloat(commitment!.minimum_monthly_usd),
      };
    }

    if (!cost) {
      // Fallback to defaults if still null
      cost = {
        baseMinimum: parseFloat(commitment!.minimum_monthly_usd),
        traceOverage: 0,
        payloadOverage: 0,
        retentionMultiplier: 1.0,
        estimatedTotal: parseFloat(commitment!.minimum_monthly_usd),
      };
    }

    // 5. Check usage warnings
    const warnings: UsageWarning | null = await checkUsageWarnings(user.id);

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Billing Usage API] Error details:', errorMessage);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
