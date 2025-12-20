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
    let billingSize = payload.length; // Fallback to string length
    let isCompressed = false;

    if (typeof CompressionStream !== 'undefined') {
      try {
        // Create a stream from the payload
        const stream = new Blob([payload]).stream().pipeThrough(new CompressionStream('gzip'));
        // Read the stream to get the size
        const response = new Response(stream);
        const blob = await response.blob();
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

    const { error } = await supabase.rpc('record_trace_usage', {
      p_user_id: userId,
      p_trace_id: traceId,
      p_size_bytes: billingSize,
      p_is_compressed: isCompressed
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
    
    const { data, error } = await supabase.rpc('get_current_usage', {
      p_user_id: userId
    });

    if (error) {
      console.error('[UsageMeter] Failed to get current usage:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const record = data[0];
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
    
    const { data, error } = await supabase.rpc('calculate_estimated_cost', {
      p_user_id: userId
    });

    if (error) {
      console.error('[UsageMeter] Failed to get estimated cost:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const record = data[0];
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
export async function checkUsageWarnings(userId: string): Promise<UsageWarning> {
  try {
    const usage = await getCurrentUsage(userId);
    if (!usage) return { warning_level: 'none' };

    if (usage.usage_percentage >= 90) {
      return {
        warning_level: 'critical',
        message: `You have used ${usage.usage_percentage.toFixed(1)}% of your included storage.`
      };
    } else if (usage.usage_percentage >= 75) {
      return {
        warning_level: 'warning',
        message: `You have used ${usage.usage_percentage.toFixed(1)}% of your included storage.`
      };
    }

    return { warning_level: 'none' };
  } catch (error) {
    console.error('[UsageMeter] Error in checkUsageWarnings:', error);
    return { warning_level: 'none' };
  }
}
