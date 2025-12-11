// Benchmark Analysis Operation
// Analyzes task-specific performance using benchmarks table
// Date: October 20, 2025

import { supabase } from '@/lib/supabaseClient';
import type { BenchmarkAnalysis, BenchmarkResult, TaskTypePerformance } from '../types';

interface BenchmarkWithJudgments {
  id: string;
  name: string;
  task_type: string;
  pass_criteria: {
    min_score?: number;
    required_validators?: string[];
    custom_rules?: Record<string, unknown>;
  };
  judgments: Array<{
    id: string;
    passed: boolean | null;
    score: number | null;
    created_at: string;
  }>;
}

/**
 * Analyzes performance across custom benchmarks
 * Uses the benchmarks table and benchmark_id in judgments
 */
export async function getBenchmarkAnalysis(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<BenchmarkAnalysis> {
  console.log('[BenchmarkAnalysis] Starting analysis', {
    userId,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
  });

  // Query benchmarks with their judgments
  const { data: benchmarks, error: queryError } = await supabase
    .from('benchmarks')
    .select(
      `
      id,
      name,
      task_type,
      pass_criteria,
      judgments!inner (
        id,
        passed,
        score,
        created_at
      )
    `
    )
    .eq('created_by', userId)
    .gte('judgments.created_at', startDate.toISOString())
    .lte('judgments.created_at', endDate.toISOString());

  if (queryError) {
    console.error('[BenchmarkAnalysis] Query failed:', queryError);
    throw new Error(`Failed to fetch benchmark data: ${queryError.message}`);
  }

  if (!benchmarks || benchmarks.length === 0) {
    console.log('[BenchmarkAnalysis] No benchmarks found in period');
    return createEmptyAnalysis(startDate, endDate);
  }

  console.log('[BenchmarkAnalysis] Processing benchmarks:', benchmarks.length);

  const typedBenchmarks = benchmarks as unknown as BenchmarkWithJudgments[];

  // Calculate metrics
  const benchmarkResults = analyzeBenchmarkResults(typedBenchmarks);
  const taskTypePerformance = analyzeTaskTypePerformance(typedBenchmarks);
  const overallMetrics = calculateOverallMetrics(benchmarkResults);
  const insights = generateInsights(benchmarkResults, taskTypePerformance, overallMetrics);

  const analysis: BenchmarkAnalysis = {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    benchmarksAnalyzed: typedBenchmarks.length,
    totalJudgments: overallMetrics.totalJudgments,
    overallAccuracy: overallMetrics.overallAccuracy,
    benchmarkResults,
    taskTypePerformance,
    passingRate: overallMetrics.passingRate,
    insights,
  };

  console.log('[BenchmarkAnalysis] Analysis complete:', {
    benchmarksAnalyzed: analysis.benchmarksAnalyzed,
    totalJudgments: analysis.totalJudgments,
    overallAccuracy: analysis.overallAccuracy,
  });

  return analysis;
}

/**
 * Analyze results for each benchmark
 */
function analyzeBenchmarkResults(benchmarks: BenchmarkWithJudgments[]): BenchmarkResult[] {
  return benchmarks.map((benchmark) => {
    const judgments = benchmark.judgments || [];
    const total = judgments.length;
    const passed = judgments.filter((j) => j.passed === true).length;
    const failed = judgments.filter((j) => j.passed === false).length;

    // Calculate average score (only from judgments with scores)
    const scoresAvailable = judgments.filter((j) => j.score !== null);
    const avgScore = scoresAvailable.length > 0
      ? scoresAvailable.reduce((sum, j) => sum + (j.score || 0), 0) / scoresAvailable.length
      : 0;

    const passRate = total > 0 ? (passed / total) * 100 : 0;

    return {
      benchmarkId: benchmark.id,
      benchmarkName: benchmark.name,
      taskType: benchmark.task_type,
      totalJudgments: total,
      passedJudgments: passed,
      failedJudgments: failed,
      passRate: Number(passRate.toFixed(1)),
      averageScore: Number(avgScore.toFixed(2)),
      passCriteria: {
        minScore: benchmark.pass_criteria?.min_score || 0.6,
        requiredValidators: benchmark.pass_criteria?.required_validators || [],
      },
    };
  });
}

/**
 * Analyze performance grouped by task type
 */
function analyzeTaskTypePerformance(benchmarks: BenchmarkWithJudgments[]): TaskTypePerformance[] {
  const taskTypeMap = new Map<string, {
    benchmarks: BenchmarkWithJudgments[];
    totalJudgments: number;
    totalPassed: number;
    totalScores: number[];
  }>();

  benchmarks.forEach((benchmark) => {
    const judgments = benchmark.judgments || [];
    const passed = judgments.filter((j) => j.passed === true).length;
    const scores = judgments.filter((j) => j.score !== null).map((j) => j.score!);

    const existing = taskTypeMap.get(benchmark.task_type);
    if (existing) {
      existing.benchmarks.push(benchmark);
      existing.totalJudgments += judgments.length;
      existing.totalPassed += passed;
      existing.totalScores.push(...scores);
    } else {
      taskTypeMap.set(benchmark.task_type, {
        benchmarks: [benchmark],
        totalJudgments: judgments.length,
        totalPassed: passed,
        totalScores: scores,
      });
    }
  });

  // Convert to array
  const performance: TaskTypePerformance[] = Array.from(taskTypeMap.entries()).map(
    ([taskType, data]) => {
      const avgPassRate = data.totalJudgments > 0
        ? (data.totalPassed / data.totalJudgments) * 100
        : 0;

      const avgScore = data.totalScores.length > 0
        ? data.totalScores.reduce((a, b) => a + b, 0) / data.totalScores.length
        : 0;

      // Find top benchmark by pass rate
      const topBenchmark = data.benchmarks.reduce((best, current) => {
        const currentPassRate = current.judgments.length > 0
          ? (current.judgments.filter((j) => j.passed).length / current.judgments.length) * 100
          : 0;
        const bestPassRate = best.judgments.length > 0
          ? (best.judgments.filter((j) => j.passed).length / best.judgments.length) * 100
          : 0;
        return currentPassRate > bestPassRate ? current : best;
      });

      return {
        taskType,
        benchmarkCount: data.benchmarks.length,
        totalJudgments: data.totalJudgments,
        averagePassRate: Number(avgPassRate.toFixed(1)),
        averageScore: Number(avgScore.toFixed(2)),
        topBenchmark: topBenchmark.name,
      };
    }
  );

  return performance.sort((a, b) => b.totalJudgments - a.totalJudgments);
}

/**
 * Calculate overall metrics across all benchmarks
 */
function calculateOverallMetrics(
  benchmarkResults: BenchmarkResult[]
): { totalJudgments: number; overallAccuracy: number; passingRate: number } {
  const totalJudgments = benchmarkResults.reduce((sum, b) => sum + b.totalJudgments, 0);
  const totalPassed = benchmarkResults.reduce((sum, b) => sum + b.passedJudgments, 0);

  const overallAccuracy = totalJudgments > 0
    ? (totalPassed / totalJudgments) * 100
    : 0;

  // Calculate how many benchmarks are meeting their pass criteria
  const benchmarksMeetingCriteria = benchmarkResults.filter(
    (b) => b.averageScore >= b.passCriteria.minScore
  ).length;

  const passingRate = benchmarkResults.length > 0
    ? (benchmarksMeetingCriteria / benchmarkResults.length) * 100
    : 0;

  return {
    totalJudgments,
    overallAccuracy: Number(overallAccuracy.toFixed(1)),
    passingRate: Number(passingRate.toFixed(1)),
  };
}

/**
 * Generate actionable insights
 */
function generateInsights(
  benchmarkResults: BenchmarkResult[],
  taskTypePerformance: TaskTypePerformance[],
  overallMetrics: { overallAccuracy: number; passingRate: number }
): string[] {
  const insights: string[] = [];

  // Overall performance
  if (overallMetrics.overallAccuracy >= 80) {
    insights.push(`Strong overall accuracy: ${overallMetrics.overallAccuracy}% across all benchmarks`);
  } else if (overallMetrics.overallAccuracy < 60) {
    insights.push(`Low overall accuracy: ${overallMetrics.overallAccuracy}% - review benchmark criteria or model performance`);
  }

  // Top performing benchmark
  if (benchmarkResults.length > 0) {
    const topBenchmark = benchmarkResults.reduce((best, current) =>
      current.passRate > best.passRate ? current : best
    );
    insights.push(
      `Best performing benchmark: "${topBenchmark.benchmarkName}" (${topBenchmark.passRate}% pass rate)`
    );
  }

  // Struggling benchmarks
  const strugglingBenchmarks = benchmarkResults.filter((b) => b.passRate < 50);
  if (strugglingBenchmarks.length > 0) {
    insights.push(
      `${strugglingBenchmarks.length} benchmarks with <50% pass rate: ${strugglingBenchmarks.map((b) => b.benchmarkName).join(', ')}`
    );
  }

  // Task type insights
  if (taskTypePerformance.length > 0) {
    const bestTaskType = taskTypePerformance.reduce((best, current) =>
      current.averagePassRate > best.averagePassRate ? current : best
    );
    insights.push(
      `Strongest task type: ${bestTaskType.taskType} (${bestTaskType.averagePassRate}% avg pass rate)`
    );

    const worstTaskType = taskTypePerformance.reduce((worst, current) =>
      current.averagePassRate < worst.averagePassRate ? current : worst
    );
    if (worstTaskType.averagePassRate < 60) {
      insights.push(
        `Weakest task type: ${worstTaskType.taskType} (${worstTaskType.averagePassRate}% avg pass rate) - needs improvement`
      );
    }
  }

  // Benchmark coverage
  if (benchmarkResults.length < 3) {
    insights.push('Limited benchmark coverage - consider creating more benchmarks for comprehensive evaluation');
  }

  return insights;
}

/**
 * Create empty analysis for periods with no data
 */
function createEmptyAnalysis(startDate: Date, endDate: Date): BenchmarkAnalysis {
  return {
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    benchmarksAnalyzed: 0,
    totalJudgments: 0,
    overallAccuracy: 0,
    benchmarkResults: [],
    taskTypePerformance: [],
    passingRate: 0,
    insights: ['No benchmark data available for this period'],
  };
}
