/**
 * Onboarding Report Template
 * Designed for new team members to understand the system
 * Focus: Education, context, baselines, terminology
 * Date: December 15, 2025
 */

import type { ReportTemplate, RenderedReport, RenderedSection, SummaryContent, MetricsContent, TableContent } from './types';
import type { AnalyticsDataset } from '../../types';

/**
 * Onboarding template definition
 * Educational content for new team members
 */
export const onboardingTemplate: ReportTemplate = {
  id: 'onboarding',
  name: 'System Onboarding Guide',
  description: 'Educational overview for new team members',
  targetAudience: 'New engineers, contractors, team members',
  maxPages: undefined,
  includeRawData: false,
  includeCharts: true,
  includeRecommendations: false,
  headerText: 'FineTuneLab System Overview',
  footerText: 'Welcome to the team!',

  sections: [
    {
      id: 'onboard-intro',
      title: 'System Overview',
      type: 'summary',
      priority: 1,
      dataSource: 'aggregations',
      required: true,
      formatting: {
        showTrends: false,
        showComparisons: false,
        detailLevel: 'low',
        visualStyle: 'text',
        technicalLanguage: false,
      },
    },
    {
      id: 'onboard-metrics',
      title: 'Key Metrics Explained',
      type: 'table',
      priority: 2,
      dataSource: 'aggregations',
      required: true,
      formatting: {
        showTrends: false,
        showComparisons: false,
        detailLevel: 'medium',
        visualStyle: 'both',
        technicalLanguage: false,
      },
    },
    {
      id: 'onboard-baselines',
      title: 'Current Baselines',
      type: 'metrics',
      priority: 3,
      dataSource: 'aggregations',
      required: true,
      description: 'What normal looks like',
      formatting: {
        showTrends: true,
        showComparisons: false,
        detailLevel: 'medium',
        visualStyle: 'numbers',
        technicalLanguage: false,
      },
    },
    {
      id: 'onboard-healthy',
      title: 'Healthy System Indicators',
      type: 'table',
      priority: 4,
      dataSource: 'aggregations',
      required: true,
      description: 'Target ranges for key metrics',
      formatting: {
        showTrends: false,
        showComparisons: false,
        detailLevel: 'medium',
        visualStyle: 'both',
        technicalLanguage: false,
      },
    },
    {
      id: 'onboard-tools',
      title: 'Available Tools',
      type: 'table',
      priority: 5,
      dataSource: 'tools',
      required: true,
      formatting: {
        showTrends: false,
        showComparisons: false,
        detailLevel: 'medium',
        visualStyle: 'both',
        maxItems: 20,
        technicalLanguage: false,
      },
    },
    {
      id: 'onboard-faq',
      title: 'Common Questions',
      type: 'table',
      priority: 6,
      dataSource: 'aggregations',
      required: true,
      formatting: {
        showTrends: false,
        showComparisons: false,
        detailLevel: 'low',
        visualStyle: 'text',
        technicalLanguage: false,
      },
    },
  ],
};

/**
 * Render onboarding template with data
 */
export function renderOnboardingTemplate(data: AnalyticsDataset): RenderedReport {
  const sections: RenderedSection[] = [];

  // 1. System Overview
  sections.push({
    id: 'onboard-intro',
    title: 'System Overview',
    type: 'summary',
    content: generateSystemOverview(data),
  });

  // 2. Key Metrics Explained
  sections.push({
    id: 'onboard-metrics',
    title: 'Key Metrics Explained',
    type: 'table',
    content: generateMetricsGlossary(),
  });

  // 3. Current Baselines
  sections.push({
    id: 'onboard-baselines',
    title: 'Current Baselines',
    type: 'metrics',
    content: generateCurrentBaselines(data),
  });

  // 4. Healthy System Indicators
  sections.push({
    id: 'onboard-healthy',
    title: 'Healthy System Indicators',
    type: 'table',
    content: generateHealthyIndicators(data),
  });

  // 5. Available Tools
  sections.push({
    id: 'onboard-tools',
    title: 'Available Tools',
    type: 'table',
    content: generateToolsList(data),
  });

  // 6. Common Questions
  sections.push({
    id: 'onboard-faq',
    title: 'Common Questions',
    type: 'table',
    content: generateFAQ(data),
  });

  return {
    metadata: {
      templateId: 'onboarding',
      templateName: 'System Onboarding Guide',
      generatedAt: new Date().toISOString(),
      userId: data.userId,
      dateRange: {
        start: data.timeRange.start.toISOString(),
        end: data.timeRange.end.toISOString(),
      },
    },
    header: 'FineTuneLab System Overview',
    sections,
    footer: 'Welcome to the team!',
  };
}

/**
 * Generate system overview
 */
function generateSystemOverview(data: AnalyticsDataset): SummaryContent {
  const { totals } = data.aggregations;

  return {
    type: 'summary',
    headline: 'Welcome to FineTuneLab',
    highlights: [
      'FineTuneLab is an AI operations platform for managing LLM interactions, fine-tuning models, and monitoring performance.',
      `This system has processed ${totals.conversations.toLocaleString()} conversations and ${totals.messages.toLocaleString()} messages in the selected time period.`,
      'Key capabilities include: conversation management, model fine-tuning, analytics dashboards, and automated quality evaluation.',
      'This report shows current system health and explains the metrics you\'ll be working with.',
    ],
    concerns: [],
  };
}

/**
 * Generate metrics glossary
 */
function generateMetricsGlossary(): TableContent {
  return {
    type: 'table',
    headers: ['Metric', 'What It Measures', 'Why It Matters'],
    rows: [
      ['Success Rate', 'Percentage of requests completed without errors', 'Indicates system reliability - higher is better'],
      ['Error Rate', 'Percentage of requests that failed', 'Inverse of success rate - lower is better'],
      ['Latency', 'Time from request to complete response', 'User experience - faster is better'],
      ['P95 Latency', '95% of requests complete within this time', 'Worst-case user experience indicator'],
      ['Tokens', 'Units of text processed by the AI model', 'Directly impacts cost - 1 token ≈ 4 characters'],
      ['Cost per Message', 'Average spend per AI interaction', 'Budget efficiency metric'],
      ['Quality Rating', 'User feedback score (1-5 scale)', 'Measures output quality and usefulness'],
      ['Tool Success Rate', 'Percentage of tool calls that worked', 'Reliability of integrations and actions'],
    ],
    footer: 'These are the core metrics you\'ll see throughout the platform.',
  };
}

/**
 * Generate current baselines
 */
function generateCurrentBaselines(data: AnalyticsDataset): MetricsContent {
  const { totals, averages } = data.aggregations;

  // Calculate some additional stats
  const latencies = data.metrics.latency.map((l) => l.latencyMs).sort((a, b) => a - b);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95Latency = latencies[p95Index] || 0;

  return {
    type: 'metrics',
    metrics: [
      {
        label: 'Daily Conversations',
        value: Math.round(totals.conversations / 7).toLocaleString(),
        status: 'good',
      },
      {
        label: 'Success Rate',
        value: `${(averages.successRate * 100).toFixed(1)}%`,
        status: averages.successRate >= 0.95 ? 'good' : 'warning',
      },
      {
        label: 'Average Latency',
        value: `${(averages.latencyMs / 1000).toFixed(1)}s`,
        status: averages.latencyMs < 3000 ? 'good' : 'warning',
      },
      {
        label: 'P95 Latency',
        value: `${(p95Latency / 1000).toFixed(1)}s`,
        status: p95Latency < 5000 ? 'good' : 'warning',
      },
      {
        label: 'Quality Rating',
        value: `${averages.rating.toFixed(1)}/5.0`,
        status: averages.rating >= 4.0 ? 'good' : 'warning',
      },
      {
        label: 'Cost per Message',
        value: `$${averages.costPerMessage.toFixed(4)}`,
        status: averages.costPerMessage < 0.01 ? 'good' : 'warning',
      },
    ],
  };
}

/**
 * Generate healthy system indicators
 */
function generateHealthyIndicators(data: AnalyticsDataset): TableContent {
  const { averages } = data.aggregations;

  const getStatus = (metric: string, value: number): string => {
    switch (metric) {
      case 'success':
        return value >= 0.98 ? 'Excellent' : value >= 0.95 ? 'Good' : value >= 0.90 ? 'Needs Attention' : 'Critical';
      case 'latency':
        return value < 2000 ? 'Excellent' : value < 3000 ? 'Good' : value < 5000 ? 'Needs Attention' : 'Critical';
      case 'rating':
        return value >= 4.5 ? 'Excellent' : value >= 4.0 ? 'Good' : value >= 3.5 ? 'Needs Attention' : 'Critical';
      case 'error':
        return value < 0.01 ? 'Excellent' : value < 0.02 ? 'Good' : value < 0.05 ? 'Needs Attention' : 'Critical';
      default:
        return 'Unknown';
    }
  };

  return {
    type: 'table',
    headers: ['Metric', 'Target Range', 'Current Value', 'Status'],
    rows: [
      [
        'Success Rate',
        '≥ 95% (excellent: ≥ 98%)',
        `${(averages.successRate * 100).toFixed(1)}%`,
        getStatus('success', averages.successRate),
      ],
      [
        'Average Latency',
        '< 3s (excellent: < 2s)',
        `${(averages.latencyMs / 1000).toFixed(2)}s`,
        getStatus('latency', averages.latencyMs),
      ],
      [
        'Quality Rating',
        '≥ 4.0 (excellent: ≥ 4.5)',
        `${averages.rating.toFixed(1)}/5.0`,
        getStatus('rating', averages.rating),
      ],
      [
        'Error Rate',
        '< 2% (excellent: < 1%)',
        `${(averages.errorRate * 100).toFixed(2)}%`,
        getStatus('error', averages.errorRate),
      ],
    ],
    footer: 'These targets help you quickly assess system health.',
  };
}

/**
 * Generate tools list
 */
function generateToolsList(data: AnalyticsDataset): TableContent {
  const toolStats = new Map<string, { calls: number; successes: number }>();

  data.metrics.tools.forEach((tool) => {
    const stats = toolStats.get(tool.toolName) || { calls: 0, successes: 0 };
    stats.calls++;
    if (tool.success) stats.successes++;
    toolStats.set(tool.toolName, stats);
  });

  const rows = Array.from(toolStats.entries())
    .map(([name, stats]) => {
      const successRate = (stats.successes / stats.calls) * 100;
      return [
        name,
        getToolDescription(name),
        stats.calls.toLocaleString(),
        `${successRate.toFixed(0)}%`,
      ];
    })
    .sort((a, b) => parseInt((b[2] as string).replace(',', '')) - parseInt((a[2] as string).replace(',', '')))
    .slice(0, 15);

  return {
    type: 'table',
    headers: ['Tool Name', 'Description', 'Usage Count', 'Success Rate'],
    rows,
    footer: `${toolStats.size} tools available in the system.`,
  };
}

/**
 * Get tool description
 */
function getToolDescription(toolName: string): string {
  const descriptions: Record<string, string> = {
    'web_search': 'Search the web for information',
    'dataset_manager': 'Manage training datasets',
    'analytics_export': 'Export analytics reports',
    'training_control': 'Control training jobs',
    'token_analyzer': 'Analyze token usage',
    'query_knowledge_graph': 'Query the knowledge graph',
    'prompt_tester': 'Test prompt variations',
    'evaluation_metrics': 'View evaluation metrics',
  };
  return descriptions[toolName] || 'System tool';
}

/**
 * Generate FAQ
 */
function generateFAQ(data: AnalyticsDataset): TableContent {
  const { averages, totals } = data.aggregations;

  return {
    type: 'table',
    headers: ['Question', 'Answer'],
    rows: [
      [
        'What does "success rate" measure?',
        'The percentage of AI requests that complete without errors. Our current rate is ' +
        `${(averages.successRate * 100).toFixed(1)}%.`,
      ],
      [
        'What is a "token"?',
        'A token is roughly 4 characters of text. Both input (your message) and output (AI response) consume tokens, which affect cost.',
      ],
      [
        'Why does latency matter?',
        `Latency is how long users wait for responses. Current average is ${(averages.latencyMs / 1000).toFixed(1)}s. ` +
        'Target is under 3 seconds.',
      ],
      [
        'How is quality measured?',
        'Users rate responses 1-5. We also track success/failure. Current average rating is ' +
        `${averages.rating.toFixed(1)}/5.0.`,
      ],
      [
        'What should I monitor?',
        'Watch the dashboard for error rate spikes (> 5%), latency increases (> 5s), and quality drops (< 4.0).',
      ],
      [
        'How much does this cost?',
        `Current cost is $${averages.costPerMessage.toFixed(4)} per message. ` +
        `Total spend this period: $${totals.cost.toFixed(2)}.`,
      ],
      [
        'Where do I find detailed logs?',
        'Check the Analytics Dashboard for real-time data, or export detailed reports using the analytics_export tool.',
      ],
      [
        'Who do I contact for help?',
        'Reach out to the platform team on Slack (#finetunelab-support) or check the internal documentation.',
      ],
    ],
    footer: 'For more questions, check the internal wiki or ask in #finetunelab-support.',
  };
}
