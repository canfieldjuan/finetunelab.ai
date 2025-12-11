/**
 * Analytics Export Types
 * Type definitions for analytics export functionality
 * Phase 2: Export Format Generators
 * Date: October 25, 2025
 */

import { AnalyticsDataset } from '../types';

export interface AnalyticsExportOptions {
  userId: string;
  format: 'csv' | 'json';
  metrics: ('tokens' | 'quality' | 'tools' | 'conversations' | 'errors' | 'latency' | 'all')[];
  timeRange: {
    start: Date;
    end: Date;
    period: 'hour' | 'day' | 'week' | 'month' | 'all';
  };
  includeVisualizations?: boolean;
  includeRecommendations?: boolean;
}

export interface AnalyticsExportResult {
  id: string;
  downloadUrl: string;
  expiresAt: Date;
  fileSize: number;
  format: string;
  generatedAt: Date;
}

export interface CSVRow {
  [key: string]: string | number | boolean | null;
}

export interface JSONExport {
  metadata: {
    exportId: string;
    userId: string;
    generatedAt: string;
    timeRange: {
      start: string;
      end: string;
      period: string;
    };
    format: string;
    version: string;
  };
  data: AnalyticsDataset;
}

export interface StructuredReport {
  metadata: {
    generatedAt: string;
    userId: string;
    period: {
      start: string;
      end: string;
      duration: string;
    };
    dataPoints: number;
  };
  summary: {
    keyMetrics: Record<string, number>;
    highlights: string[];
    concerns: string[];
  };
  sections: {
    tokenUsage?: TokenUsageSection;
    quality?: QualitySection;
    tools?: ToolsSection;
    performance?: PerformanceSection;
  };
  visualizations?: ChartConfig[];
  recommendations?: Recommendation[];
}

export interface TokenUsageSection {
  totalTokens: number;
  totalCost: number;
  averagePerMessage: number;
  costPerMessage: number;
  breakdown: {
    model: string;
    tokens: number;
    cost: number;
    percentage: number;
  }[];
  trend: {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
  };
}

export interface QualitySection {
  averageRating: number;
  successRate: number;
  totalEvaluations: number;
  distribution: {
    rating: number;
    count: number;
    percentage: number;
  }[];
  trend: {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
  };
}

export interface ToolsSection {
  totalExecutions: number;
  uniqueTools: number;
  successRate: number;
  topTools: {
    name: string;
    executions: number;
    successRate: number;
    avgDuration: number;
  }[];
}

export interface PerformanceSection {
  averageLatency: number;
  p95Latency: number;
  errorRate: number;
  totalErrors: number;
  tokensPerSecond: number;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'scatter';
  title: string;
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
    }[];
  };
}

export interface Recommendation {
  category: 'cost' | 'performance' | 'quality' | 'tools';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actionItems: string[];
}
