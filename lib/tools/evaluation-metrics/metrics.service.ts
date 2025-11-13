// Evaluation Metrics Service - Core Functionality
// Date: October 13, 2025

import { supabase } from '@/lib/supabaseClient';
import { evaluationMetricsConfig } from './config';
import { calculateCost } from './pricing.utils';
import type {
  EvaluationMetrics,
  QualityTrend,
  TrendDataPoint,
  SuccessAnalysis,
  PeriodComparison,
  MetricsOptions,
  ModelComparison,
  ModelPerformance,
  ToolImpactAnalysis,
  ToolPerformance,
  ToolCorrelation,
} from './types';

// Type for evaluation with message data
interface EvaluationWithMessage {
  rating: number;
  success: boolean;
  created_at: string;
  messages: {
    model_id: string | null;
    provider: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
  }[];
}

// Type for evaluation with tool data
interface EvaluationWithTools {
  rating: number;
  success: boolean;
  created_at: string;
  messages: {
    tools_called: Array<{ name: string; success?: boolean; error?: string }> | null;
    tool_success: boolean | null;
    latency_ms: number | null;
  }[];
}

class EvaluationMetricsService {
  // Helper: Get date range based on period
  private getDateRange(
    period: string,
    endDate?: Date
  ): { start: Date; end: Date } {
    const end = endDate || new Date();
    const start = new Date(end);

    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all':
        start.setFullYear(2020);
        break;
    }

    return { start, end };
  }

  // Get overall evaluation metrics
  async getMetrics(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<EvaluationMetrics> {
    try {
      const period = options.period || evaluationMetricsConfig.defaultPeriod;
      const endDate = options.endDate ? new Date(options.endDate) : new Date();
      const startDate = options.startDate
        ? new Date(options.startDate)
        : this.getDateRange(period, endDate).start;

      // Query evaluations
      let query = supabase
        .from('message_evaluations')
        .select('rating, success, failure_tags, created_at')
        .eq('evaluator_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .limit(evaluationMetricsConfig.maxEvaluationsAnalyzed);

      if (options.conversationId) {
        query = query.eq('conversation_id', options.conversationId);
      }

      if (options.minRating !== undefined) {
        query = query.gte('rating', options.minRating);
      }

      if (options.maxRating !== undefined) {
        query = query.lte('rating', options.maxRating);
      }

      const { data: evaluations, error } = await query;

      if (error) throw error;

      if (!evaluations || evaluations.length === 0) {
        return {
          userId,
          period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
          totalEvaluations: 0,
          averageRating: 0,
          successRate: 0,
          qualityDistribution: {
            excellent: 0,
            good: 0,
            average: 0,
            poor: 0,
            veryPoor: 0,
          },
          breakdown: {
            successful: 0,
            failed: 0,
            unevaluated: 0,
          },
        };
      }

      // Calculate metrics
      const totalEvaluations = evaluations.length;
      const totalRating = evaluations.reduce((sum, e) => sum + (e.rating || 0), 0);
      const averageRating = totalRating / totalEvaluations;

      const successful = evaluations.filter((e) => e.success === true).length;
      const failed = evaluations.filter((e) => e.success === false).length;
      const successRate = totalEvaluations > 0 ? successful / totalEvaluations : 0;

      // Quality distribution
      const qualityDistribution = {
        excellent: evaluations.filter((e) => e.rating === 5).length,
        good: evaluations.filter((e) => e.rating === 4).length,
        average: evaluations.filter((e) => e.rating === 3).length,
        poor: evaluations.filter((e) => e.rating === 2).length,
        veryPoor: evaluations.filter((e) => e.rating === 1).length,
      };

      return {
        userId,
        period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        totalEvaluations,
        averageRating: Math.round(averageRating * 100) / 100,
        successRate: Math.round(successRate * 1000) / 1000,
        qualityDistribution,
        breakdown: {
          successful,
          failed,
          unevaluated: 0, // Would need to query messages table
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to get metrics: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // Analyze quality trends over time
  async getQualityTrends(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<QualityTrend> {
    try {
      const period = options.period || evaluationMetricsConfig.defaultPeriod;
      const endDate = options.endDate ? new Date(options.endDate) : new Date();
      const startDate = options.startDate
        ? new Date(options.startDate)
        : this.getDateRange(period, endDate).start;

      // Query evaluations
      const { data: evaluations, error } = await supabase
        .from('message_evaluations')
        .select('rating, created_at')
        .eq('evaluator_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(evaluationMetricsConfig.maxEvaluationsAnalyzed);

      if (error) throw error;

      if (!evaluations || evaluations.length === 0) {
        return {
          period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
          dataPoints: [],
          trend: 'stable',
          changePercentage: 0,
        };
      }

      // Group by day and calculate daily averages
      const dailyData = new Map<string, { ratings: number[]; count: number }>();

      evaluations.forEach((evaluation) => {
        const date = new Date(evaluation.created_at).toISOString().split('T')[0];
        if (!dailyData.has(date)) {
          dailyData.set(date, { ratings: [], count: 0 });
        }
        const day = dailyData.get(date)!;
        day.ratings.push(evaluation.rating || 0);
        day.count++;
      });

      // Convert to data points
      const dataPoints: TrendDataPoint[] = Array.from(dailyData.entries())
        .map(([date, data]) => ({
          date,
          averageRating:
            Math.round(
              (data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length) * 100
            ) / 100,
          evaluationCount: data.count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-evaluationMetricsConfig.maxTrendDataPoints);

      // Analyze trend
      const trend = this.analyzeTrend(dataPoints);

      // Calculate change percentage
      const firstAvg = dataPoints[0]?.averageRating || 0;
      const lastAvg = dataPoints[dataPoints.length - 1]?.averageRating || 0;
      const changePercentage =
        firstAvg > 0
          ? Math.round(((lastAvg - firstAvg) / firstAvg) * 100 * 10) / 10
          : 0;

      return {
        period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        dataPoints,
        trend,
        changePercentage,
      };
    } catch (error) {
      throw new Error(
        `Failed to get quality trends: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // Helper: Determine trend direction
  private analyzeTrend(
    dataPoints: TrendDataPoint[]
  ): 'improving' | 'declining' | 'stable' {
    if (dataPoints.length < evaluationMetricsConfig.trendDetection.minDataPoints) {
      return 'stable';
    }

    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, d) => sum + d.averageRating, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, d) => sum + d.averageRating, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change >= evaluationMetricsConfig.trendDetection.improvingThreshold) {
      return 'improving';
    } else if (change <= evaluationMetricsConfig.trendDetection.decliningThreshold) {
      return 'declining';
    } else {
      return 'stable';
    }
  }

  // Helper: Calculate statistical metrics for a dataset
  private calculateStatistics(values: number[]): {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    console.log('[MetricsService] Calculating statistics for dataset', {
      sampleSize: values.length,
      firstFew: values.slice(0, 3),
    });

    if (values.length === 0) {
      console.log('[MetricsService] Empty dataset, returning zeros');
      return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
    }

    // Calculate mean
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;

    // Calculate median
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

    // Calculate standard deviation
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Min and max
    const min = Math.min(...values);
    const max = Math.max(...values);

    console.log('[MetricsService] Statistics calculated', {
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      stdDev: stdDev.toFixed(2),
      range: `${min}-${max}`,
    });

    return {
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      min,
      max,
    };
  }

  // Helper: Calculate cost for a single message
  private calculateMessageCost(
    inputTokens: number | null,
    outputTokens: number | null,
    modelId: string | null
  ): number {
    if (!inputTokens || !outputTokens || !modelId) {
      console.log('[MetricsService] Missing data for cost calculation', {
        modelId,
        hasInput: !!inputTokens,
        hasOutput: !!outputTokens,
      });
      return 0;
    }

    const cost = calculateCost(inputTokens, outputTokens, modelId);
    
    console.log('[MetricsService] Calculated message cost', {
      modelId,
      inputTokens,
      outputTokens,
      cost: cost.toFixed(6),
    });

    return cost;
  }

  // Helper: Calculate trend for a specific model over time
  private calculateModelTrend(
    evaluations: Array<{ createdAt: string; rating: number }>
  ): 'improving' | 'declining' | 'stable' {
    console.log('[MetricsService] Calculating model trend', {
      evaluationCount: evaluations.length,
    });

    if (evaluations.length < 10) {
      console.log('[MetricsService] Insufficient data for trend, defaulting to stable');
      return 'stable';
    }

    // Sort by date
    const sorted = [...evaluations].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Split into two halves
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    // Calculate averages
    const firstAvg = firstHalf.reduce((sum, e) => sum + e.rating, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, e) => sum + e.rating, 0) / secondHalf.length;

    // Calculate percentage change
    const change = (secondAvg - firstAvg) / firstAvg;
    const changePercent = (change * 100).toFixed(1);

    console.log('[MetricsService] Trend analysis', {
      firstHalfAvg: firstAvg.toFixed(2),
      secondHalfAvg: secondAvg.toFixed(2),
      changePercent: `${changePercent}%`,
    });

    // Thresholds for trend detection
    const improvingThreshold = 0.05; // 5% improvement
    const decliningThreshold = -0.05; // 5% decline

    if (change >= improvingThreshold) {
      return 'improving';
    } else if (change <= decliningThreshold) {
      return 'declining';
    } else {
      return 'stable';
    }
  }

  // Analyze success/failure patterns
  async getSuccessAnalysis(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<SuccessAnalysis> {
    try {
      const period = options.period || evaluationMetricsConfig.defaultPeriod;
      const endDate = options.endDate ? new Date(options.endDate) : new Date();
      const startDate = options.startDate
        ? new Date(options.startDate)
        : this.getDateRange(period, endDate).start;

      // Query evaluations
      const { data: evaluations, error } = await supabase
        .from('message_evaluations')
        .select('success, failure_tags, rating')
        .eq('evaluator_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .limit(evaluationMetricsConfig.maxEvaluationsAnalyzed);

      if (error) throw error;

      if (!evaluations || evaluations.length === 0) {
        return {
          period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
          successRate: 0,
          failureRate: 0,
          totalInteractions: 0,
          insights: ['No evaluation data available for this period'],
          commonFailureTags: [],
        };
      }

      const totalInteractions = evaluations.length;
      const successful = evaluations.filter((e) => e.success === true).length;
      const failed = evaluations.filter((e) => e.success === false).length;
      const successRate = successful / totalInteractions;
      const failureRate = failed / totalInteractions;

      // Extract common failure tags
      const failureTags = evaluations
        .filter((e) => e.failure_tags && e.failure_tags.length > 0)
        .flatMap((e) => e.failure_tags);

      const tagCounts = failureTags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const commonFailureTags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([tag]) => tag);

      // Generate insights
      const insights = this.generateInsights({
        userId,
        period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        totalEvaluations: totalInteractions,
        averageRating:
          evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / totalInteractions,
        successRate,
        qualityDistribution: {
          excellent: 0,
          good: 0,
          average: 0,
          poor: 0,
          veryPoor: 0,
        },
        breakdown: { successful, failed, unevaluated: 0 },
      });

      return {
        period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        successRate: Math.round(successRate * 1000) / 1000,
        failureRate: Math.round(failureRate * 1000) / 1000,
        totalInteractions,
        insights,
        commonFailureTags,
      };
    } catch (error) {
      throw new Error(
        `Failed to get success analysis: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // Helper: Generate insights
  private generateInsights(metrics: EvaluationMetrics): string[] {
    const insights: string[] = [];

    // Success rate insights
    if (metrics.successRate >= evaluationMetricsConfig.thresholds.minSuccessRate) {
      insights.push('Success rate is meeting or exceeding targets');
    } else {
      insights.push(
        `Success rate is below target (${Math.round(metrics.successRate * 100)}% vs ${Math.round(evaluationMetricsConfig.thresholds.minSuccessRate * 100)}%)`
      );
    }

    // Quality insights
    if (metrics.averageRating >= evaluationMetricsConfig.thresholds.excellentRating) {
      insights.push('Overall quality is excellent');
    } else if (metrics.averageRating >= evaluationMetricsConfig.thresholds.goodRating) {
      insights.push('Overall quality is good');
    } else if (metrics.averageRating >= evaluationMetricsConfig.thresholds.poorRating) {
      insights.push('Quality needs improvement');
    } else {
      insights.push('Quality requires immediate attention');
    }

    // Volume insights
    if (metrics.totalEvaluations < 10) {
      insights.push('Low evaluation volume - consider increasing feedback collection');
    }

    return insights;
  }

  // Compare two time periods
  async comparePeriods(
    userId: string,
    currentOptions: MetricsOptions,
    previousOptions: MetricsOptions
  ): Promise<PeriodComparison> {
    try {
      const currentPeriod = await this.getMetrics(userId, currentOptions);
      const previousPeriod = await this.getMetrics(userId, previousOptions);

      const changes = {
        ratingChange:
          Math.round((currentPeriod.averageRating - previousPeriod.averageRating) * 100) /
          100,
        successRateChange:
          Math.round((currentPeriod.successRate - previousPeriod.successRate) * 1000) /
          1000,
        volumeChange: currentPeriod.totalEvaluations - previousPeriod.totalEvaluations,
      };

      // Generate summary
      const ratingDirection =
        changes.ratingChange > 0 ? 'improved' : changes.ratingChange < 0 ? 'declined' : 'stable';
      const volumeDirection =
        changes.volumeChange > 0 ? 'increased' : changes.volumeChange < 0 ? 'decreased' : 'same';

      const summary = `Quality ${ratingDirection} by ${Math.abs(Math.round(changes.ratingChange * 100) / 100)} points with ${Math.abs(changes.volumeChange)} ${volumeDirection} evaluations`;

      return {
        currentPeriod,
        previousPeriod,
        changes,
        summary,
      };
    } catch (error) {
      throw new Error(
        `Failed to compare periods: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get model comparison analytics
   * Compares performance, cost, and quality across different AI models
   */
  async getModelComparison(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<ModelComparison> {
    try {
      console.log('[MetricsService] Starting model comparison analysis', {
        userId,
        options,
      });

      // Step 1: Set up date range
      const period = options.period || 'last_30_days';
      const endDate = options.endDate ? new Date(options.endDate) : new Date();
      const startDate = options.startDate
        ? new Date(options.startDate)
        : this.getDateRange(period, endDate).start;

      console.log('[MetricsService] Date range set', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      // Step 2: Query evaluations with message data (including model info)
      const { data: evaluations, error } = await supabase
        .from('message_evaluations')
        .select(`
          rating,
          success,
          created_at,
          messages!inner(
            model_id,
            provider,
            input_tokens,
            output_tokens
          )
        `)
        .eq('evaluator_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('messages.model_id', 'is', null)
        .limit(evaluationMetricsConfig.maxEvaluationsAnalyzed);

      if (error) {
        console.error('[MetricsService] Database error:', error);
        throw error;
      }

      console.log('[MetricsService] Query returned evaluations', {
        count: evaluations?.length || 0,
      });

      if (!evaluations || evaluations.length === 0) {
        console.log('[MetricsService] No evaluations found, returning empty result');
        return {
          period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
          models: [],
          bestModel: {
            byQuality: 'N/A',
            byCost: 'N/A',
            byValue: 'N/A',
          },
          recommendations: ['No model data available for this period'],
        };
      }

      // Continue with next block...
      return await this.processModelComparison(
        evaluations,
        startDate,
        endDate
      );
    } catch (error) {
      console.error('[MetricsService] Model comparison failed:', error);
      throw new Error(
        `Failed to get model comparison: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Process model comparison data (Part 2 of getModelComparison)
   */
  private async processModelComparison(
    evaluations: EvaluationWithMessage[],
    startDate: Date,
    endDate: Date
  ): Promise<ModelComparison> {
    console.log('[MetricsService] Processing model comparison data');

    // Step 3: Group evaluations by model
    const modelGroups = new Map<string, EvaluationWithMessage[]>();
    
    for (const evaluation of evaluations) {
      const message = evaluation.messages?.[0]; // Take first message from join
      const modelId = message?.model_id;
      if (!modelId) continue;

      if (!modelGroups.has(modelId)) {
        modelGroups.set(modelId, []);
      }
      modelGroups.get(modelId)!.push(evaluation);
    }

    console.log('[MetricsService] Grouped evaluations by model', {
      modelCount: modelGroups.size,
      models: Array.from(modelGroups.keys()),
    });

    // Step 4: Calculate metrics for each model
    const modelPerformances: ModelPerformance[] = [];

    for (const [modelId, modelEvaluations] of modelGroups.entries()) {
      console.log(`[MetricsService] Analyzing model: ${modelId}`, {
        evaluationCount: modelEvaluations.length,
      });

      // Extract ratings and success flags
      const ratings = modelEvaluations.map(e => e.rating).filter(r => r !== null);
      const successes = modelEvaluations.filter(e => e.success === true).length;
      
      // Calculate average rating
      const averageRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

      // Calculate success rate
      const successRate = modelEvaluations.length > 0
        ? successes / modelEvaluations.length
        : 0;

      // Calculate total cost
      let totalCost = 0;
      for (const evaluation of modelEvaluations) {
        const msg = evaluation.messages?.[0]; // Get first message from join
        if (msg?.input_tokens && msg?.output_tokens) {
          const cost = calculateCost(
            msg.input_tokens,
            msg.output_tokens,
            modelId
          );
          totalCost += cost;
        }
      }

      const averageCost = modelEvaluations.length > 0
        ? totalCost / modelEvaluations.length
        : 0;

      // Calculate quality per dollar (higher is better)
      const qualityPerDollar = averageCost > 0
        ? averageRating / averageCost
        : 0;

      // Calculate trend
      const trend = this.calculateModelTrend(
        modelEvaluations.map(e => ({
          createdAt: e.created_at,
          rating: e.rating,
        }))
      );

      // Get provider from first evaluation
      const provider = modelEvaluations[0]?.messages?.[0]?.provider || 'unknown';

      const performance: ModelPerformance = {
        modelId,
        provider,
        averageRating: Math.round(averageRating * 100) / 100,
        successRate: Math.round(successRate * 1000) / 1000,
        totalEvaluations: modelEvaluations.length,
        averageCost: Math.round(averageCost * 1000000) / 1000000,
        qualityPerDollar: Math.round(qualityPerDollar * 100) / 100,
        trend,
      };

      console.log(`[MetricsService] Model performance calculated`, performance);
      modelPerformances.push(performance);
    }

    // Continue with final processing...
    return this.finalizeModelComparison(
      modelPerformances,
      startDate,
      endDate
    );
  }

  /**
   * Finalize model comparison (Part 3 of getModelComparison)
   */
  private finalizeModelComparison(
    modelPerformances: ModelPerformance[],
    startDate: Date,
    endDate: Date
  ): ModelComparison {
    console.log('[MetricsService] Finalizing model comparison');

    // Step 5: Determine best models
    const sortedByQuality = [...modelPerformances].sort(
      (a, b) => b.averageRating - a.averageRating
    );
    const sortedByCost = [...modelPerformances].sort(
      (a, b) => a.averageCost - b.averageCost
    );
    const sortedByValue = [...modelPerformances].sort(
      (a, b) => b.qualityPerDollar - a.qualityPerDollar
    );

    const bestModel = {
      byQuality: sortedByQuality[0]?.modelId || 'N/A',
      byCost: sortedByCost[0]?.modelId || 'N/A',
      byValue: sortedByValue[0]?.modelId || 'N/A',
    };

    console.log('[MetricsService] Best models identified', bestModel);

    // Step 6: Generate recommendations
    const recommendations: string[] = [];

    if (sortedByQuality.length > 0) {
      const best = sortedByQuality[0];
      recommendations.push(
        `Highest quality: ${best.modelId} with ${best.averageRating.toFixed(2)} average rating`
      );
    }

    if (sortedByValue.length > 0) {
      const bestValue = sortedByValue[0];
      recommendations.push(
        `Best value: ${bestValue.modelId} with ${bestValue.qualityPerDollar.toFixed(2)} quality per dollar`
      );
    }

    if (sortedByCost.length > 0) {
      const cheapest = sortedByCost[0];
      recommendations.push(
        `Most cost-effective: ${cheapest.modelId} at $${cheapest.averageCost.toFixed(6)} per message`
      );
    }

    // Flag declining models
    const decliningModels = modelPerformances.filter(m => m.trend === 'declining');
    if (decliningModels.length > 0) {
      recommendations.push(
        `Warning: ${decliningModels.map(m => m.modelId).join(', ')} showing declining performance`
      );
    }

    // Flag improving models
    const improvingModels = modelPerformances.filter(m => m.trend === 'improving');
    if (improvingModels.length > 0) {
      recommendations.push(
        `Positive: ${improvingModels.map(m => m.modelId).join(', ')} showing improving performance`
      );
    }

    console.log('[MetricsService] Generated recommendations', {
      count: recommendations.length,
    });

    const result: ModelComparison = {
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      models: modelPerformances,
      bestModel,
      recommendations,
    };

    console.log('[MetricsService] Model comparison complete', {
      modelCount: modelPerformances.length,
    });

    return result;
  }

  // ============================================================
  // PHASE 3: TOOL ANALYTICS CORE
  // ============================================================

  /**
   * Analyze tool impact on evaluation quality
   * Returns metrics showing which tools improve/degrade performance
   */
  async getToolImpactAnalysis(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<ToolImpactAnalysis> {
    const { period = 'month' } = options;
    const endDateParam = options.endDate ? new Date(options.endDate) : undefined;
    const dateRange = this.getDateRange(period, endDateParam);
    const startDate = dateRange.start;
    const rangeEnd = dateRange.end;

    console.log('[MetricsService] Getting tool impact analysis', {
      userId,
      period,
      startDate: startDate.toISOString(),
      endDate: rangeEnd.toISOString(),
    });

    // Block 1: Query evaluations with tool data from messages
    const { data: evaluations, error } = await supabase
      .from('message_evaluations')
      .select(
        `
        rating,
        success,
        created_at,
        messages!inner (
          tools_called,
          tool_success,
          latency_ms
        )
      `
      )
      .eq('evaluator_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', rangeEnd.toISOString())
      .limit(evaluationMetricsConfig.maxEvaluationsAnalyzed);

    if (error) {
      console.error('[MetricsService] Error fetching tool data:', error);
      throw error;
    }

    console.log('[MetricsService] Fetched evaluations with tool data', {
      count: evaluations?.length || 0,
    });

    if (!evaluations || evaluations.length === 0) {
      console.log('[MetricsService] No tool data found, returning empty result');
      return {
        period: `${startDate.toISOString()} to ${rangeEnd.toISOString()}`,
        toolPerformance: [],
        correlations: [],
        recommendations: ['No tool usage data available for this period'],
      };
    }

    // Block 2: Process tool usage data
    return await this.processToolImpactData(
      evaluations,
      startDate,
      rangeEnd
    );
  }

  /**
   * Process tool impact data (Part 2 of getToolImpactAnalysis)
   * Block 2: Group evaluations by tool
   */
  private async processToolImpactData(
    evaluations: EvaluationWithTools[],
    startDate: Date,
    endDate: Date
  ): Promise<ToolImpactAnalysis> {
    console.log('[MetricsService] Processing tool impact data');

    // Group evaluations by tool
    const toolGroups = new Map<string, EvaluationWithTools[]>();
    const withToolEvaluations: EvaluationWithTools[] = [];
    const withoutToolEvaluations: EvaluationWithTools[] = [];

    for (const evaluation of evaluations) {
      const message = evaluation.messages?.[0];
      const toolsCalled = message?.tools_called;

      if (!toolsCalled || toolsCalled.length === 0) {
        withoutToolEvaluations.push(evaluation);
        continue;
      }

      // Add to with-tools group
      withToolEvaluations.push(evaluation);

      // Group by each tool used
      for (const tool of toolsCalled) {
        const toolName = tool.name;
        if (!toolName) continue;

        if (!toolGroups.has(toolName)) {
          toolGroups.set(toolName, []);
        }
        toolGroups.get(toolName)!.push(evaluation);
      }
    }

    console.log('[MetricsService] Grouped evaluations by tool', {
      toolCount: toolGroups.size,
      tools: Array.from(toolGroups.keys()),
      withTools: withToolEvaluations.length,
      withoutTools: withoutToolEvaluations.length,
    });

    // Continue with Block 3
    return await this.analyzeToolPerformance(
      toolGroups,
      withToolEvaluations,
      withoutToolEvaluations,
      startDate,
      endDate
    );
  }

  /**
   * Analyze tool performance (Part 3 of getToolImpactAnalysis)
   * Block 3: Calculate metrics for each tool
   */
  private async analyzeToolPerformance(
    toolGroups: Map<string, EvaluationWithTools[]>,
    withToolEvaluations: EvaluationWithTools[],
    withoutToolEvaluations: EvaluationWithTools[],
    startDate: Date,
    endDate: Date
  ): Promise<ToolImpactAnalysis> {
    console.log('[MetricsService] Analyzing tool performance');

    const toolPerformanceList: ToolPerformance[] = [];

    // Calculate metrics for each tool
    for (const [toolName, toolEvaluations] of toolGroups.entries()) {
      console.log(`[MetricsService] Analyzing tool: ${toolName}`, {
        evaluationCount: toolEvaluations.length,
      });

      // Extract ratings
      const ratings = toolEvaluations
        .map((e) => e.rating)
        .filter((r) => r !== null && r !== undefined);

      // Calculate average rating
      const averageRating =
        ratings.length > 0
          ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
          : 0;

      // Calculate success rate
      const successCount = toolEvaluations.filter((e) => e.success === true).length;
      const failureCount = toolEvaluations.filter((e) => e.success === false).length;
      const successRate =
        toolEvaluations.length > 0 ? successCount / toolEvaluations.length : 0;
      const failureRate =
        toolEvaluations.length > 0 ? failureCount / toolEvaluations.length : 0;

      // Calculate average latency
      const latencies = toolEvaluations
        .map((e) => e.messages?.[0]?.latency_ms)
        .filter((l) => l !== null && l !== undefined) as number[];

      const averageLatency =
        latencies.length > 0
          ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
          : 0;

      // TODO: Extract common failure tags (will do in next block)
      const commonFailureTags: string[] = [];

      const performance: ToolPerformance = {
        toolName,
        usageCount: toolEvaluations.length,
        averageRating: Math.round(averageRating * 100) / 100,
        successRate: Math.round(successRate * 1000) / 1000,
        failureRate: Math.round(failureRate * 1000) / 1000,
        commonFailureTags,
        averageLatency: Math.round(averageLatency),
      };

      console.log(`[MetricsService] Tool performance calculated`, performance);
      toolPerformanceList.push(performance);
    }

    // Continue with Block 4
    return await this.calculateToolCorrelations(
      toolPerformanceList,
      withToolEvaluations,
      withoutToolEvaluations,
      startDate,
      endDate
    );
  }

  /**
   * Calculate tool correlations (Part 4 of getToolImpactAnalysis)
   * Block 4: Compare quality with tools vs without tools
   */
  private async calculateToolCorrelations(
    toolPerformanceList: ToolPerformance[],
    withToolEvaluations: EvaluationWithTools[],
    withoutToolEvaluations: EvaluationWithTools[],
    startDate: Date,
    endDate: Date
  ): Promise<ToolImpactAnalysis> {
    console.log('[MetricsService] Calculating tool correlations');

    const correlations: ToolCorrelation[] = [];

    // Calculate baseline quality (without tools)
    const withoutToolRatings = withoutToolEvaluations
      .map((e) => e.rating)
      .filter((r) => r !== null && r !== undefined);

    const baselineQuality =
      withoutToolRatings.length > 0
        ? withoutToolRatings.reduce((sum, r) => sum + r, 0) / withoutToolRatings.length
        : 0;

    console.log('[MetricsService] Baseline quality (without tools)', {
      baselineQuality: baselineQuality.toFixed(2),
      sampleSize: withoutToolRatings.length,
    });

    // For each tool, calculate quality impact
    for (const toolPerf of toolPerformanceList) {
      const qualityImpact = baselineQuality > 0
        ? (toolPerf.averageRating - baselineQuality) / baselineQuality
        : 0;

      // Determine significance based on impact magnitude and sample size
      let significance: 'strong' | 'moderate' | 'weak';
      const absImpact = Math.abs(qualityImpact);
      
      if (absImpact >= 0.15 && toolPerf.usageCount >= 20) {
        significance = 'strong';
      } else if (absImpact >= 0.08 && toolPerf.usageCount >= 10) {
        significance = 'moderate';
      } else {
        significance = 'weak';
      }

      const correlation: ToolCorrelation = {
        toolName: toolPerf.toolName,
        qualityImpact: Math.round(qualityImpact * 1000) / 1000,
        significance,
      };

      console.log(`[MetricsService] Tool correlation calculated`, correlation);
      correlations.push(correlation);
    }

    // Continue with Block 5
    return this.generateToolRecommendations(
      toolPerformanceList,
      correlations,
      startDate,
      endDate
    );
  }

  /**
   * Generate tool recommendations (Part 5 of getToolImpactAnalysis)
   * Block 5: Create actionable recommendations
   */
  private generateToolRecommendations(
    toolPerformanceList: ToolPerformance[],
    correlations: ToolCorrelation[],
    startDate: Date,
    endDate: Date
  ): ToolImpactAnalysis {
    console.log('[MetricsService] Generating tool recommendations');

    const recommendations: string[] = [];

    // Sort tools by quality impact
    const sortedByImpact = [...correlations].sort(
      (a, b) => b.qualityImpact - a.qualityImpact
    );

    // Identify most impactful tools
    const strongPositive = sortedByImpact.filter(
      (c) => c.qualityImpact > 0 && c.significance === 'strong'
    );

    const strongNegative = sortedByImpact.filter(
      (c) => c.qualityImpact < 0 && c.significance === 'strong'
    );

    // Generate recommendations based on findings
    if (strongPositive.length > 0) {
      const topTool = strongPositive[0];
      const impact = (topTool.qualityImpact * 100).toFixed(1);
      recommendations.push(
        `Strong positive impact: ${topTool.toolName} improves quality by ${impact}%`
      );
    }

    if (strongNegative.length > 0) {
      const worstTool = strongNegative[strongNegative.length - 1];
      const impact = Math.abs(worstTool.qualityImpact * 100).toFixed(1);
      recommendations.push(
        `Warning: ${worstTool.toolName} decreases quality by ${impact}% - review usage`
      );
    }

    // Recommend most reliable tools
    const highSuccessTools = toolPerformanceList.filter(
      (t) => t.successRate >= 0.95 && t.usageCount >= 10
    );

    if (highSuccessTools.length > 0) {
      recommendations.push(
        `High reliability: ${highSuccessTools.map((t) => t.toolName).join(', ')} with >95% success rate`
      );
    }

    // Flag low-performing tools
    const lowSuccessTools = toolPerformanceList.filter(
      (t) => t.successRate < 0.7 && t.usageCount >= 10
    );

    if (lowSuccessTools.length > 0) {
      recommendations.push(
        `Low reliability: ${lowSuccessTools.map((t) => t.toolName).join(', ')} with <70% success rate`
      );
    }

    // Flag slow tools
    const slowTools = toolPerformanceList.filter(
      (t) => t.averageLatency > 5000 && t.usageCount >= 5
    );

    if (slowTools.length > 0) {
      recommendations.push(
        `Performance concern: ${slowTools.map((t) => t.toolName).join(', ')} with >5s average latency`
      );
    }

    // Default message if no strong findings
    if (recommendations.length === 0) {
      recommendations.push(
        'Tool impact analysis shows balanced performance across all tools'
      );
    }

    console.log('[MetricsService] Generated recommendations', {
      count: recommendations.length,
    });

    const result: ToolImpactAnalysis = {
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      toolPerformance: toolPerformanceList,
      correlations,
      recommendations,
    };

    console.log('[MetricsService] Tool impact analysis complete', {
      toolCount: toolPerformanceList.length,
      correlationCount: correlations.length,
    });

    return result;
  }

  // ============================================================
  // END PHASE 3: TOOL ANALYTICS CORE
  // ============================================================

  // ============================================================
  // PHASE 1: QUICK WINS - ERROR ANALYSIS
  // ============================================================

  /**
   * Analyze error patterns and fallback mechanism effectiveness
   * Uses previously unused fields: error_type, fallback_used
   */
  async getErrorAnalysis(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<import('./types').ErrorAnalysis> {
    const period = options.period || evaluationMetricsConfig.defaultPeriod;
    const endDate = options.endDate ? new Date(options.endDate) : new Date();
    const startDate = options.startDate
      ? new Date(options.startDate)
      : this.getDateRange(period, endDate).start;

    console.log('[MetricsService] Delegating to error analysis operation', {
      userId,
      period,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    });

    const { getErrorAnalysis } = await import('./operations/errorAnalysis');
    return getErrorAnalysis(userId, startDate, endDate);
  }

  /**
   * Analyze quality patterns by time of day and day of week
   * Identifies when users get best/worst responses
   */
  async getTemporalAnalysis(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<import('./types').TemporalAnalysis> {
    const period = options.period || evaluationMetricsConfig.defaultPeriod;
    const endDate = options.endDate ? new Date(options.endDate) : new Date();
    const startDate = options.startDate
      ? new Date(options.startDate)
      : this.getDateRange(period, endDate).start;

    console.log('[MetricsService] Delegating to temporal analysis operation', {
      userId,
      period,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    });

    const { getTemporalAnalysis } = await import('./operations/temporalAnalysis');
    return getTemporalAnalysis(userId, startDate, endDate);
  }

  // ============================================================
  // END PHASE 1: QUICK WINS
  // ============================================================

  // ============================================================
  // PHASE 2: DATA ENRICHMENT - TEXTUAL FEEDBACK ANALYSIS
  // ============================================================

  /**
   * Analyze textual feedback from notes, expected_behavior, and actual_behavior
   * Uses previously unused qualitative feedback fields
   */
  async getTextualFeedbackAnalysis(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<import('./types').TextualFeedbackAnalysis> {
    const period = options.period || evaluationMetricsConfig.defaultPeriod;
    const endDate = options.endDate ? new Date(options.endDate) : new Date();
    const startDate = options.startDate
      ? new Date(options.startDate)
      : this.getDateRange(period, endDate).start;

    console.log('[MetricsService] Delegating to textual feedback analysis operation', {
      userId,
      period,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    });

    const { getTextualFeedbackAnalysis } = await import('./operations/textualFeedbackAnalysis');
    return getTextualFeedbackAnalysis(userId, startDate, endDate);
  }

  /**
   * Analyze performance across custom benchmarks
   * Uses the benchmarks table for task-specific accuracy metrics
   */
  async getBenchmarkAnalysis(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<import('./types').BenchmarkAnalysis> {
    const period = options.period || evaluationMetricsConfig.defaultPeriod;
    const endDate = options.endDate ? new Date(options.endDate) : new Date();
    const startDate = options.startDate
      ? new Date(options.startDate)
      : this.getDateRange(period, endDate).start;

    console.log('[MetricsService] Delegating to benchmark analysis operation', {
      userId,
      period,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    });

    const { getBenchmarkAnalysis } = await import('./operations/benchmarkAnalysis');
    return getBenchmarkAnalysis(userId, startDate, endDate);
  }

  // ============================================================
  // END PHASE 2: DATA ENRICHMENT
  // ============================================================

  // ============================================================
  // PHASE 3: ADVANCED ANALYTICS - TIER 1: SENTIMENT ANALYSIS
  // ============================================================

  /**
   * Advanced sentiment analysis with multi-level classification and emotion detection
   * Uses enhanced textual analysis with phrase pattern matching
   */
  async getAdvancedSentimentAnalysis(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<import('./types').AdvancedSentimentAnalysis> {
    const period = options.period || evaluationMetricsConfig.defaultPeriod;
    const endDate = options.endDate ? new Date(options.endDate) : new Date();
    const startDate = options.startDate
      ? new Date(options.startDate)
      : this.getDateRange(period, endDate).start;

    console.log('[MetricsService] Delegating to advanced sentiment analysis operation', {
      userId,
      period,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    });

    const { getAdvancedSentimentAnalysis } = await import('./operations/advancedSentimentAnalysis');
    return getAdvancedSentimentAnalysis(userId, startDate, endDate);
  }

  // ============================================================
  // END PHASE 3 TIER 1: ADVANCED SENTIMENT ANALYSIS
  // ============================================================

  // ============================================================
  // PHASE 3: ADVANCED ANALYTICS - TIER 2: PREDICTIVE MODELING
  // ============================================================

  /**
   * Predictive quality modeling using linear regression
   * Forecasts quality trends and identifies risks of decline
   */
  async getPredictiveQualityModeling(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<import('./types').PredictiveQualityModel> {
    const period = options.period || evaluationMetricsConfig.defaultPeriod;
    const endDate = options.endDate ? new Date(options.endDate) : new Date();
    const startDate = options.startDate
      ? new Date(options.startDate)
      : this.getDateRange(period, endDate).start;

    console.log('[MetricsService] Delegating to predictive quality modeling operation', {
      userId,
      period,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    });

    const { getPredictiveQualityModeling } = await import('./operations/predictiveQualityModeling');
    return getPredictiveQualityModeling(userId, startDate, endDate);
  }

  // ============================================================
  // END PHASE 3 TIER 2: PREDICTIVE QUALITY MODELING
  // ============================================================

  // ============================================================
  // PHASE 3: ADVANCED ANALYTICS - TIER 3: ANOMALY DETECTION
  // ============================================================

  /**
   * Anomaly detection using statistical and temporal methods
   * Identifies outliers and unusual patterns in quality data
   */
  async getAnomalyDetection(
    userId: string,
    options: MetricsOptions = {}
  ): Promise<import('./types').AnomalyDetection> {
    const period = options.period || evaluationMetricsConfig.defaultPeriod;
    const endDate = options.endDate ? new Date(options.endDate) : new Date();
    const startDate = options.startDate
      ? new Date(options.startDate)
      : this.getDateRange(period, endDate).start;

    console.log('[MetricsService] Delegating to anomaly detection operation', {
      userId,
      period,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    });

    const { getAnomalyDetection } = await import('./operations/anomalyDetection');
    return getAnomalyDetection(userId, startDate, endDate);
  }

  // ============================================================
  // END PHASE 3 TIER 3: ANOMALY DETECTION
  // ============================================================

  // ============================================================
  // RAW DATA ACCESS FOR ANALYTICS EXPORT
  // ============================================================

  /**
   * Get raw quality data for export functionality
   * Returns evaluation-level data instead of summaries
   */
  async getRawQualityData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    evaluationId: string;
    messageId: string;
    conversationId: string;
    rating: number;
    success: boolean;
    failureTags: string[];
    feedback: string | null;
    model: string | null;
    provider: string | null;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    latencyMs: number | null;
    createdAt: string;
  }>> {
    console.log('[EvaluationMetrics] getRawQualityData started', { userId, startDate, endDate });
    try {
      const { data: evaluations, error } = await supabase
        .from('message_evaluations')
        .select(
          `
          id,
          message_id,
          conversation_id,
          rating,
          success,
          failure_tags,
          feedback,
          created_at,
          messages!inner(
            model_id,
            provider,
            input_tokens,
            output_tokens,
            latency_ms
          )
        `
        )
        .eq('evaluator_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(evaluationMetricsConfig.maxEvaluationsAnalyzed);

      if (error) {
        console.error('[EvaluationMetrics] Database query error:', error);
        throw error;
      }

      console.log('[EvaluationMetrics] Retrieved evaluations:', evaluations?.length || 0);

      return (evaluations || []).map((evaluation) => {
        const messages = evaluation.messages as unknown as {
          model_id: string | null;
          provider: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          latency_ms: number | null;
        };

        const inputTokens = messages?.input_tokens || 0;
        const outputTokens = messages?.output_tokens || 0;
        const model = messages?.model_id || 'unknown';
        const provider = messages?.provider || 'unknown';
        const cost = calculateCost(inputTokens, outputTokens, model);

        return {
          evaluationId: evaluation.id,
          messageId: evaluation.message_id,
          conversationId: evaluation.conversation_id,
          rating: evaluation.rating,
          success: evaluation.success,
          failureTags: evaluation.failure_tags || [],
          feedback: evaluation.feedback,
          model,
          provider,
          inputTokens,
          outputTokens,
          cost,
          latencyMs: messages?.latency_ms || null,
          createdAt: evaluation.created_at,
        };
      });
    } catch (error) {
      console.error('[EvaluationMetrics] getRawQualityData error:', error);
      throw new Error(
        `Failed to get raw quality data: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // ============================================================
  // END RAW DATA ACCESS FOR ANALYTICS EXPORT
  // ============================================================
}

export const evaluationMetricsService = new EvaluationMetricsService();
