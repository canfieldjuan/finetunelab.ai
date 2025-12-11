/**
 * CSV Export Generator
 * Generates CSV files from analytics data
 * Phase 2: Export Format Generators
 * Date: October 25, 2025
 */

import { AnalyticsDataset } from '../types';
import { CSVRow } from './types';

/**
 * Escape CSV value
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data: CSVRow[], headers: string[]): string {
  const headerRow = headers.map(h => escapeCSVValue(h)).join(',');

  const dataRows = data.map(row => {
    return headers.map(header => escapeCSVValue(row[header])).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Generate overview CSV
 */
export function generateOverviewCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating overview CSV');

  const data: CSVRow[] = [
    { Metric: 'Total Messages', Value: dataset.aggregations.totals.messages },
    { Metric: 'Total Conversations', Value: dataset.aggregations.totals.conversations },
    { Metric: 'Total Tokens', Value: dataset.aggregations.totals.tokens },
    { Metric: 'Total Cost', Value: dataset.aggregations.totals.cost.toFixed(4) },
    { Metric: 'Total Evaluations', Value: dataset.aggregations.totals.evaluations },
    { Metric: 'Total Errors', Value: dataset.aggregations.totals.errors },
    { Metric: 'Average Tokens per Message', Value: dataset.aggregations.averages.tokensPerMessage.toFixed(2) },
    { Metric: 'Average Cost per Message', Value: dataset.aggregations.averages.costPerMessage.toFixed(4) },
    { Metric: 'Average Rating', Value: dataset.aggregations.averages.rating.toFixed(2) },
    { Metric: 'Success Rate (%)', Value: (dataset.aggregations.averages.successRate * 100).toFixed(2) },
    { Metric: 'Error Rate (%)', Value: (dataset.aggregations.averages.errorRate * 100).toFixed(2) },
    { Metric: 'Average Latency (ms)', Value: dataset.aggregations.averages.latencyMs.toFixed(0) },
  ];

  const csv = arrayToCSV(data, ['Metric', 'Value']);
  
  console.log('[CSVGenerator] Overview CSV generated');
  return csv;
}

/**
 * Generate time-series CSV
 */
export function generateTimeSeriesCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating time-series CSV');

  const data: CSVRow[] = [];

  dataset.metrics.tokenUsage.forEach(point => {
    data.push({
      Timestamp: point.timestamp.toISOString(),
      Type: 'Token Usage',
      MessageId: point.messageId,
      ModelId: point.modelId,
      InputTokens: point.inputTokens,
      OutputTokens: point.outputTokens,
      TotalTokens: point.totalTokens,
      Cost: point.estimatedCost.toFixed(4),
    });
  });

  const headers = ['Timestamp', 'Type', 'MessageId', 'ModelId', 'InputTokens', 'OutputTokens', 'TotalTokens', 'Cost'];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Time-series CSV generated', { rows: data.length });
  return csv;
}

/**
 * Generate model comparison CSV
 */
export function generateModelComparisonCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating model comparison CSV');

  const modelStats = new Map<string, {
    messages: number;
    tokens: number;
    cost: number;
    avgLatency: number;
    latencyCount: number;
  }>();

  dataset.metrics.tokenUsage.forEach(point => {
    const stats = modelStats.get(point.modelId) || {
      messages: 0, tokens: 0, cost: 0, avgLatency: 0, latencyCount: 0
    };
    stats.messages++;
    stats.tokens += point.totalTokens;
    stats.cost += point.estimatedCost;
    modelStats.set(point.modelId, stats);
  });

  dataset.metrics.latency.forEach(point => {
    const stats = modelStats.get(point.modelId);
    if (stats) {
      stats.avgLatency = ((stats.avgLatency * stats.latencyCount) + point.latencyMs) / (stats.latencyCount + 1);
      stats.latencyCount++;
    }
  });

  const data: CSVRow[] = Array.from(modelStats.entries()).map(([model, stats]) => ({
    Model: model,
    Messages: stats.messages,
    TotalTokens: stats.tokens,
    TotalCost: stats.cost.toFixed(4),
    AvgTokensPerMessage: (stats.tokens / stats.messages).toFixed(2),
    AvgCostPerMessage: (stats.cost / stats.messages).toFixed(4),
    AvgLatency: stats.avgLatency.toFixed(0),
  }));

  const headers = ['Model', 'Messages', 'TotalTokens', 'TotalCost', 'AvgTokensPerMessage', 'AvgCostPerMessage', 'AvgLatency'];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Model comparison CSV generated', { models: data.length });
  return csv;
}

/**
 * Generate tool usage CSV
 */
export function generateToolUsageCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating tool usage CSV');

  const data: CSVRow[] = dataset.metrics.tools.map(point => ({
    Timestamp: point.timestamp.toISOString(),
    MessageId: point.messageId,
    ConversationId: point.conversationId,
    ToolName: point.toolName,
    ExecutionTime: point.executionTimeMs,
    Success: point.success,
    ErrorType: point.errorType || 'N/A',
  }));

  const headers = ['Timestamp', 'MessageId', 'ConversationId', 'ToolName', 'ExecutionTime', 'Success', 'ErrorType'];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Tool usage CSV generated', { rows: data.length });
  return csv;
}

/**
 * Generate quality trends CSV
 */
export function generateQualityTrendsCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating quality trends CSV');

  const data: CSVRow[] = dataset.metrics.quality.map(point => ({
    Timestamp: point.timestamp.toISOString(),
    MessageId: point.messageId,
    ModelId: point.modelId,
    Rating: point.rating,
    SuccessStatus: point.successStatus,
    EvaluationType: point.evaluationType,
    Notes: point.notes || 'N/A',
  }));

  const headers = ['Timestamp', 'MessageId', 'ModelId', 'Rating', 'SuccessStatus', 'EvaluationType', 'Notes'];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Quality trends CSV generated', { rows: data.length });
  return csv;
}

/**
 * Generate conversations CSV
 */
export function generateConversationsCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating conversations CSV');

  const data: CSVRow[] = dataset.metrics.conversations.map(point => ({
    Timestamp: point.timestamp.toISOString(),
    ConversationId: point.conversationId,
    MessageCount: point.messageCount,
    TurnCount: point.turnCount,
    DurationMs: point.durationMs,
    DurationMinutes: (point.durationMs / 60000).toFixed(2),
    CompletionStatus: point.completionStatus,
    ModelId: point.modelId,
  }));

  const headers = [
    'Timestamp',
    'ConversationId',
    'MessageCount',
    'TurnCount',
    'DurationMs',
    'DurationMinutes',
    'CompletionStatus',
    'ModelId'
  ];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Conversations CSV generated', { rows: data.length });
  return csv;
}

/**
 * Generate errors CSV
 */
export function generateErrorsCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating errors CSV');

  const data: CSVRow[] = dataset.metrics.errors.map(point => ({
    Timestamp: point.timestamp.toISOString(),
    MessageId: point.messageId,
    ConversationId: point.conversationId,
    ErrorType: point.errorType,
    ErrorMessage: point.errorMessage,
    FallbackUsed: point.fallbackUsed,
    ModelId: point.modelId,
  }));

  const headers = [
    'Timestamp',
    'MessageId',
    'ConversationId',
    'ErrorType',
    'ErrorMessage',
    'FallbackUsed',
    'ModelId'
  ];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Errors CSV generated', { rows: data.length });
  return csv;
}

/**
 * Generate latency CSV
 */
export function generateLatencyCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating latency CSV');

  const data: CSVRow[] = dataset.metrics.latency.map(point => ({
    Timestamp: point.timestamp.toISOString(),
    MessageId: point.messageId,
    ConversationId: point.conversationId,
    ModelId: point.modelId,
    LatencyMs: point.latencyMs,
    LatencySeconds: (point.latencyMs / 1000).toFixed(3),
    TokenCount: point.tokenCount,
    TokensPerSecond: point.tokensPerSecond.toFixed(2),
  }));

  const headers = [
    'Timestamp',
    'MessageId',
    'ConversationId',
    'ModelId',
    'LatencyMs',
    'LatencySeconds',
    'TokenCount',
    'TokensPerSecond'
  ];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Latency CSV generated', { rows: data.length });
  return csv;
}

/**
 * Generate trends CSV
 */
export function generateTrendsCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating trends CSV');

  const data: CSVRow[] = [
    {
      Metric: 'Token Usage',
      Direction: dataset.aggregations.trends.tokenUsage.direction,
      ChangePercent: dataset.aggregations.trends.tokenUsage.changePercent.toFixed(2),
      DataPoints: dataset.aggregations.trends.tokenUsage.dataPoints,
      Confidence: dataset.aggregations.trends.tokenUsage.confidence,
    },
    {
      Metric: 'Quality',
      Direction: dataset.aggregations.trends.quality.direction,
      ChangePercent: dataset.aggregations.trends.quality.changePercent.toFixed(2),
      DataPoints: dataset.aggregations.trends.quality.dataPoints,
      Confidence: dataset.aggregations.trends.quality.confidence,
    },
    {
      Metric: 'Latency',
      Direction: dataset.aggregations.trends.latency.direction,
      ChangePercent: dataset.aggregations.trends.latency.changePercent.toFixed(2),
      DataPoints: dataset.aggregations.trends.latency.dataPoints,
      Confidence: dataset.aggregations.trends.latency.confidence,
    },
    {
      Metric: 'Error Rate',
      Direction: dataset.aggregations.trends.errorRate.direction,
      ChangePercent: dataset.aggregations.trends.errorRate.changePercent.toFixed(2),
      DataPoints: dataset.aggregations.trends.errorRate.dataPoints,
      Confidence: dataset.aggregations.trends.errorRate.confidence,
    },
  ];

  const headers = ['Metric', 'Direction', 'ChangePercent', 'DataPoints', 'Confidence'];
  const csv = arrayToCSV(data, headers);

  console.log('[CSVGenerator] Trends CSV generated');
  return csv;
}

/**
 * Generate complete dataset CSV
 */
export function generateCompleteDatasetCSV(dataset: AnalyticsDataset): string {
  console.log('[CSVGenerator] Generating complete dataset CSV');

  const sections: string[] = [];

  // Section 1: Overview
  sections.push('ANALYTICS OVERVIEW');
  sections.push(generateOverviewCSV(dataset));
  sections.push('');

  // Section 2: Trends
  sections.push('TRENDS ANALYSIS');
  sections.push(generateTrendsCSV(dataset));
  sections.push('');

  // Section 3: Token Usage
  if (dataset.metrics.tokenUsage.length > 0) {
    sections.push('TOKEN USAGE');
    sections.push(generateTimeSeriesCSV(dataset));
    sections.push('');
  }

  // Section 4: Quality Metrics
  if (dataset.metrics.quality.length > 0) {
    sections.push('QUALITY METRICS');
    sections.push(generateQualityTrendsCSV(dataset));
    sections.push('');
  }

  // Section 5: Tool Usage
  if (dataset.metrics.tools.length > 0) {
    sections.push('TOOL USAGE');
    sections.push(generateToolUsageCSV(dataset));
    sections.push('');
  }

  // Section 6: Conversations
  if (dataset.metrics.conversations.length > 0) {
    sections.push('CONVERSATIONS');
    sections.push(generateConversationsCSV(dataset));
    sections.push('');
  }

  // Section 7: Errors
  if (dataset.metrics.errors.length > 0) {
    sections.push('ERRORS');
    sections.push(generateErrorsCSV(dataset));
    sections.push('');
  }

  // Section 8: Latency
  if (dataset.metrics.latency.length > 0) {
    sections.push('LATENCY');
    sections.push(generateLatencyCSV(dataset));
    sections.push('');
  }

  // Section 9: Model Comparison
  sections.push('MODEL COMPARISON');
  sections.push(generateModelComparisonCSV(dataset));

  const csv = sections.join('\n');

  console.log('[CSVGenerator] Complete dataset CSV generated');
  return csv;
}
