// Benchmark Framework - Type Definitions
// Date: October 19, 2025
// Purpose: Custom benchmarks for task-specific performance measurement

import { JsonValue } from '@/lib/types';

// Re-export JsonValue for other files in this folder
export type { JsonValue };

/**
 * Task types for categorizing benchmarks
 */
export type TaskType =
  | 'code'              // Code generation tasks
  | 'reasoning'         // Logical reasoning, math, etc.
  | 'domain_qa'         // Domain-specific Q&A (medical, legal, etc.)
  | 'structured_output' // JSON, XML generation
  | 'rag'               // Retrieval-augmented generation
  | 'other';            // Custom task types

/**
 * Pass criteria defining benchmark success conditions
 */
export interface PassCriteria {
  min_score: number;                    // Minimum quality score (0-1)
  required_validators?: string[];       // Validators that must pass
  custom_rules?: Record<string, JsonValue>;   // Domain-specific rules
}

/**
 * Benchmark definition
 */
export interface Benchmark {
  id: string;
  name: string;
  description?: string | null;
  task_type: TaskType;
  pass_criteria: PassCriteria;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
}

/**
 * Create benchmark request
 */
export interface CreateBenchmarkRequest {
  name: string;
  description?: string;
  task_type: TaskType;
  pass_criteria: PassCriteria;
  is_public?: boolean;
}

/**
 * Update benchmark request
 */
export interface UpdateBenchmarkRequest {
  name?: string;
  description?: string;
  task_type?: TaskType;
  pass_criteria?: PassCriteria;
  is_public?: boolean;
}

/**
 * Benchmark with usage statistics
 */
export interface BenchmarkWithStats extends Benchmark {
  total_judgments: number;
  pass_rate: number;
  average_score: number;
}
