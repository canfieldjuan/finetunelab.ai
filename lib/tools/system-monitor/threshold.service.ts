// System Monitor Tool - Dynamic Threshold Service
// Date: October 21, 2025

import { supabase } from '../../supabaseClient';

/**
 * Baseline thresholds calculated from historical data
 */
export interface DynamicThresholds {
  responseTime: {
    normal: number;
    warning: number;
    critical: number;
  };
  errorRate: {
    normal: number;
    warning: number;
    critical: number;
  };
  throughput: {
    normal: number;
    warning: number;
    critical: number;
  };
  calculatedAt: string;
  sampleSize: number;
}

/**
 * Service for calculating and managing dynamic performance thresholds
 */
export class DynamicThresholdService {
  private logger = console;
  private cachedThresholds: DynamicThresholds | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION_MS = 3600000; // 1 hour

  /**
   * Get current dynamic thresholds, using cache if available
   */
  async getThresholds(): Promise<DynamicThresholds> {
    const now = Date.now();
    
    if (this.cachedThresholds && now < this.cacheExpiry) {
      this.logger.debug('[DynamicThreshold] Using cached thresholds');
      return this.cachedThresholds;
    }

    this.logger.debug('[DynamicThreshold] Calculating fresh thresholds...');
    const thresholds = await this.calculateThresholds();
    
    this.cachedThresholds = thresholds;
    this.cacheExpiry = now + this.CACHE_DURATION_MS;
    
    return thresholds;
  }

  /**
   * Calculate dynamic thresholds based on historical data
   * Uses last 30 days of data to establish baselines
   */
  private async calculateThresholds(): Promise<DynamicThresholds> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: executions, error } = await supabase
        .from('tool_executions')
        .select('duration, status, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10000);

      if (error) {
        this.logger.error(
          '[DynamicThreshold] Error fetching historical data:',
          error.message
        );
        return this.getDefaultThresholds();
      }

      if (!executions || executions.length < 100) {
        this.logger.debug(
          '[DynamicThreshold] Insufficient data for dynamic thresholds. Using defaults.'
        );
        return this.getDefaultThresholds();
      }

      this.logger.debug(
        `[DynamicThreshold] Analyzing ${executions.length} historical executions...`
      );

      return this.analyzeHistoricalData(executions);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        '[DynamicThreshold] Error calculating thresholds:',
        errorMessage
      );
      return this.getDefaultThresholds();
    }
  }

  /**
   * Analyze historical data and calculate statistical thresholds
   * Uses mean and standard deviation to set warning/critical levels
   */
  private analyzeHistoricalData(
    executions: Array<{ duration: number; status: string; created_at: string }>
  ): DynamicThresholds {
    // Calculate response time metrics
    const durations = executions.map((e) => e.duration).filter((d) => d > 0);
    const responseTimes = this.calculateStatistics(durations);

    // Calculate error rate
    const totalExecutions = executions.length;
    const failedExecutions = executions.filter(
      (e) => e.status === 'failed'
    ).length;
    const errorRate = failedExecutions / totalExecutions;

    // Calculate throughput (executions per hour)
    const timeRangeHours = this.calculateTimeRangeHours(executions);
    const throughput = totalExecutions / timeRangeHours;

    this.logger.debug(
      `[DynamicThreshold] Baseline metrics: Avg response ${responseTimes.mean.toFixed(0)}ms, Error rate ${(errorRate * 100).toFixed(2)}%, Throughput ${throughput.toFixed(1)}/hr`
    );

    return {
      responseTime: {
        normal: Math.round(responseTimes.mean),
        warning: Math.round(responseTimes.mean + responseTimes.stdDev),
        critical: Math.round(responseTimes.mean + 2 * responseTimes.stdDev),
      },
      errorRate: {
        normal: errorRate,
        warning: Math.min(errorRate * 2, 0.5),
        critical: Math.min(errorRate * 3, 0.8),
      },
      throughput: {
        normal: Math.round(throughput),
        warning: Math.round(throughput * 0.5),
        critical: Math.round(throughput * 0.25),
      },
      calculatedAt: new Date().toISOString(),
      sampleSize: executions.length,
    };
  }

  /**
   * Calculate mean and standard deviation for a dataset
   */
  private calculateStatistics(values: number[]): {
    mean: number;
    stdDev: number;
  } {
    if (values.length === 0) {
      return { mean: 0, stdDev: 0 };
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev };
  }

  /**
   * Calculate the time range in hours covered by the executions
   */
  private calculateTimeRangeHours(
    executions: Array<{ created_at: string }>
  ): number {
    if (executions.length === 0) return 1;

    const timestamps = executions.map((e) => new Date(e.created_at).getTime());
    const oldest = Math.min(...timestamps);
    const newest = Math.max(...timestamps);
    const rangeMs = newest - oldest;

    return Math.max(rangeMs / (1000 * 60 * 60), 1);
  }

  /**
   * Get default static thresholds when dynamic calculation is not possible
   */
  private getDefaultThresholds(): DynamicThresholds {
    return {
      responseTime: {
        normal: 1000,
        warning: 3000,
        critical: 5000,
      },
      errorRate: {
        normal: 0.02,
        warning: 0.05,
        critical: 0.1,
      },
      throughput: {
        normal: 10,
        warning: 5,
        critical: 2,
      },
      calculatedAt: new Date().toISOString(),
      sampleSize: 0,
    };
  }
}
