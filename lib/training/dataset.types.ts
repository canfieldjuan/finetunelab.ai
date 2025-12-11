// Training Dataset Types
// Type definitions for dataset upload and management
// Date: 2025-10-16

export type DatasetFormat = 'chatml' | 'sharegpt' | 'jsonl' | 'dpo' | 'rlhf' | 'alpaca' | 'openorca' | 'unnatural';

// Dataset field name constants to avoid hard-coding
export const DATASET_FIELDS = {
  // Common fields
  MESSAGES: 'messages',
  CONVERSATIONS: 'conversations',
  TEXT: 'text',

  // Message/conversation fields
  ROLE: 'role',
  CONTENT: 'content',
  FROM: 'from',
  VALUE: 'value',

  // DPO/RLHF fields
  PROMPT: 'prompt',
  CHOSEN: 'chosen',
  REJECTED: 'rejected',
  RESPONSE: 'response',
  REWARD: 'reward',

  // Alpaca/Instruction fields
  INSTRUCTION: 'instruction',
  INPUT: 'input',
  OUTPUT: 'output',
  CONTEXT: 'context',

  // OpenOrca fields
  SYSTEM_PROMPT: 'system_prompt',
  QUESTION: 'question',

  // Unnatural Instructions fields
  INSTANCES: 'instances',

  // ShareGPT fields
  SYSTEM: 'system',
  EXAMPLES: 'examples',
} as const;

export interface ChatMLMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ChatMLConversation = ChatMLMessage[];

export interface ShareGPTConversation {
  conversations: Array<{
    from: 'human' | 'gpt';
    value: string;
  }>;
}

export interface DPOExample {
  prompt: string;
  chosen: string;
  rejected: string;
}

export interface RLHFExample {
  prompt: string;
  response: string;
  reward?: number;
}

export type JSONLLine = Record<string, unknown>;

export interface AlpacaExample {
  instruction: string;
  input: string;
  output: string;
}

export interface OpenOrcaExample {
  system_prompt: string;
  question: string;
  response: string;
}

export interface UnnaturalInstructionsExample {
  instruction: string;
  instances: Array<{
    input: string;
    output: string;
  }>;
}

export interface DatasetStats {
  total_examples: number;
  avg_input_length: number;
  avg_output_length: number;
  format: DatasetFormat;
}

/**
 * Enhanced dataset statistics with accurate token counting, outlier detection, and quality metrics
 * Added: 2025-12-07 for dataset validation enhancements
 */
export interface EnhancedDatasetStats extends DatasetStats {
  // Accurate token statistics (using HuggingFace tokenizer)
  token_count_total: number;
  token_count_avg: number;
  token_count_min: number;
  token_count_max: number;
  token_count_median: number;
  tokenizer_used: string;

  // Outlier detection results
  outliers: {
    count: number;
    indices: number[];
    method: 'iqr' | 'zscore';
    details?: OutlierDetail[];
  };

  // Quality metrics
  quality_score: number; // 0-100
  quality_issues: {
    empty_examples: number;
    malformed_examples: number;
    alternation_errors: number;
    duplicate_count: number;
  };

  // Optional cost estimation
  cost_estimate?: CostEstimateSummary;
}

export interface OutlierDetail {
  index: number;
  tokens: number;
  type?: 'low' | 'high';
  zscore?: number;
}

export interface CostEstimateSummary {
  provider: string;
  estimated_cost: number;
  currency: string;
  epochs: number;
  estimated_hours?: number;
}

export interface DatasetAnalysisResult {
  valid: boolean;
  stats: EnhancedDatasetStats;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface DatasetUploadRequest {
  name: string;
  description?: string;
  format: DatasetFormat;
  file: File;
  config_id?: string;
}

export interface TrainingDatasetRecord {
  id: string;
  user_id: string;
  config_id: string | null;
  name: string;
  description: string | null;
  format: DatasetFormat;
  file_size_bytes: number;
  total_examples: number;
  storage_path: string;
  avg_input_length: number | null;
  avg_output_length: number | null;
  created_at: string;
  updated_at: string;
}

console.log('[DatasetTypes] Training dataset types loaded');
