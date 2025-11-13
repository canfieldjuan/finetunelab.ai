// System Monitor Tool - User Activity Service
// Date: October 21, 2025

import { supabase } from '../../supabaseClient';

/**
 * User activity metrics
 */
export interface UserActivityMetrics {
  activeUsers: number;
  totalSessions: number;
  avgSessionDuration: number;
  toolExecutionsPerUser: number;
  peakActivityHour: number;
  activityTrend: 'increasing' | 'stable' | 'decreasing';
  periodCovered: string;
}

/**
 * User activity correlation with performance
 */
export interface ActivityCorrelation {
  userActivity: UserActivityMetrics;
  performanceImpact: {
    correlationStrength: 'strong' | 'moderate' | 'weak' | 'none';
    avgResponseTimeChange: number;
    errorRateChange: number;
    insights: string[];
  };
}

/**
 * Service for monitoring user activity and correlating with system performance
 */
export class UserActivityService {
  private logger = console;

  /**
   * Get user activity metrics for a specified period
   * @param periodHours Number of hours to analyze (default: 24)
   */
  async getActivityMetrics(periodHours: number = 24): Promise<UserActivityMetrics> {
    this.logger.debug(
      `[UserActivity] Fetching activity metrics for last ${periodHours} hours...`
    );

    try {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - periodHours);

      // Get tool executions for the period
      const { data: executions, error: execError } = await supabase
        .from('tool_executions')
        .select('user_id, created_at, duration')
        .gte('created_at', startTime.toISOString())
        .order('created_at', { ascending: true });

      if (execError) {
        this.logger.error(
          '[UserActivity] Error fetching tool executions:',
          execError.message
        );
        return this.getDefaultMetrics(periodHours);
      }

      if (!executions || executions.length === 0) {
        this.logger.debug('[UserActivity] No activity found in the period.');
        return this.getDefaultMetrics(periodHours);
      }

      // Calculate metrics
      const uniqueUsers = new Set(executions.map((e) => e.user_id)).size;
      const totalExecutions = executions.length;
      const toolExecutionsPerUser = uniqueUsers > 0 ? totalExecutions / uniqueUsers : 0;

      // Calculate peak activity hour
      const hourlyActivity = new Map<number, number>();
      executions.forEach((exec) => {
        const hour = new Date(exec.created_at).getHours();
        hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + 1);
      });

      let peakActivityHour = 0;
      let maxActivity = 0;
      hourlyActivity.forEach((count, hour) => {
        if (count > maxActivity) {
          maxActivity = count;
          peakActivityHour = hour;
        }
      });

      // Determine activity trend
      const activityTrend = this.calculateActivityTrend(executions, periodHours);

      this.logger.debug(
        `[UserActivity] Activity metrics: ${uniqueUsers} users, ${totalExecutions} executions, peak at ${peakActivityHour}:00`
      );

      return {
        activeUsers: uniqueUsers,
        totalSessions: uniqueUsers,
        avgSessionDuration: 0,
        toolExecutionsPerUser: Math.round(toolExecutionsPerUser * 10) / 10,
        peakActivityHour,
        activityTrend,
        periodCovered: `Last ${periodHours} hours`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[UserActivity] Error calculating metrics:', errorMessage);
      return this.getDefaultMetrics(periodHours);
    }
  }

  /**
   * Calculate activity trend by comparing first half vs second half of period
   */
  private calculateActivityTrend(
    executions: Array<{ created_at: string }>,
    periodHours: number
  ): 'increasing' | 'stable' | 'decreasing' {
    if (executions.length === 0) return 'stable';

    const midPoint = new Date();
    midPoint.setHours(midPoint.getHours() - periodHours / 2);

    const firstHalfCount = executions.filter(
      (e) => new Date(e.created_at) < midPoint
    ).length;
    const secondHalfCount = executions.length - firstHalfCount;

    // Calculate percentage change
    const change =
      firstHalfCount > 0 ? ((secondHalfCount - firstHalfCount) / firstHalfCount) * 100 : 0;

    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Get default metrics when no data is available
   */
  private getDefaultMetrics(periodHours: number): UserActivityMetrics {
    return {
      activeUsers: 0,
      totalSessions: 0,
      avgSessionDuration: 0,
      toolExecutionsPerUser: 0,
      peakActivityHour: 0,
      activityTrend: 'stable',
      periodCovered: `Last ${periodHours} hours`,
    };
  }

  /**
   * Correlate user activity with system performance
   * @param periodHours Number of hours to analyze
   */
  async correlateWithPerformance(periodHours: number = 24): Promise<ActivityCorrelation> {
    this.logger.debug(
      `[UserActivity] Correlating activity with performance for last ${periodHours} hours...`
    );

    try {
      const activityMetrics = await this.getActivityMetrics(periodHours);

      // Get performance metrics for current and previous period
      const currentStartTime = new Date();
      currentStartTime.setHours(currentStartTime.getHours() - periodHours);

      const previousStartTime = new Date(currentStartTime);
      previousStartTime.setHours(previousStartTime.getHours() - periodHours);

      // Fetch current period performance
      const { data: currentData, error: currentError } = await supabase
        .from('tool_executions')
        .select('duration, error')
        .gte('created_at', currentStartTime.toISOString());

      if (currentError) {
        this.logger.error(
          '[UserActivity] Error fetching current performance:',
          currentError.message
        );
        return this.getDefaultCorrelation(activityMetrics);
      }

      // Fetch previous period performance
      const { data: previousData, error: previousError } = await supabase
        .from('tool_executions')
        .select('duration, error')
        .gte('created_at', previousStartTime.toISOString())
        .lt('created_at', currentStartTime.toISOString());

      if (previousError) {
        this.logger.error(
          '[UserActivity] Error fetching previous performance:',
          previousError.message
        );
        return this.getDefaultCorrelation(activityMetrics);
      }

      // Calculate performance metrics
      const currentAvgDuration =
        currentData && currentData.length > 0
          ? currentData.reduce((sum, e) => sum + (e.duration || 0), 0) / currentData.length
          : 0;

      const previousAvgDuration =
        previousData && previousData.length > 0
          ? previousData.reduce((sum, e) => sum + (e.duration || 0), 0) / previousData.length
          : 0;

      const currentErrorRate =
        currentData && currentData.length > 0
          ? (currentData.filter((e) => e.error !== null).length / currentData.length) * 100
          : 0;

      const previousErrorRate =
        previousData && previousData.length > 0
          ? (previousData.filter((e) => e.error !== null).length / previousData.length) * 100
          : 0;

      // Calculate changes
      const avgResponseTimeChange =
        previousAvgDuration > 0
          ? ((currentAvgDuration - previousAvgDuration) / previousAvgDuration) * 100
          : 0;

      const errorRateChange = currentErrorRate - previousErrorRate;

      // Determine correlation strength and generate insights
      const correlationStrength = this.determineCorrelationStrength(
        activityMetrics.activityTrend,
        avgResponseTimeChange,
        errorRateChange
      );

      const insights = this.generateInsights(
        activityMetrics,
        avgResponseTimeChange,
        errorRateChange
      );

      this.logger.debug(
        `[UserActivity] Correlation: ${correlationStrength}, Response time change: ${avgResponseTimeChange.toFixed(2)}%`
      );

      return {
        userActivity: activityMetrics,
        performanceImpact: {
          correlationStrength,
          avgResponseTimeChange: Math.round(avgResponseTimeChange * 10) / 10,
          errorRateChange: Math.round(errorRateChange * 10) / 10,
          insights,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[UserActivity] Error correlating with performance:', errorMessage);
      const activityMetrics = await this.getActivityMetrics(periodHours);
      return this.getDefaultCorrelation(activityMetrics);
    }
  }

  /**
   * Determine the strength of correlation between activity and performance
   */
  private determineCorrelationStrength(
    activityTrend: 'increasing' | 'stable' | 'decreasing',
    responseTimeChange: number,
    errorRateChange: number
  ): 'strong' | 'moderate' | 'weak' | 'none' {
    const significantChange = Math.abs(responseTimeChange) > 20 || Math.abs(errorRateChange) > 5;
    const moderateChange =
      Math.abs(responseTimeChange) > 10 || Math.abs(errorRateChange) > 2;

    if (activityTrend === 'increasing') {
      if (responseTimeChange > 0 || errorRateChange > 0) {
        if (significantChange) return 'strong';
        if (moderateChange) return 'moderate';
        return 'weak';
      }
    } else if (activityTrend === 'decreasing') {
      if (responseTimeChange < 0 || errorRateChange < 0) {
        if (significantChange) return 'strong';
        if (moderateChange) return 'moderate';
        return 'weak';
      }
    }

    return 'none';
  }

  /**
   * Generate actionable insights based on correlation data
   */
  private generateInsights(
    activity: UserActivityMetrics,
    responseTimeChange: number,
    errorRateChange: number
  ): string[] {
    const insights: string[] = [];

    // Activity trend insights
    if (activity.activityTrend === 'increasing') {
      insights.push(
        `User activity is increasing (${activity.activeUsers} active users). Monitor resource capacity.`
      );
    } else if (activity.activityTrend === 'decreasing') {
      insights.push(`User activity is decreasing. Consider investigating user engagement.`);
    }

    // Performance impact insights
    if (responseTimeChange > 20) {
      insights.push(
        `Response times increased by ${responseTimeChange.toFixed(1)}%. System may be under load.`
      );
    } else if (responseTimeChange < -20) {
      insights.push(
        `Response times improved by ${Math.abs(responseTimeChange).toFixed(1)}%. Optimizations are working.`
      );
    }

    if (errorRateChange > 5) {
      insights.push(`Error rate increased by ${errorRateChange.toFixed(1)}%. Investigate errors.`);
    } else if (errorRateChange < -5) {
      insights.push(
        `Error rate decreased by ${Math.abs(errorRateChange).toFixed(1)}%. System stability improved.`
      );
    }

    // Peak activity insights
    if (activity.peakActivityHour >= 9 && activity.peakActivityHour <= 17) {
      insights.push(
        `Peak activity at ${activity.peakActivityHour}:00 (business hours). Ensure adequate capacity.`
      );
    } else {
      insights.push(
        `Peak activity at ${activity.peakActivityHour}:00 (off-hours). Consider scheduled maintenance windows.`
      );
    }

    // Tool usage insights
    if (activity.toolExecutionsPerUser > 50) {
      insights.push(
        `High tool usage per user (${activity.toolExecutionsPerUser}). Users are heavily engaged.`
      );
    } else if (activity.toolExecutionsPerUser < 5 && activity.activeUsers > 0) {
      insights.push(
        `Low tool usage per user (${activity.toolExecutionsPerUser}). Consider user training or UX improvements.`
      );
    }

    return insights;
  }

  /**
   * Get default correlation when data is insufficient
   */
  private getDefaultCorrelation(activityMetrics: UserActivityMetrics): ActivityCorrelation {
    return {
      userActivity: activityMetrics,
      performanceImpact: {
        correlationStrength: 'none',
        avgResponseTimeChange: 0,
        errorRateChange: 0,
        insights: ['Insufficient data to determine performance correlation.'],
      },
    };
  }
}
