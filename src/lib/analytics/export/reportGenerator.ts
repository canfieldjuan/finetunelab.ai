/**
 * Report Data Generator
 * Generates structured report data with insights and recommendations
 * Phase 2: Export Format Generators
 * Date: October 25, 2025
 */

import { AnalyticsDataset } from '../types';
import {
  TokenUsageSection,
  QualitySection,
  ToolsSection,
  PerformanceSection,
  ChartConfig,
  Recommendation,
} from './types';

/**
 * Generate executive summary
 */
export function generateExecutiveSummary(dataset: AnalyticsDataset): {
  keyMetrics: Record<string, number>;
  highlights: string[];
  concerns: string[];
} {
  console.log('[ReportGenerator] Generating executive summary');

  const keyMetrics = {
    totalMessages: dataset.aggregations.totals.messages,
    totalCost: dataset.aggregations.totals.cost,
    avgRating: dataset.aggregations.averages.rating,
    successRate: dataset.aggregations.averages.successRate * 100,
    errorRate: dataset.aggregations.averages.errorRate * 100,
  };

  const highlights: string[] = [];
  const concerns: string[] = [];

  if (keyMetrics.successRate > 90) {
    highlights.push(`Excellent success rate at ${keyMetrics.successRate.toFixed(1)}%`);
  }

  if (keyMetrics.avgRating >= 4.0) {
    highlights.push(`High quality ratings averaging ${keyMetrics.avgRating.toFixed(2)}/5.0`);
  }

  if (dataset.aggregations.trends.tokenUsage.direction === 'down') {
    highlights.push(`Token usage trending down by ${Math.abs(dataset.aggregations.trends.tokenUsage.changePercent).toFixed(1)}%`);
  }

  if (keyMetrics.errorRate > 10) {
    concerns.push(`High error rate at ${keyMetrics.errorRate.toFixed(1)}%`);
  }

  if (dataset.aggregations.trends.quality.direction === 'down') {
    concerns.push(`Quality trending down by ${Math.abs(dataset.aggregations.trends.quality.changePercent).toFixed(1)}%`);
  }

  console.log('[ReportGenerator] Executive summary generated');

  return { keyMetrics, highlights, concerns };
}

/**
 * Generate detailed analysis sections
 */
export function generateDetailedAnalysis(dataset: AnalyticsDataset): {
  tokenUsage?: TokenUsageSection;
  quality?: QualitySection;
  tools?: ToolsSection;
  performance?: PerformanceSection;
} {
  console.log('[ReportGenerator] Generating detailed analysis');

  const sections: {
    tokenUsage?: TokenUsageSection;
    quality?: QualitySection;
    tools?: ToolsSection;
    performance?: PerformanceSection;
  } = {};

  if (dataset.metrics.tokenUsage.length > 0) {
    const modelBreakdown = new Map<string, { tokens: number; cost: number }>();
    
    dataset.metrics.tokenUsage.forEach(point => {
      const stats = modelBreakdown.get(point.modelId) || { tokens: 0, cost: 0 };
      stats.tokens += point.totalTokens;
      stats.cost += point.estimatedCost;
      modelBreakdown.set(point.modelId, stats);
    });

    const totalTokens = dataset.aggregations.totals.tokens;
    
    sections.tokenUsage = {
      totalTokens,
      totalCost: dataset.aggregations.totals.cost,
      averagePerMessage: dataset.aggregations.averages.tokensPerMessage,
      costPerMessage: dataset.aggregations.averages.costPerMessage,
      breakdown: Array.from(modelBreakdown.entries()).map(([model, stats]) => ({
        model,
        tokens: stats.tokens,
        cost: stats.cost,
        percentage: (stats.tokens / totalTokens) * 100,
      })),
      trend: {
        direction: dataset.aggregations.trends.tokenUsage.direction,
        changePercent: dataset.aggregations.trends.tokenUsage.changePercent,
      },
    };
  }

  if (dataset.metrics.quality.length > 0) {
    const ratingDist = new Map<number, number>();
    
    dataset.metrics.quality.forEach(point => {
      ratingDist.set(point.rating, (ratingDist.get(point.rating) || 0) + 1);
    });

    sections.quality = {
      averageRating: dataset.aggregations.averages.rating,
      successRate: dataset.aggregations.averages.successRate,
      totalEvaluations: dataset.aggregations.totals.evaluations,
      distribution: Array.from(ratingDist.entries()).map(([rating, count]) => ({
        rating,
        count,
        percentage: (count / dataset.metrics.quality.length) * 100,
      })),
      trend: {
        direction: dataset.aggregations.trends.quality.direction,
        changePercent: dataset.aggregations.trends.quality.changePercent,
      },
    };
  }

  if (dataset.metrics.tools.length > 0) {
    const toolStats = new Map<string, { count: number; successes: number; totalDuration: number }>();
    
    dataset.metrics.tools.forEach(point => {
      const stats = toolStats.get(point.toolName) || { count: 0, successes: 0, totalDuration: 0 };
      stats.count++;
      if (point.success) stats.successes++;
      stats.totalDuration += point.executionTimeMs;
      toolStats.set(point.toolName, stats);
    });

    sections.tools = {
      totalExecutions: dataset.metrics.tools.length,
      uniqueTools: toolStats.size,
      successRate: dataset.metrics.tools.filter(t => t.success).length / dataset.metrics.tools.length,
      topTools: Array.from(toolStats.entries())
        .map(([name, stats]) => ({
          name,
          executions: stats.count,
          successRate: stats.successes / stats.count,
          avgDuration: stats.totalDuration / stats.count,
        }))
        .sort((a, b) => b.executions - a.executions)
        .slice(0, 10),
    };
  }

  if (dataset.metrics.latency.length > 0) {
    const latencies = dataset.metrics.latency.map(p => p.latencyMs).sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);

    sections.performance = {
      averageLatency: dataset.aggregations.averages.latencyMs,
      p95Latency: latencies[p95Index],
      errorRate: dataset.aggregations.averages.errorRate,
      totalErrors: dataset.aggregations.totals.errors,
      tokensPerSecond: dataset.metrics.latency.reduce((sum, p) => sum + p.tokensPerSecond, 0) / dataset.metrics.latency.length,
    };
  }

  console.log('[ReportGenerator] Detailed analysis generated');

  return sections;
}

/**
 * Generate visualization configurations
 */
export function generateVisualizations(dataset: AnalyticsDataset): ChartConfig[] {
  console.log('[ReportGenerator] Generating visualization configs');

  const charts: ChartConfig[] = [];

  if (dataset.metrics.tokenUsage.length > 0) {
    const sortedData = [...dataset.metrics.tokenUsage].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    charts.push({
      type: 'line',
      title: 'Token Usage Over Time',
      data: {
        labels: sortedData.map(p => p.timestamp.toISOString()),
        datasets: [{
          label: 'Total Tokens',
          data: sortedData.map(p => p.totalTokens),
          borderColor: 'rgb(75, 192, 192)',
        }],
      },
    });

    const modelBreakdown = new Map<string, number>();
    dataset.metrics.tokenUsage.forEach(p => {
      modelBreakdown.set(p.modelId, (modelBreakdown.get(p.modelId) || 0) + p.totalTokens);
    });

    const models = Array.from(modelBreakdown.keys());
    const values = Array.from(modelBreakdown.values());

    charts.push({
      type: 'pie',
      title: 'Token Distribution by Model',
      data: {
        labels: models,
        datasets: [{
          label: 'Tokens',
          data: values,
        }],
      },
    });
  }

  if (dataset.metrics.quality.length > 0) {
    const ratings = [1, 2, 3, 4, 5];
    const counts = ratings.map(rating => 
      dataset.metrics.quality.filter(p => p.rating === rating).length
    );

    charts.push({
      type: 'bar',
      title: 'Quality Rating Distribution',
      data: {
        labels: ratings.map(r => `${r} stars`),
        datasets: [{
          label: 'Count',
          data: counts,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
        }],
      },
    });
  }

  if (dataset.metrics.latency.length > 0) {
    const sortedData = [...dataset.metrics.latency].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    charts.push({
      type: 'line',
      title: 'Response Latency Over Time',
      data: {
        labels: sortedData.map(p => p.timestamp.toISOString()),
        datasets: [{
          label: 'Latency (ms)',
          data: sortedData.map(p => p.latencyMs),
          borderColor: 'rgb(255, 99, 132)',
        }],
      },
    });
  }

  console.log(`[ReportGenerator] Generated ${charts.length} chart configs`);

  return charts;
}

/**
 * Generate AI-powered recommendations
 */
export function generateRecommendations(dataset: AnalyticsDataset): Recommendation[] {
  console.log('[ReportGenerator] Generating recommendations');

  const recommendations: Recommendation[] = [];

  const avgCost = dataset.aggregations.averages.costPerMessage;
  if (avgCost > 0.01) {
    recommendations.push({
      category: 'cost',
      priority: 'medium',
      title: 'Consider using more efficient models',
      description: `Average cost per message is $${avgCost.toFixed(4)}, which could be reduced by using smaller models for simpler tasks.`,
      impact: 'Could reduce costs by 30-50% for routine queries',
      actionItems: [
        'Analyze query complexity distribution',
        'Implement model routing based on task difficulty',
        'Use gpt-3.5-turbo for simple tasks',
      ],
    });
  }

  const errorRate = dataset.aggregations.averages.errorRate;
  if (errorRate > 0.05) {
    recommendations.push({
      category: 'performance',
      priority: 'high',
      title: 'High error rate detected',
      description: `Error rate is ${(errorRate * 100).toFixed(1)}%, indicating potential reliability issues.`,
      impact: 'Improving error handling could increase user satisfaction',
      actionItems: [
        'Review error logs for common patterns',
        'Implement retry logic with exponential backoff',
        'Add better input validation',
      ],
    });
  }

  const avgLatency = dataset.aggregations.averages.latencyMs;
  if (avgLatency > 3000) {
    recommendations.push({
      category: 'performance',
      priority: 'medium',
      title: 'Response times could be improved',
      description: `Average latency is ${(avgLatency / 1000).toFixed(2)}s, which may impact user experience.`,
      impact: 'Faster responses lead to better engagement',
      actionItems: [
        'Implement response streaming',
        'Optimize prompt templates',
        'Consider caching common queries',
      ],
    });
  }

  if (dataset.aggregations.trends.quality.direction === 'down' && 
      Math.abs(dataset.aggregations.trends.quality.changePercent) > 10) {
    recommendations.push({
      category: 'quality',
      priority: 'high',
      title: 'Quality trending downward',
      description: `Quality metrics have decreased by ${Math.abs(dataset.aggregations.trends.quality.changePercent).toFixed(1)}% recently.`,
      impact: 'Quality degradation may lead to user churn',
      actionItems: [
        'Review recent prompt changes',
        'Analyze low-rated conversations',
        'A/B test improved prompts',
      ],
    });
  }

  if (dataset.metrics.tools.length > 0) {
    const toolSuccessRate = dataset.metrics.tools.filter(t => t.success).length / dataset.metrics.tools.length;
    if (toolSuccessRate < 0.9) {
      recommendations.push({
        category: 'tools',
        priority: 'medium',
        title: 'Tool execution reliability needs attention',
        description: `Tool success rate is ${(toolSuccessRate * 100).toFixed(1)}%, indicating some tools may need optimization.`,
        impact: 'More reliable tool execution improves overall system performance',
        actionItems: [
          'Identify failing tools',
          'Improve error handling in tool implementations',
          'Add timeout and retry mechanisms',
        ],
      });
    }
  }

  console.log(`[ReportGenerator] Generated ${recommendations.length} recommendations`);

  return recommendations;
}