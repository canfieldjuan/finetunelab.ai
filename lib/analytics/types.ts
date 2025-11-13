/**
 * Analytics Data Types
 * Shared type definitions for analytics aggregation and export
 * Phase 1: Enhanced Data Collection Services
 * Date: October 25, 2025
 */

export interface DateRange {
  start: Date;
  end: Date;
  period: 'hour' | 'day' | 'week' | 'month' | 'all';
}

export interface TokenUsageDataPoint {
  timestamp: Date;
  messageId: string;
  conversationId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface QualityDataPoint {
  timestamp: Date;
  messageId: string;
  conversationId: string;
  modelId: string;
  rating: number;
  successStatus: 'success' | 'partial' | 'failure';
  evaluationType: string;
  notes?: string;
}

export interface ToolUsageDataPoint {
  timestamp: Date;
  messageId: string;
  conversationId: string;
  toolName: string;
  executionTimeMs: number;
  success: boolean;
  errorType?: string;
}

export interface ConversationDataPoint {
  timestamp: Date;
  conversationId: string;
  messageCount: number;
  turnCount: number;
  durationMs: number;
  completionStatus: 'completed' | 'abandoned' | 'active';
  modelId: string;
}

export interface ErrorDataPoint {
  timestamp: Date;
  messageId: string;
  conversationId: string;
  errorType: string;
  errorMessage: string;
  fallbackUsed: boolean;
  modelId: string;
}

export interface LatencyDataPoint {
  timestamp: Date;
  messageId: string;
  conversationId: string;
  modelId: string;
  latencyMs: number;
  tokenCount: number;
  tokensPerSecond: number;
}

export interface AggregatedMetrics {
  totals: {
    messages: number;
    conversations: number;
    tokens: number;
    cost: number;
    evaluations: number;
    errors: number;
  };
  averages: {
    tokensPerMessage: number;
    costPerMessage: number;
    rating: number;
    latencyMs: number;
    successRate: number;
    errorRate: number;
  };
  trends: {
    tokenUsage: TrendData;
    quality: TrendData;
    latency: TrendData;
    errorRate: TrendData;
  };
}

export interface TrendData {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  dataPoints: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface AnalyticsDataset {
  userId: string;
  timeRange: DateRange;
  metrics: {
    tokenUsage: TokenUsageDataPoint[];
    quality: QualityDataPoint[];
    tools: ToolUsageDataPoint[];
    conversations: ConversationDataPoint[];
    errors: ErrorDataPoint[];
    latency: LatencyDataPoint[];
  };
  aggregations: AggregatedMetrics;
  generatedAt: Date;
}
