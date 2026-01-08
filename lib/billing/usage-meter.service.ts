import { createClient } from '@supabase/supabase-js';

// Types for usage metering
export interface RootTraceUsageParams {
  userId: string;
  traceId: string;
  inputData: unknown;
  outputData: unknown;
  metadata?: Record<string, unknown>;
}

export interface UsageStats {
  periodMonth: number;
  periodYear: number;
  rootTraces: number;
  payloadGb: number;
  compressedPayloadGb: number;
  retentionDays: number;
  lastUpdated: Date;
}

export interface CostEstimate {
  baseMinimum: number;
  traceOverage: number;
  payloadOverage: number;
  retentionMultiplier: number;
  estimatedTotal: number;
}

export interface UsageWarning {
  traceWarning: boolean;
  payloadWarning: boolean;
  traceUsagePercent: number;
  payloadUsagePercent: number;
}

// Type for usage_commitments table
interface UsageCommitment {
  user_id: string;
  tier: 'starter' | 'growth' | 'business' | 'enterprise';
  minimum_monthly_usd: string;
  price_per_thousand_traces: string;
  included_traces: number;
  included_kb_per_trace: number;
  overage_price_per_gb: string;
  base_retention_days: number;
  status: 'active' | 'cancelled' | 'expired';
}

/**
 * Record usage for a root trace
 * Serializes and compresses payload to calculate billing size
 */
export async function recordRootTraceUsage(params: RootTraceUsageParams): Promise<void> {
  try {
    const { userId, traceId, inputData, outputData, metadata } = params;

    // 1. Serialize payload
    const payload = JSON.stringify({
      input: inputData,
      output: outputData,
      metadata: metadata || {}
    });

    // 2. Calculate size (compressed if possible)
    let billingSize: number = payload.length; // Fallback to string length
    let isCompressed: boolean = false;

    if (typeof CompressionStream !== 'undefined') {
      try {
        // Create a stream from the payload
        const stream = new Blob([payload]).stream().pipeThrough(new CompressionStream('gzip'));
        // Read the stream to get the size
        const response = new Response(stream);
        const blob: Blob = await response.blob();
        billingSize = blob.size;
        isCompressed = true;
      } catch (e) {
        console.warn('[UsageMeter] Compression failed, using raw size:', e);
      }
    }

    // 3. Record to database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[UsageMeter] Missing Supabase credentials, skipping usage recording');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error }: { error: any } = await supabase.rpc('increment_root_trace_count', {
      p_user_id: userId,
      p_payload_bytes: billingSize,
      p_compressed_bytes: isCompressed ? billingSize : 0
    });

    if (error) {
      // Log error but don't throw to avoid breaking the trace flow
      console.error('[UsageMeter] Failed to record usage:', error);
    } else {
      console.log(`[UsageMeter] Recorded usage for trace ${traceId}: ${billingSize} bytes (${isCompressed ? 'compressed' : 'raw'})`);
    }

  } catch (error) {
    console.error('[UsageMeter] Error in recordRootTraceUsage:', error);
  }
}

/**
 * Get current usage for the billing period
 */
export async function getCurrentUsage(userId: string): Promise<UsageStats | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) return null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error }: { data: any; error: any } = await supabase.rpc('get_current_usage', {
      p_user_id: userId
    });

    if (error) {
      console.error('[UsageMeter] Failed to get current usage:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const record: any = data[0];
    return {
      periodMonth: record.period_month,
      periodYear: record.period_year,
      rootTraces: record.root_traces,
      payloadGb: parseFloat(record.payload_gb),
      compressedPayloadGb: parseFloat(record.compressed_payload_gb),
      retentionDays: record.retention_days,
      lastUpdated: new Date(record.last_updated),
    };
  } catch (error) {
    console.error('[UsageMeter] Error in getCurrentUsage:', error);
    return null;
  }
}

/**
 * Get estimated cost for the current period
 */
export async function getEstimatedCost(userId: string): Promise<CostEstimate | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) return null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error }: { data: any; error: any } = await supabase.rpc('calculate_estimated_cost', {
      p_user_id: userId
    });

    if (error) {
      console.error('[UsageMeter] Failed to get estimated cost:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const record: any = data[0];
    return {
      baseMinimum: parseFloat(record.base_minimum),
      traceOverage: parseFloat(record.trace_overage),
      payloadOverage: parseFloat(record.payload_overage),
      retentionMultiplier: parseFloat(record.retention_multiplier),
      estimatedTotal: parseFloat(record.estimated_total),
    };
  } catch (error) {
    console.error('[UsageMeter] Error in getEstimatedCost:', error);
    return null;
  }
}

/**
 * Check for usage warnings
 */
export async function checkUsageWarnings(userId: string): Promise<UsageWarning | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) return null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current usage
    const usage: UsageStats | null = await getCurrentUsage(userId);
    if (!usage) {
      return {
        traceWarning: false,
        payloadWarning: false,
        traceUsagePercent: 0,
        payloadUsagePercent: 0,
      };
    }

    // Get commitment to calculate percentages
    const { data: commitment, error: commitmentError } = await supabase
      .from('usage_commitments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single() as { data: UsageCommitment | null; error: any };

    if (commitmentError || !commitment) {
      console.warn('[UsageMeter] No active commitment found for user:', userId, commitmentError);
      return {
        traceWarning: false,
        payloadWarning: false,
        traceUsagePercent: 0,
        payloadUsagePercent: 0,
      };
    }

    // Calculate usage percentages
    const traceUsagePercent: number = (usage.rootTraces / commitment.included_traces) * 100;
    const includedPayloadGb: number = (usage.rootTraces * commitment.included_kb_per_trace) / 1_048_576;
    const payloadUsagePercent: number = includedPayloadGb > 0
      ? (usage.compressedPayloadGb / includedPayloadGb) * 100
      : 0;

    return {
      traceWarning: traceUsagePercent >= 90,
      payloadWarning: payloadUsagePercent >= 90,
      traceUsagePercent: Math.round(traceUsagePercent),
      payloadUsagePercent: Math.round(payloadUsagePercent),
    };
  } catch (error) {
    console.error('[UsageMeter] Error in checkUsageWarnings:', error);
    return null;
  }
}
