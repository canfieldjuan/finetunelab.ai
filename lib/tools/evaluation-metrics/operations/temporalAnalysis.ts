// Temporal Analysis Operation
// Analyzes quality patterns by time of day and day of week
// Date: October 20, 2025

import { supabase } from '@/lib/supabaseClient';
import type { TemporalAnalysis, HourlyMetrics, DayOfWeekMetrics } from '../types';

interface EvaluationWithTimestamp {
  rating: number;
  success: boolean;
  created_at: string;
}

/**
 * Analyzes quality patterns across different times
 * Identifies when users get best/worst responses
 */
export async function getTemporalAnalysis(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<TemporalAnalysis> {
  console.log('[TemporalAnalysis] Starting analysis', {
    userId,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
  });

  // Query all evaluations in period
  const { data: evaluations, error: queryError } = await supabase
    .from('message_evaluations')
    .select('rating, success, created_at')
    .eq('evaluator_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });

  if (queryError) {
    console.error('[TemporalAnalysis] Query failed:', queryError);
    throw new Error(`Failed to fetch evaluation data: ${queryError.message}`);
  }

  if (!evaluations || evaluations.length === 0) {
    console.log('[TemporalAnalysis] No data found in period');
    return createEmptyAnalysis(startDate, endDate);
  }

  console.log('[TemporalAnalysis] Processing evaluations:', evaluations.length);

  const typedEvaluations = evaluations as EvaluationWithTimestamp[];

  // Analyze by hour and day
  const hourlyDistribution = analyzeByHour(typedEvaluations);
  const dayOfWeekDistribution = analyzeByDayOfWeek(typedEvaluations);
  const peakPerformance = findPeakPerformance(hourlyDistribution, dayOfWeekDistribution);
  const insights = generateInsights(hourlyDistribution, dayOfWeekDistribution, peakPerformance);

  const analysis: TemporalAnalysis = {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    hourlyDistribution,
    dayOfWeekDistribution,
    peakPerformance,
    insights,
  };

  console.log('[TemporalAnalysis] Analysis complete:', {
    hourlyDataPoints: hourlyDistribution.length,
    dayDataPoints: dayOfWeekDistribution.length,
    bestHour: peakPerformance.bestHour,
    bestDay: peakPerformance.bestDay,
  });

  return analysis;
}

/**
 * Analyze evaluations grouped by hour of day (0-23)
 */
function analyzeByHour(evaluations: EvaluationWithTimestamp[]): HourlyMetrics[] {
  const hourMap = new Map<number, { ratings: number[]; successCount: number }>();

  evaluations.forEach((evaluation) => {
    const date = new Date(evaluation.created_at);
    const hour = date.getHours();

    const existing = hourMap.get(hour);
    if (existing) {
      existing.ratings.push(evaluation.rating);
      if (evaluation.success) existing.successCount += 1;
    } else {
      hourMap.set(hour, {
        ratings: [evaluation.rating],
        successCount: evaluation.success ? 1 : 0,
      });
    }
  });

  // Convert to metrics array
  const metrics: HourlyMetrics[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const data = hourMap.get(hour);
    if (data && data.ratings.length > 0) {
      const avgRating = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
      const successRate = (data.successCount / data.ratings.length) * 100;

      metrics.push({
        hour,
        evaluationCount: data.ratings.length,
        averageRating: Number(avgRating.toFixed(2)),
        successRate: Number(successRate.toFixed(1)),
      });
    } else {
      metrics.push({
        hour,
        evaluationCount: 0,
        averageRating: 0,
        successRate: 0,
      });
    }
  }

  return metrics;
}

/**
 * Analyze evaluations grouped by day of week
 */
function analyzeByDayOfWeek(evaluations: EvaluationWithTimestamp[]): DayOfWeekMetrics[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayMap = new Map<string, { ratings: number[]; successCount: number }>();

  evaluations.forEach((evaluation) => {
    const date = new Date(evaluation.created_at);
    const dayName = dayNames[date.getDay()];

    const existing = dayMap.get(dayName);
    if (existing) {
      existing.ratings.push(evaluation.rating);
      if (evaluation.success) existing.successCount += 1;
    } else {
      dayMap.set(dayName, {
        ratings: [evaluation.rating],
        successCount: evaluation.success ? 1 : 0,
      });
    }
  });

  // Convert to metrics array
  const metrics: DayOfWeekMetrics[] = dayNames.map((day) => {
    const data = dayMap.get(day);
    if (data && data.ratings.length > 0) {
      const avgRating = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
      const successRate = (data.successCount / data.ratings.length) * 100;

      return {
        day,
        evaluationCount: data.ratings.length,
        averageRating: Number(avgRating.toFixed(2)),
        successRate: Number(successRate.toFixed(1)),
      };
    } else {
      return {
        day,
        evaluationCount: 0,
        averageRating: 0,
        successRate: 0,
      };
    }
  });

  return metrics;
}

/**
 * Find best performing time periods
 */
function findPeakPerformance(
  hourlyMetrics: HourlyMetrics[],
  dayMetrics: DayOfWeekMetrics[]
): {
  bestHour: number;
  bestDay: string;
  bestHourRating: number;
  bestDayRating: number;
} {
  // Find best hour (with at least some data)
  const hoursWithData = hourlyMetrics.filter((h) => h.evaluationCount > 0);
  const bestHourMetric = hoursWithData.reduce(
    (best, current) => (current.averageRating > best.averageRating ? current : best),
    hoursWithData[0] || { hour: 12, averageRating: 0 }
  );

  // Find best day (with at least some data)
  const daysWithData = dayMetrics.filter((d) => d.evaluationCount > 0);
  const bestDayMetric = daysWithData.reduce(
    (best, current) => (current.averageRating > best.averageRating ? current : best),
    daysWithData[0] || { day: 'Monday', averageRating: 0 }
  );

  return {
    bestHour: bestHourMetric.hour,
    bestDay: bestDayMetric.day,
    bestHourRating: bestHourMetric.averageRating,
    bestDayRating: bestDayMetric.averageRating,
  };
}

/**
 * Generate actionable insights from temporal patterns
 */
function generateInsights(
  hourlyMetrics: HourlyMetrics[],
  dayMetrics: DayOfWeekMetrics[],
  peakPerformance: ReturnType<typeof findPeakPerformance>
): string[] {
  const insights: string[] = [];

  // Peak performance times
  insights.push(
    `Best performance at ${peakPerformance.bestHour}:00 (${peakPerformance.bestHourRating}/5 avg rating)`
  );
  insights.push(
    `Best performance on ${peakPerformance.bestDay} (${peakPerformance.bestDayRating}/5 avg rating)`
  );

  // Find worst performing times
  const hoursWithData = hourlyMetrics.filter((h) => h.evaluationCount > 0);
  if (hoursWithData.length > 0) {
    const worstHour = hoursWithData.reduce((worst, current) =>
      current.averageRating < worst.averageRating ? current : worst
    );
    if (worstHour.averageRating < 3) {
      insights.push(
        `Lowest quality at ${worstHour.hour}:00 (${worstHour.averageRating}/5) - consider investigating`
      );
    }
  }

  // Weekend vs weekday analysis
  const weekendDays = dayMetrics.filter((d) => d.day === 'Saturday' || d.day === 'Sunday');
  const weekdayDays = dayMetrics.filter((d) => d.day !== 'Saturday' && d.day !== 'Sunday');

  const weekendAvg =
    weekendDays.reduce((sum, d) => sum + d.averageRating * d.evaluationCount, 0) /
    weekendDays.reduce((sum, d) => sum + d.evaluationCount, 0);

  const weekdayAvg =
    weekdayDays.reduce((sum, d) => sum + d.averageRating * d.evaluationCount, 0) /
    weekdayDays.reduce((sum, d) => sum + d.evaluationCount, 0);

  if (!isNaN(weekendAvg) && !isNaN(weekdayAvg)) {
    const diff = ((weekendAvg - weekdayAvg) / weekdayAvg) * 100;
    if (Math.abs(diff) > 5) {
      insights.push(
        `${diff > 0 ? 'Weekend' : 'Weekday'} quality ${Math.abs(diff).toFixed(1)}% ${diff > 0 ? 'higher' : 'lower'} than ${diff > 0 ? 'weekdays' : 'weekends'}`
      );
    }
  }

  // Usage pattern insights
  const totalHourlyEvals = hourlyMetrics.reduce((sum, h) => sum + h.evaluationCount, 0);
  const peakHourCount = hourlyMetrics.reduce(
    (max, h) => (h.evaluationCount > max ? h.evaluationCount : max),
    0
  );

  if (totalHourlyEvals > 0) {
    const peakPercent = (peakHourCount / totalHourlyEvals) * 100;
    if (peakPercent > 20) {
      const peakHour = hourlyMetrics.find((h) => h.evaluationCount === peakHourCount);
      if (peakHour) {
        insights.push(
          `${peakPercent.toFixed(1)}% of usage concentrated at ${peakHour.hour}:00 - consider resource optimization`
        );
      }
    }
  }

  return insights;
}

/**
 * Create empty analysis for periods with no data
 */
function createEmptyAnalysis(startDate: Date, endDate: Date): TemporalAnalysis {
  const emptyHourly: HourlyMetrics[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    evaluationCount: 0,
    averageRating: 0,
    successRate: 0,
  }));

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const emptyDaily: DayOfWeekMetrics[] = dayNames.map((day) => ({
    day,
    evaluationCount: 0,
    averageRating: 0,
    successRate: 0,
  }));

  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    hourlyDistribution: emptyHourly,
    dayOfWeekDistribution: emptyDaily,
    peakPerformance: {
      bestHour: 12,
      bestDay: 'Monday',
      bestHourRating: 0,
      bestDayRating: 0,
    },
    insights: ['No data available for this period'],
  };
}
