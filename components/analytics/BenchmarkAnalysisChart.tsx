"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { BenchmarkAnalysis } from '@/lib/tools/evaluation-metrics/types';

interface BenchmarkAnalysisChartProps {
  data: BenchmarkAnalysis | null;
}

export function BenchmarkAnalysisChart({ data }: BenchmarkAnalysisChartProps) {
  console.log('[BenchmarkAnalysisChart] Rendering with data:', {
    hasBenchmarks: !!data,
    benchmarkCount: data?.benchmarksAnalyzed || 0,
    totalJudgments: data?.totalJudgments || 0
  });

  if (!data || data.benchmarksAnalyzed === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Benchmark Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No benchmark data available. To track benchmark performance:
          </p>
          <ul className="mt-2 text-xs text-gray-400 list-disc list-inside space-y-1">
            <li>Create benchmarks with custom pass criteria</li>
            <li>Run batch tests with benchmark_id parameter</li>
            <li>Evaluate test judgments against benchmark criteria</li>
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benchmark Performance</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Task-specific performance evaluation across benchmarks
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-500">Benchmarks</p>
              <p className="text-2xl font-bold">{data.benchmarksAnalyzed}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Judgments</p>
              <p className="text-2xl font-bold">{data.totalJudgments}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pass Rate</p>
              <p className={`text-2xl font-bold ${
                data.passingRate >= 80 ? 'text-green-600' :
                data.passingRate >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {data.passingRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Overall Accuracy</p>
              <p className="text-2xl font-bold text-blue-600">
                {data.overallAccuracy.toFixed(1)}%
              </p>
            </div>
          </div>

          {data.taskTypePerformance.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3 text-gray-700">
                Performance by Task Type
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-2 px-3">Task Type</th>
                      <th className="py-2 px-3 text-right">Benchmarks</th>
                      <th className="py-2 px-3 text-right">Judgments</th>
                      <th className="py-2 px-3 text-right">Pass Rate</th>
                      <th className="py-2 px-3 text-right">Avg Score</th>
                      <th className="py-2 px-3">Top Benchmark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.taskTypePerformance.map((taskType) => (
                      <tr key={taskType.taskType} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium capitalize">
                          {taskType.taskType}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {taskType.benchmarkCount}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {taskType.totalJudgments}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={
                            taskType.averagePassRate >= 80
                              ? 'text-green-600 font-medium'
                              : taskType.averagePassRate >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600 font-medium'
                          }>
                            {taskType.averagePassRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {taskType.averageScore.toFixed(1)}
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-600">
                          {taskType.topBenchmark}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.benchmarkResults.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3 text-gray-700">
                Individual Benchmark Results
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-2 px-3">Benchmark Name</th>
                      <th className="py-2 px-3">Task Type</th>
                      <th className="py-2 px-3 text-right">Judgments</th>
                      <th className="py-2 px-3 text-right">Passed</th>
                      <th className="py-2 px-3 text-right">Failed</th>
                      <th className="py-2 px-3 text-right">Pass Rate</th>
                      <th className="py-2 px-3 text-right">Avg Score</th>
                      <th className="py-2 px-3 text-right">Min Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.benchmarkResults.map((benchmark) => (
                      <tr key={benchmark.benchmarkId} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium">
                          {benchmark.benchmarkName}
                        </td>
                        <td className="py-3 px-3 capitalize text-gray-600">
                          {benchmark.taskType}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {benchmark.totalJudgments}
                        </td>
                        <td className="py-3 px-3 text-right text-green-600">
                          {benchmark.passedJudgments}
                        </td>
                        <td className="py-3 px-3 text-right text-red-600">
                          {benchmark.failedJudgments}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={
                            benchmark.passRate >= 80
                              ? 'text-green-600 font-medium'
                              : benchmark.passRate >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600 font-medium'
                          }>
                            {benchmark.passRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {benchmark.averageScore.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-600">
                          {benchmark.passCriteria.minScore.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.insights.length > 0 && (
            <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="font-medium text-blue-800 mb-1">Benchmark Insights:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                {data.insights.map((insight, idx) => (
                  <li key={idx}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
