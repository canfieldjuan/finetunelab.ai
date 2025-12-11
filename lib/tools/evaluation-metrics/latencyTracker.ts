// Latency Tracking Service
// Tracks and analyzes response latency for message evaluations
// Date: October 25, 2025

import { supabase } from '@/lib/supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

export interface LatencyMetrics {
  userId: string;
  period: string;
  totalMeasurements: number;
  averageLatencyMs: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  byModel: ModelLatency[];
}

export interface ModelLatency {
  model: string;
  provider: string;
  count: number;
  averageMs: number;
  medianMs: number;
  p95Ms: number;
}

export interface LatencyDataPoint {
  messageId: string;
  model: string;
  provider: string;
  latencyMs: number;
  timestamp: string;
}

// ============================================================================
// LATENCY TRACKER SERVICE
// ============================================================================

class LatencyTrackerService {
  /**
   * Get latency metrics for a user within a date range
   */
  async getLatencyMetrics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LatencyMetrics> {
    console.log('[LatencyTracker] getLatencyMetrics started', {
      userId,
      startDate,
      endDate,
    });

    try {
      const latencyData = await this.fetchLatencyData(userId, startDate, endDate);

      if (latencyData.length === 0) {
        return this.createEmptyMetrics(userId, startDate, endDate);
      }

      const latencies = latencyData.map((d) => d.latencyMs).sort((a, b) => a - b);
      const byModel = this.aggregateByModel(latencyData);

      return {
        userId,
        period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        totalMeasurements: latencies.length,
        averageLatencyMs: this.calculateAverage(latencies),
        medianLatencyMs: this.calculateMedian(latencies),
        p95LatencyMs: this.calculatePercentile(latencies, 0.95),
        p99LatencyMs: this.calculatePercentile(latencies, 0.99),
        minLatencyMs: Math.min(...latencies),
        maxLatencyMs: Math.max(...latencies),
        byModel,
      };
    } catch (error) {
      console.error('[LatencyTracker] getLatencyMetrics error:', error);
      throw new Error(
        `Failed to get latency metrics: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Fetch raw latency data from database
   */
  private async fetchLatencyData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LatencyDataPoint[]> {
    console.log('[LatencyTracker] Fetching latency data from database');

    const { data: messages, error } = await supabase
      .from('messages')
      .select(
        `
        id,
        latency_ms,
        model_id,
        provider,
        created_at,
        conversation:conversations!inner(user_id)
      `
      )
      .eq('conversations.user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('latency_ms', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[LatencyTracker] Database query error:', error);
      throw error;
    }

    console.log('[LatencyTracker] Retrieved messages:', messages?.length || 0);

    return (messages || []).map((msg) => ({
      messageId: msg.id,
      model: msg.model_id || 'unknown',
      provider: msg.provider || 'unknown',
      latencyMs: msg.latency_ms,
      timestamp: msg.created_at,
    }));
  }

  /**
   * Aggregate latency data by model
   */
  private aggregateByModel(data: LatencyDataPoint[]): ModelLatency[] {
    console.log('[LatencyTracker] Aggregating by model');

    const modelMap = new Map<string, number[]>();

    data.forEach((point) => {
      const key = `${point.model}|${point.provider}`;
      if (!modelMap.has(key)) {
        modelMap.set(key, []);
      }
      modelMap.get(key)!.push(point.latencyMs);
    });

    const results: ModelLatency[] = [];
    modelMap.forEach((latencies, key) => {
      const [model, provider] = key.split('|');
      const sorted = latencies.sort((a, b) => a - b);

      results.push({
        model,
        provider,
        count: latencies.length,
        averageMs: this.calculateAverage(sorted),
        medianMs: this.calculateMedian(sorted),
        p95Ms: this.calculatePercentile(sorted, 0.95),
      });
    });

    return results.sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate average from array of numbers
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / values.length);
  }

  /**
   * Calculate median from sorted array
   */
  private calculateMedian(sortedValues: number[]): number {
    if (sortedValues.length === 0) return 0;
    const mid = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
      return Math.round((sortedValues[mid - 1] + sortedValues[mid]) / 2);
    }
    return sortedValues[mid];
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): LatencyMetrics {
    return {
      userId,
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      totalMeasurements: 0,
      averageLatencyMs: 0,
      medianLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      byModel: [],
    };
  }
}

export const latencyTrackerService = new LatencyTrackerService();
