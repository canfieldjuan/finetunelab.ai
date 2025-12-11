// Prompt Tester Tool - Type Definitions
// Date: October 13, 2025

export interface PromptTestResult {
  prompt: string;
  response: string;
  tokenCount: number;
  responseTime: number;
  qualityScore?: number;
  issues: string[];
}

export interface PromptComparison {
  variations: PromptTestResult[];
  winner: number;
  reasoning: string;
  metrics: ComparisonMetrics;
}

export interface ComparisonMetrics {
  avgTokenCount: number[];
  avgResponseTime: number[];
  avgQualityScore: number[];
}

export interface PromptPattern {
  id: string;
  name: string;
  template: string;
  use_case: string;
  success_rate: number;
  avg_rating: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface TestData {
  variables?: Record<string, string>;
  messages?: Array<{ role: string; content: string }>;
}

export interface TestOptions {
  max_tokens?: number;
  temperature?: number;
  iterations?: number;
}

export interface PatternMetadata {
  use_case: string;
  success_rate: number;
  avg_rating: number;
  description?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface AnalysisResult {
  bestIndex: number;
  recommendation: string;
  insights: string[];
  metrics: ComparisonMetrics;
}
