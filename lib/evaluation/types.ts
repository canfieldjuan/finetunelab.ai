// Evaluation System Types
// Date: October 14, 2025
// Purpose: Centralized type definitions for RAG evaluation framework
//
// This file provides TypeScript interfaces for:
// - Messages with evaluation data
// - Citations
// - Judgments (rule/human/llm)
// - Tool calls
// - Errors
// - Runs (experiment tracking)

import type { JsonValue } from '../types';

/**
 * Message with Evaluation Data
 * Extends base message with evaluation relations
 */
export interface MessageWithEvaluation {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  content_json?: JsonValue;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  created_at: string;

  // Relations
  citations?: Citation[];
  judgments?: Judgment[];
  toolCalls?: ToolCall[];
  errors?: Error[];
}

/**
 * Citation
 * Links parts of an answer to specific documents
 */
export interface Citation {
  id: string;
  message_id: string;
  document_id: string;
  span_start?: number;
  span_end?: number;
  quote?: string;
  correctness?: boolean;
  retriever_log_id?: string;
  created_at: string;
}

/**
 * Judgment
 * Unified evaluation record (rule/human/llm judges)
 */
export interface Judgment {
  id: string;
  message_id: string;
  judge_type: 'rule' | 'human' | 'llm';
  judge_name?: string;
  criterion: string;
  score: number;
  passed: boolean;
  evidence_json?: JsonValue;
  notes?: string;
  created_at: string;
}

/**
 * Tool Call
 * Normalized tool execution tracking
 */
export interface ToolCall {
  id: string;
  message_id: string;
  tool_name: string;
  input_json: JsonValue;
  output_json?: JsonValue;
  success: boolean;
  duration_ms?: number;
  error_message?: string;
  created_at: string;
}

/**
 * Error
 * Normalized error tracking
 */
export interface Error {
  id: string;
  message_id?: string;
  conversation_id: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

/**
 * Run
 * Experiment tracking for A/B testing
 */
export interface Run {
  id: string;
  name: string;
  model_name: string;
  model_version: string;
  prompt_version: string;
  dataset_version?: string;
  git_sha?: string;
  config_json?: JsonValue;
  started_at: string;
  completed_at?: string;
}

/**
 * Retriever Log
 * Audit trail of retrieval operations
 */
export interface RetrieverLog {
  id: string;
  conversation_id: string;
  user_id: string;
  query: string;
  topk: number;
  retrieved_doc_ids: string[];
  scores?: number[];
  latency_ms: number;
  created_at: string;
}

/**
 * Document
 * Source of truth for documents
 */
export interface Document {
  id: string;
  user_id: string;
  filename: string;
  file_type?: string;
  upload_path?: string;
  title?: string;
  uri?: string;
  content?: string;
  checksum?: string;
  visibility?: 'private' | 'team' | 'public';
  owner?: string;
  tags?: string[];
  processed: boolean;
  neo4j_episode_ids?: string[];
  created_at: string;
  updated_at?: string;
  metadata?: JsonValue;
}

/**
 * Chunk
 * Document chunks with embeddings
 */
export interface Chunk {
  id: string;
  document_id: string;
  chunk_index: number;
  text: string;
  embedding_vector?: number[];
  metadata_json?: JsonValue;
  created_at: string;
}

/**
 * Validation Result (from validators)
 * Used by rule validators
 */
export interface ValidationResult {
  passed: boolean;
  score?: number;
  message?: string;
  evidence?: JsonValue;
}

/**
 * Domain Validation Result
 * Extended with validator metadata
 */
export interface DomainValidationResult {
  validator: string;
  criterion: string;
  result: ValidationResult;
  gate: number;
}

/**
 * Structured Output Validation Result
 * From structured-output.validator.ts
 */
export interface StructuredValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors?: string[];
  rawJson?: string;
}

/**
 * Evaluation Summary
 * High-level metrics for a message
 */
export interface EvaluationSummary {
  messageId: string;
  totalValidators: number;
  passedValidators: number;
  failedValidators: number;
  averageScore: number;
  criticalFailures: string[];
  warnings: string[];
  citationCount: number;
  citationValidity: number; // 0-1
}

/**
 * Example usage:
 *
 * // Type-safe message with evaluation
 * const message: MessageWithEvaluation = {
 *   id: '123e4567-...',
 *   conversation_id: '123e4567-...',
 *   user_id: 'user-id-123',
 *   role: 'assistant',
 *   content: 'According to company policy...',
 *   content_json: {
 *     answer: 'According to company policy...',
 *     citations: [{ doc_id: '123e4567-...' }]
 *   },
 *   latency_ms: 1500,
 *   input_tokens: 500,
 *   output_tokens: 250,
 *   created_at: '2025-10-14T12:00:00Z',
 *   citations: [...],
 *   judgments: [...]
 * };
 *
 * // Type-safe judgment
 * const judgment: Judgment = {
 *   id: '123e4567-...',
 *   message_id: '123e4567-...',
 *   judge_type: 'rule',
 *   judge_name: 'must_cite_if_claims',
 *   criterion: 'citation_required',
 *   score: 1,
 *   passed: true,
 *   evidence_json: { hasClaims: true, citationCount: 2 },
 *   notes: 'Found 2 citations',
 *   created_at: '2025-10-14T12:00:00Z'
 * };
 */
