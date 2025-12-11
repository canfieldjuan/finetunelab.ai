// Validator Orchestrator
// Date: October 19, 2025
// Purpose: Run domain validators based on benchmark requirements

import type { Benchmark, JsonValue } from './types';
import type { EvaluationContext } from '../batch-testing/evaluation-integration';
import {
  mustCiteIfClaims,
  formatOk,
  type ValidatorResult,
} from '../evaluation/validators/rule-validators';

/**
 * Judgment record to save to database
 */
export interface JudgmentRecord {
  message_id: string;
  benchmark_id?: string | null;
  judge_type: 'rule' | 'human' | 'llm';
  judge_name: string;
  criterion: string;
  score: number;
  passed: boolean;
  evidence_json?: JsonValue;
}

/**
 * Validator function signature
 * Some validators need extra data, marked as optional for now
 */
type ValidatorFunction = (
  content: string,
  contentJson?: JsonValue,
  userId?: string
) => Promise<ValidatorResult> | ValidatorResult;

/**
 * Map of validator names to functions
 * Currently supports validators that only need response text
 * Note: Wrapper functions adapt specific validators to the generic ValidatorFunction signature
 */
const VALIDATOR_MAP: Record<string, ValidatorFunction> = {
  'must_cite_if_claims': async (content, contentJson) => {
    // mustCiteIfClaims expects ContentJsonWithCitations, cast if available
    const citations = contentJson as { citations?: Array<{ doc_id: string; quote?: string }> } | undefined;
    return mustCiteIfClaims(content, citations || { citations: [] });
  },
  'format_ok': (content, contentJson) => {
    // formatOk expects JsonValue, provide empty object as fallback
    return formatOk(content, contentJson || {});
  },
  // Advanced validators (require extra data - future enhancement):
  // 'citation_exists': citationExists,  // Needs userId, contentJson
  // 'retrieval_relevance_at_k': retrievalRelevanceAtK,  // Needs query, retrievedDocs
  // 'policy_scope_allowed': policyScopeAllowed,  // Needs contentJson, userId
  // 'freshness_ok': freshnessOk,  // Needs contentJson
};

/**
 * Run validators specified in benchmark requirements
 * Returns array of judgment records ready to save
 */
export async function runBenchmarkValidators(
  context: EvaluationContext,
  benchmark: Benchmark
): Promise<JudgmentRecord[]> {
  console.log('[Validator Orchestrator] Running validators for benchmark:', benchmark.name);

  const judgments: JudgmentRecord[] = [];
  const requiredValidators = benchmark.pass_criteria.required_validators || [];

  console.log('[Validator Orchestrator] Required validators:', requiredValidators);

  for (const validatorName of requiredValidators) {
    const validator = VALIDATOR_MAP[validatorName];

    if (!validator) {
      console.warn('[Validator Orchestrator] Validator not found:', validatorName);
      continue;
    }

    try {
      console.log('[Validator Orchestrator] Running validator:', validatorName);

      // Run validator (some are async, some are sync)
      const result = await Promise.resolve(
        validator(context.response, undefined, context.userId)
      );

      // Convert validator result to judgment record
      const judgment: JudgmentRecord = {
        message_id: context.messageId,
        benchmark_id: context.benchmarkId || null,
        judge_type: 'rule',
        judge_name: validatorName,
        criterion: validatorName.replace(/_/g, ' '),
        score: result.score !== undefined ? result.score : (result.passed ? 1.0 : 0.0),
        passed: result.passed,
        evidence_json: result.evidence || null,
      };

      judgments.push(judgment);

      console.log('[Validator Orchestrator] Validator result:', {
        name: validatorName,
        passed: result.passed,
        score: judgment.score,
      });

    } catch (error) {
      console.error('[Validator Orchestrator] Validator error:', {
        validator: validatorName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log('[Validator Orchestrator] Completed:', judgments.length, 'judgments');
  return judgments;
}
