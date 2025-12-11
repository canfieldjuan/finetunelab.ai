/**
 * CSV Export Utilities for Analytics Data
 * Converts analytics data to CSV format for spreadsheet analysis
 */

// CSV value escaping and formatting
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

// Convert array of objects to CSV string
function arrayToCSV(data: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers.map(h => escapeCSVValue(h)).join(',');

  const dataRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      return escapeCSVValue(value);
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

// Download CSV file
function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Export analytics overview to CSV
export function exportOverviewToCSV(overview: {
  totalMessages: number;
  totalConversations: number;
  totalEvaluations: number;
  avgRating: number;
  successRate: number;
}): void {
  const data = [
    { Metric: 'Total Messages', Value: overview.totalMessages },
    { Metric: 'Total Conversations', Value: overview.totalConversations },
    { Metric: 'Total Evaluations', Value: overview.totalEvaluations },
    { Metric: 'Average Rating', Value: overview.avgRating.toFixed(2) },
    { Metric: 'Success Rate (%)', Value: overview.successRate.toFixed(2) }
  ];

  const csv = arrayToCSV(data, ['Metric', 'Value']);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `analytics-overview-${timestamp}.csv`);

  console.log('[CSV Export] Overview exported');
}

interface ModelPerformanceData {
  modelId: string;
  modelName: string;
  provider?: string;
  baseModel?: string;
  trainingMethod?: string;
  totalMessages: number;
  totalConversations: number;
  evaluationCount: number;
  avgRating: number;
  successRate: number;
  errorRate: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgResponseTime: number;
  costPerMessage: number;
}

// Export model performance to CSV
export function exportModelPerformanceToCSV(models: ModelPerformanceData[]): void {
  const headers = [
    'modelId',
    'modelName',
    'provider',
    'baseModel',
    'trainingMethod',
    'totalMessages',
    'totalConversations',
    'evaluationCount',
    'avgRating',
    'successRate',
    'errorRate',
    'avgInputTokens',
    'avgOutputTokens',
    'avgResponseTime',
    'costPerMessage'
  ];

  const formattedData = models.map(m => ({
    modelId: m.modelId,
    modelName: m.modelName,
    provider: m.provider || 'N/A',
    baseModel: m.baseModel || 'N/A',
    trainingMethod: m.trainingMethod || 'N/A',
    totalMessages: m.totalMessages,
    totalConversations: m.totalConversations,
    evaluationCount: m.evaluationCount,
    avgRating: m.avgRating.toFixed(2),
    successRate: m.successRate.toFixed(2),
    errorRate: m.errorRate.toFixed(2),
    avgInputTokens: Math.round(m.avgInputTokens),
    avgOutputTokens: Math.round(m.avgOutputTokens),
    avgResponseTime: Math.round(m.avgResponseTime),
    costPerMessage: m.costPerMessage.toFixed(4)
  }));

  const csv = arrayToCSV(formattedData, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `model-performance-${timestamp}.csv`);

  console.log('[CSV Export] Model performance exported:', models.length, 'models');
}

interface SessionMetricsData {
  sessionId: string;
  experimentName?: string;
  totalConversations: number;
  totalMessages: number;
  evaluationCount: number;
  avgRating: number;
  successRate: number;
  errorRate: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgResponseTime: number;
  totalCost: number;
  firstConversation: string;
  lastConversation: string;
}

// Export session metrics to CSV
export function exportSessionMetricsToCSV(sessions: SessionMetricsData[]): void {
  const headers = [
    'sessionId',
    'experimentName',
    'totalConversations',
    'totalMessages',
    'evaluationCount',
    'avgRating',
    'successRate',
    'errorRate',
    'avgInputTokens',
    'avgOutputTokens',
    'avgResponseTime',
    'totalCost',
    'firstConversation',
    'lastConversation'
  ];

  const formattedData = sessions.map(s => ({
    sessionId: s.sessionId,
    experimentName: s.experimentName || 'N/A',
    totalConversations: s.totalConversations,
    totalMessages: s.totalMessages,
    evaluationCount: s.evaluationCount,
    avgRating: s.avgRating.toFixed(2),
    successRate: s.successRate.toFixed(2),
    errorRate: s.errorRate.toFixed(2),
    avgInputTokens: Math.round(s.avgInputTokens),
    avgOutputTokens: Math.round(s.avgOutputTokens),
    avgResponseTime: Math.round(s.avgResponseTime),
    totalCost: s.totalCost.toFixed(4),
    firstConversation: new Date(s.firstConversation).toISOString(),
    lastConversation: new Date(s.lastConversation).toISOString()
  }));

  const csv = arrayToCSV(formattedData, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `session-metrics-${timestamp}.csv`);

  console.log('[CSV Export] Session metrics exported:', sessions.length, 'sessions');
}

interface TrainingEffectivenessData {
  trainingMethod: string;
  modelCount: number;
  totalMessages: number;
  evaluationCount: number;
  avgRating: number;
  successRate: number;
  errorRate: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgResponseTime: number;
  avgCostPerMessage: number;
}

// Export training effectiveness to CSV
export function exportTrainingEffectivenessToCSV(training: TrainingEffectivenessData[]): void {
  const headers = [
    'trainingMethod',
    'modelCount',
    'totalMessages',
    'evaluationCount',
    'avgRating',
    'successRate',
    'errorRate',
    'avgInputTokens',
    'avgOutputTokens',
    'avgResponseTime',
    'avgCostPerMessage'
  ];

  const formattedData = training.map(t => ({
    trainingMethod: t.trainingMethod,
    modelCount: t.modelCount,
    totalMessages: t.totalMessages,
    evaluationCount: t.evaluationCount,
    avgRating: t.avgRating.toFixed(2),
    successRate: t.successRate.toFixed(2),
    errorRate: t.errorRate.toFixed(2),
    avgInputTokens: Math.round(t.avgInputTokens),
    avgOutputTokens: Math.round(t.avgOutputTokens),
    avgResponseTime: Math.round(t.avgResponseTime),
    avgCostPerMessage: t.avgCostPerMessage.toFixed(4)
  }));

  const csv = arrayToCSV(formattedData, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `training-effectiveness-${timestamp}.csv`);

  console.log('[CSV Export] Training effectiveness exported:', training.length, 'methods');
}

// Export rating distribution to CSV
export function exportRatingDistributionToCSV(ratings: Array<{ rating: number; count: number }>): void {
  const csv = arrayToCSV(ratings, ['rating', 'count']);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `rating-distribution-${timestamp}.csv`);

  console.log('[CSV Export] Rating distribution exported');
}

// Export token usage to CSV
export function exportTokenUsageToCSV(tokenUsage: Array<{ date: string; input: number; output: number }>): void {
  const formattedData = tokenUsage.map(t => ({
    date: t.date,
    inputTokens: t.input,
    outputTokens: t.output,
    totalTokens: t.input + t.output
  }));

  const csv = arrayToCSV(formattedData, ['date', 'inputTokens', 'outputTokens', 'totalTokens']);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `token-usage-${timestamp}.csv`);

  console.log('[CSV Export] Token usage exported:', tokenUsage.length, 'days');
}

// Export cost tracking to CSV
export function exportCostTrackingToCSV(costs: Array<{ date: string; cost: number; tokens: number }>): void {
  const csv = arrayToCSV(costs, ['date', 'cost', 'tokens']);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `cost-tracking-${timestamp}.csv`);

  console.log('[CSV Export] Cost tracking exported:', costs.length, 'days');
}

export interface AnalyticsData {
  overview: {
    totalMessages: number;
    totalConversations: number;
    totalEvaluations: number;
    avgRating: number;
    successRate: number;
  };
  modelPerformance?: ModelPerformanceData[];
}

// Export all analytics data to a single comprehensive CSV
export function exportAllAnalyticsToCSV(data: AnalyticsData): void {
  const sections: string[] = [];

  // Overview section
  sections.push('Analytics Overview');
  sections.push('Metric,Value');
  sections.push(`Total Messages,${data.overview.totalMessages}`);
  sections.push(`Total Conversations,${data.overview.totalConversations}`);
  sections.push(`Total Evaluations,${data.overview.totalEvaluations}`);
  sections.push(`Average Rating,${data.overview.avgRating.toFixed(2)}`);
  sections.push(`Success Rate,${data.overview.successRate.toFixed(2)}%`);
  sections.push('');

  // Model performance section
  if (data.modelPerformance && data.modelPerformance.length > 0) {
    sections.push('Model Performance');
    const modelHeaders = ['Model ID', 'Model Name', 'Messages', 'Evaluations', 'Avg Rating', 'Success Rate', 'Cost/Msg'];
    sections.push(modelHeaders.join(','));
    data.modelPerformance.forEach((m: ModelPerformanceData) => {
      sections.push([
        escapeCSVValue(m.modelId),
        escapeCSVValue(m.modelName),
        m.totalMessages,
        m.evaluationCount,
        m.avgRating.toFixed(2),
        m.successRate.toFixed(2) + '%',
        '$' + m.costPerMessage.toFixed(4)
      ].join(','));
    });
    sections.push('');
  }

  const csv = sections.join('\n');
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `analytics-complete-${timestamp}.csv`);

  console.log('[CSV Export] Complete analytics exported');
}
