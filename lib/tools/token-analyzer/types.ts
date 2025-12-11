// Token Analyzer Tool - Type Definitions
// Date: October 13, 2025

export interface TokenUsage {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  conversationId?: string;
  model: string;
  timestamp: string;
}

export interface CostBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface UsageStats {
  userId: string;
  period: string;
  totalTokens: number;
  totalCost: number;
  byModel: CostBreakdown[];
  averagePerMessage: number;
  peakUsageDay: string;
}

export interface ModelComparison {
  models: string[];
  metrics: {
    avgTokensPerMessage: number[];
    avgCostPerMessage: number[];
    avgResponseTime: number[];
    totalMessages: number[];
  };
  recommendation: string;
}

export interface OptimizationTip {
  category: string;
  issue: string;
  suggestion: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
}

export interface OptimizationReport {
  currentCost: number;
  potentialSavings: number;
  tips: OptimizationTip[];
}

export interface AnalyzerOptions {
  period?: 'day' | 'week' | 'month' | 'all';
  startDate?: string;
  endDate?: string;
  conversationId?: string;
  model?: string;
}
