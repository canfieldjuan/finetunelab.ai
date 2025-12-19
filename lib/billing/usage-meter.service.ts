/**
 * Usage Metering Service
 * Automatically tracks usage for billing based on LLM traces
 * 
 * Integrates with TraceService to meter:
 * - Root traces (top-level spans without parent)
 * - Payload size (input_data + output_data)
 * - Compressed payload (for billing calculations)
 * 
 * Date: 2025-12-18
 */

import { createClient } from '@supabase/supabase-js';
import { gzipSync } from 'zlib';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role for metering (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PayloadSize {
  totalBytes: number;
  compressedBytes: number;
}

/**
 * Calculate payload size for a trace span
 * Includes input_data + output_data + metadata
 */
function calculatePayloadSize(
  inputData: unknown,
  outputData: unknown,
  metadata?: Record<string, unknown>
): PayloadSize {
  // Serialize to JSON
  const payload = JSON.stringify({
    input: inputData,
    output: outputData,
    metadata: metadata || {},
  });
  
  // Uncompressed size
  const totalBytes = Buffer.byteLength(payload, 'utf8');
  
  // Compressed size (gzip)
  const compressed = gzipSync(Buffer.from(payload, 'utf8'));
  const compressedBytes = compressed.length;
  
  return { totalBytes, compressedBytes };
}

/**
 * Record usage when a root trace is created
 * Should be called by TraceService when endTrace() is called on a root span
 */
export async function recordRootTraceUsage(params: {
  userId: string;
  traceId: string;
  inputData?: unknown;
  outputData?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { userId, inputData, outputData, metadata } = params;
    
    // Calculate payload sizes
    const { totalBytes, compressedBytes } = calculatePayloadSize(
      inputData,
      outputData,
      metadata
    );
    
    // Record usage via database function
    const { error } = await supabase.rpc('increment_root_trace_count', {
      p_user_id: userId,
      p_payload_bytes: totalBytes,
      p_compressed_bytes: compressedBytes,
    });
    
    if (error) {
      console.error('[UsageMeter] Failed to record trace usage:', error);
      // Don't throw - usage metering failure shouldn't break core functionality
    } else {
      console.log(`[UsageMeter] Recorded root trace: ${compressedBytes} bytes (compressed)`);
    }
  } catch (err) {
    console.error('[UsageMeter] Unexpected error:', err);
    // Swallow errors - metering is non-critical
  }
}

/**
 * Get current usage for a user
 */
export async function getCurrentUsage(userId: string): Promise<{
  periodMonth: number;
  periodYear: number;
  rootTraces: number;
  payloadGb: number;
  compressedPayloadGb: number;
  retentionDays: number;
  lastUpdated: Date;
} | null> {
  try {
    const { data, error } = await supabase.rpc('get_current_usage', {
      p_user_id: userId,
    });
    
    if (error) {
      console.error('[UsageMeter] Failed to get current usage:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      return null;
    }
    
    const row = data[0];
    return {
      periodMonth: row.period_month,
      periodYear: row.period_year,
      rootTraces: row.root_traces,
      payloadGb: parseFloat(row.payload_gb),
      compressedPayloadGb: parseFloat(row.compressed_payload_gb),
      retentionDays: row.retention_days,
      lastUpdated: new Date(row.last_updated),
    };
  } catch (err) {
    console.error('[UsageMeter] Unexpected error:', err);
    return null;
  }
}

/**
 * Calculate estimated cost for current period
 */
export async function getEstimatedCost(userId: string): Promise<{
  baseMinimum: number;
  traceOverage: number;
  payloadOverage: number;
  retentionMultiplier: number;
  estimatedTotal: number;
} | null> {
  try {
    const { data, error } = await supabase.rpc('calculate_estimated_cost', {
      p_user_id: userId,
    });
    
    if (error) {
      console.error('[UsageMeter] Failed to calculate cost:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      return null;
    }
    
    const row = data[0];
    return {
      baseMinimum: parseFloat(row.base_minimum),
      traceOverage: parseFloat(row.trace_overage),
      payloadOverage: parseFloat(row.payload_overage),
      retentionMultiplier: parseFloat(row.retention_multiplier),
      estimatedTotal: parseFloat(row.estimated_total),
    };
  } catch (err) {
    console.error('[UsageMeter] Unexpected error:', err);
    return null;
  }
}

/**
 * Check if user is approaching usage limits
 * Returns warning if within 10% of included traces
 */
export async function checkUsageWarnings(userId: string): Promise<{
  traceWarning: boolean;
  payloadWarning: boolean;
  traceUsagePercent: number;
  payloadUsagePercent: number;
} | null> {
  try {
    // Get current usage and commitment
    const usage = await getCurrentUsage(userId);
    if (!usage) return null;
    
    const { data: commitment } = await supabase
      .from('usage_commitments')
      .select('included_traces, included_kb_per_trace')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    if (!commitment) return null;
    
    // Calculate usage percentages
    const traceUsagePercent = (usage.rootTraces / commitment.included_traces) * 100;
    
    const includedPayloadGb = (usage.rootTraces * commitment.included_kb_per_trace) / 1_048_576; // KB to GB
    const payloadUsagePercent = (usage.compressedPayloadGb / includedPayloadGb) * 100;
    
    return {
      traceWarning: traceUsagePercent >= 90,
      payloadWarning: payloadUsagePercent >= 90,
      traceUsagePercent,
      payloadUsagePercent,
    };
  } catch (err) {
    console.error('[UsageMeter] Failed to check warnings:', err);
    return null;
  }
}
