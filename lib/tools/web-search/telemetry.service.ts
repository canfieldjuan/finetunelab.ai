import { supabaseAdmin } from '@/lib/supabaseClient';

interface ProviderStats {
  latencies: number[];
  successes: number;
  errors: number;
}

class TelemetryService {
  // Keep a small in-memory buffer for routing decisions (p50/p95)
  // This replaces the ad-hoc map in SearchService
  private stats = new Map<string, ProviderStats>();

  async logSearch(
    provider: string,
    latencyMs: number,
    success: boolean,
    queryLength: number,
    errorCode?: string
  ): Promise<void> {
    // 1. Update in-memory stats for routing
    this.updateInMemoryStats(provider, latencyMs, success);

    // 2. Persist to Supabase (fire-and-forget)
    if (supabaseAdmin) {
      // We don't await this to avoid blocking the search response
      (async () => {
        try {
          const { error } = await supabaseAdmin
            .from('search_telemetry')
            .insert({
              provider,
              latency_ms: latencyMs,
              success,
              error_code: errorCode,
              query_length: queryLength,
            });
          
          if (error) {
            console.warn('[TelemetryService] Failed to persist telemetry:', error.message);
          }
        } catch (err) {
          console.warn('[TelemetryService] Exception persisting telemetry:', err);
        }
      })();
    }
  }

  getProviderStats(provider: string): { p50: number; p95: number } {
    const rec = this.stats.get(provider);
    if (!rec || rec.latencies.length === 0) {
      return { p50: Number.POSITIVE_INFINITY, p95: Number.POSITIVE_INFINITY };
    }

    const sorted = [...rec.latencies].sort((a, b) => a - b);
    return {
      p50: this.quantile(sorted, 0.5),
      p95: this.quantile(sorted, 0.95),
    };
  }

  private updateInMemoryStats(provider: string, latencyMs: number, success: boolean) {
    const rec = this.stats.get(provider) || { latencies: [], successes: 0, errors: 0 };
    
    if (success) {
      rec.successes += 1;
    } else {
      rec.errors += 1;
    }

    if (success && latencyMs > 0) {
      rec.latencies.push(latencyMs);
      // Keep last 50 samples
      if (rec.latencies.length > 50) {
        rec.latencies.shift(); // Remove oldest
      }
    }

    this.stats.set(provider, rec);
  }

  private quantile(sortedNumbers: number[], q: number): number {
    if (sortedNumbers.length === 0) return Number.POSITIVE_INFINITY;
    const pos = (sortedNumbers.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedNumbers[base + 1] !== undefined) {
      return Math.round(sortedNumbers[base] + rest * (sortedNumbers[base + 1] - sortedNumbers[base]));
    } else {
      return Math.round(sortedNumbers[base]);
    }
  }
}

export const telemetryService = new TelemetryService();
