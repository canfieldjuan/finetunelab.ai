/**
 * GET /api/billing/usage-history
 * Returns usage history for the past 6 months
 * 
 * Response includes:
 * - Monthly root traces count
 * - Monthly payload consumption
 * - Monthly total cost
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface UsageMeterRecord {
  period_month: number;
  period_year: number;
  root_traces_count: number;
  compressed_payload_bytes: number;
}

export async function GET(req: NextRequest) {
  try {
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

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const { data: usageHistory, error: usageError } = await supabase
      .from('usage_meters')
      .select('period_month, period_year, root_traces_count, compressed_payload_bytes')
      .eq('user_id', user.id)
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true });

    if (usageError) {
      console.error('[Usage History API] Error fetching usage:', usageError);
      return NextResponse.json(
        { error: 'Failed to fetch usage history' },
        { status: 500 }
      );
    }

    console.log('[Usage History API] Found', usageHistory?.length || 0, 'usage records');

    const { data: commitment } = await supabase
      .from('usage_commitments')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    console.log('[Usage History API] Commitment tier:', commitment?.tier || 'none');

    const history = (usageHistory || []).map((record: UsageMeterRecord) => {
      const payloadGb = record.compressed_payload_bytes / 1_073_741_824;
      
      let estimatedCost = commitment ? parseFloat(commitment.minimum_monthly_usd) : 0;
      
      if (commitment) {
        const tracesOver = Math.max(0, record.root_traces_count - commitment.included_traces);
        const traceCost = (tracesOver / 1000) * parseFloat(commitment.price_per_thousand_traces);
        
        const includedPayloadGb = (record.root_traces_count * commitment.included_kb_per_trace) / 1_048_576;
        const payloadOver = Math.max(0, payloadGb - includedPayloadGb);
        const payloadCost = payloadOver * parseFloat(commitment.overage_price_per_gb);
        
        estimatedCost += traceCost + payloadCost;
      }

      const monthName = new Date(record.period_year, record.period_month - 1).toLocaleString('en-US', { month: 'long' });

      return {
        month: monthName,
        year: record.period_year,
        rootTraces: record.root_traces_count,
        payloadGb: parseFloat(payloadGb.toFixed(4)),
        cost: parseFloat(estimatedCost.toFixed(2)),
      };
    });

    console.log('[Usage History API] Returning', history.length, 'months of data');
    if (history.length > 0) {
      console.log('[Usage History API] Sample:', history[0]);
    }

    return NextResponse.json({ history });

  } catch (error) {
    console.error('[Usage History API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
