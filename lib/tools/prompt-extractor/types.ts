// Prompt Extractor Tool - Type Definitions
// Date: October 16, 2025

export interface PromptExtractionResult {
  prompts: string[];
  total: number;
  filesProcessed: number;
  errors?: string[];
  exportFilePath?: string; // Path to exported file if export is requested
  exportFormat?: string;   // Format of exported file
}

export interface ExtractionOptions {
  directory?: string; // kept for backward compatibility; optional if dataSource provided
  filePattern?: string; // e.g. *.json
  maxPrompts?: number;
  exportFormat?: 'jsonl' | 'txt'; // Optional export format
  exportFilePath?: string;        // Optional custom export path
  dataSource?: {
    type: 'local' | 'supabase';
    // For local: path to directory
    path?: string;
    // For supabase: bucket name and optional prefix
    bucket?: string;
    prefix?: string;
  };
}

// Phase 2: Batch Execution Types

export interface PromptResponse {
  prompt: string;
  response: string;
  model?: string;
  timestamp: string;
  success: boolean;
  error?: string;
  metadata?: {
    duration_ms?: number;
    tokens_used?: number;
    [key: string]: unknown;
  };
}

export interface BatchExecutionOptions {
  prompts: string[];
  modelEndpoint: string;
  batchSize?: number;
  maxConcurrency?: number;
  requestOptions?: {
    method?: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    timeout?: number;
  };
}

export interface BatchExecutionResult {
  responses: PromptResponse[];
  total: number;
  successful: number;
  failed: number;
  totalDurationMs: number;
  errors?: string[];
}

// Phase 2: Storage Types

export interface StorageOptions {
  responses: PromptResponse[];
  supabaseTable: string;
  batchMetadata?: {
    experimentName?: string;
    modelName?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}

export interface StorageResult {
  stored: number;
  failed: number;
  errors?: string[];
  insertedIds?: string[];
}
