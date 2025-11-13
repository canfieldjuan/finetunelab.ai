// Training Dataset Types
// Type definitions for dataset upload and management
// Date: 2025-10-16

export type DatasetFormat = 'chatml' | 'sharegpt' | 'jsonl' | 'dpo' | 'rlhf' | 'alpaca' | 'openorca' | 'unnatural';

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
