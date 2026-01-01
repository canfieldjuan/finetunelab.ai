/**
 * Validator Executor
 * Date: 2025-11-30
 * Purpose: Execute benchmark validators and save results
 *
 * This module:
 * 1. Fetches benchmark configuration
 * 2. Executes required validators
 * 3. Saves judgment results to database
 */

import { supabase } from '@/lib/supabaseClient';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  type ValidatorResult,
  VALIDATORS_V2,
} from './rule-validators';
import type { ValidatorContext } from './validator-context';

/**
 * Map of validator IDs to their implementation functions
 * Updated to use context-based API (V2) for proper parameter passing
 */
const VALIDATOR_MAP: Record<string, (context: ValidatorContext) => Promise<ValidatorResult> | ValidatorResult> = {
  'must_cite_if_claims': VALIDATORS_V2.must_cite_if_claims,
  'format_ok': VALIDATORS_V2.format_ok,
  'citation_exists': VALIDATORS_V2.citation_exists,
  'retrieval_relevance_at_k': VALIDATORS_V2.retrieval_relevance_at_k,
  'policy_scope_allowed': VALIDATORS_V2.policy_scope_allowed,
  'freshness_ok': VALIDATORS_V2.freshness_ok,
  'answer_similarity': VALIDATORS_V2.answer_similarity,
};

/**
 * Extended validator result with metadata
 */
export interface ExecutorResult extends ValidatorResult {
  validatorId: string;
  validatorName: string;
}

/**
 * Execute all validators for a benchmark
 *
 * @param benchmarkId - ID of the benchmark to execute validators for
 * @param messageId - ID of the message being evaluated
 * @param responseContent - Raw LLM response text
 * @param contentJson - Parsed structured output (if any)
 * @param userId - User ID for database access
 * @param supabaseClient - Optional authenticated Supabase client (if not provided, will use service role)
 * @returns Array of validator results
 */
export async function executeValidators(
  benchmarkId: string,
  messageId: string,
  responseContent: string,
  contentJson: unknown,
  userId: string,
  supabaseClient?: SupabaseClient | null
): Promise<ExecutorResult[]> {
  console.log('[ValidatorExecutor] Executing validators for benchmark:', benchmarkId);

  try {
    // Get authenticated client - use provided client or create service role client
    const authenticatedClient = supabaseClient || (() => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      console.log('[ValidatorExecutor] No client provided, using service role client');
      return createClient(supabaseUrl, supabaseServiceKey);
    })();

    // 1. Fetch benchmark configuration
    const { data: benchmark, error: benchmarkError } = await authenticatedClient
      .from('benchmarks')
      .select('id, name, pass_criteria')
      .eq('id', benchmarkId)
      .single();

    if (benchmarkError || !benchmark) {
      console.error('[ValidatorExecutor] Failed to fetch benchmark:', benchmarkError);
      return [];
    }

    // 2. Get required validators from benchmark
    const requiredValidators = benchmark.pass_criteria?.required_validators || [];

    if (requiredValidators.length === 0) {
      console.log('[ValidatorExecutor] No validators configured for benchmark');
      return [];
    }

    console.log('[ValidatorExecutor] Running validators:', requiredValidators);

    // 3. Build validator context with all available data
    const validatorContext: ValidatorContext = {
      responseContent,
      contentJson,
      userId,
      messageId,
      benchmarkId,
      validatorConfig: benchmark.pass_criteria.custom_rules || {},
    };

    // 4. Execute each validator
    const results: ExecutorResult[] = [];

    for (const validatorId of requiredValidators) {
      const validatorFn = VALIDATOR_MAP[validatorId];

      if (!validatorFn) {
        console.warn('[ValidatorExecutor] Unknown validator:', validatorId);
        continue;
      }

      try {
        // Execute the validator with full context
        const result = await validatorFn(validatorContext);

        // Add metadata
        const executorResult: ExecutorResult = {
          ...result,
          validatorId,
          validatorName: getValidatorName(validatorId),
        };

        results.push(executorResult);

        console.log('[ValidatorExecutor] Validator executed:', {
          validatorId,
          passed: result.passed,
          score: result.score,
        });
      } catch (error) {
        console.error('[ValidatorExecutor] Validator execution failed:', validatorId, error);
        // Continue with other validators even if one fails
      }
    }

    // 4. Save results to judgments table
    if (results.length > 0) {
      await saveJudgments(messageId, results, userId, authenticatedClient);
    }

    return results;
  } catch (error) {
    console.error('[ValidatorExecutor] Unexpected error:', error);
    return [];
  }
}

/**
 * Save validator results to judgments table
 */
async function saveJudgments(
  messageId: string,
  results: ExecutorResult[],
  userId: string,
  client: SupabaseClient
): Promise<void> {
  console.log('[ValidatorExecutor] Saving judgments:', results.length);

  try {
    // Prepare judgment records
    const judgments = results.map(result => ({
      message_id: messageId,
      judge_type: 'rule' as const,
      judge_name: result.validatorName,
      criterion: result.validatorId,
      score: result.score || (result.passed ? 1.0 : 0.0),
      passed: result.passed,
      evidence_json: result.evidence || null,
      notes: result.message || null,
    }));

    // Insert all judgments using authenticated client
    const { error: insertError } = await client
      .from('judgments')
      .insert(judgments);

    if (insertError) {
      console.error('[ValidatorExecutor] Failed to save judgments:', insertError);
    } else {
      console.log('[ValidatorExecutor] Saved', judgments.length, 'judgments');
    }
  } catch (error) {
    console.error('[ValidatorExecutor] Error saving judgments:', error);
  }
}

/**
 * Get human-readable validator name
 */
function getValidatorName(validatorId: string): string {
  const names: Record<string, string> = {
    'must_cite_if_claims': 'Must Cite If Claims',
    'format_ok': 'Format OK',
    'citation_exists': 'Citation Exists',
    'retrieval_relevance_at_k': 'Retrieval Relevance',
    'policy_scope_allowed': 'Policy Scope Allowed',
    'freshness_ok': 'Freshness OK',
    'answer_similarity': 'Answer Similarity',
  };

  return names[validatorId] || validatorId;
}

/**
 * Example usage:
 *
 * const results = await executeValidators(
 *   'benchmark-123',
 *   'message-456',
 *   'According to company policy, employees must...',
 *   { citations: [{ doc_id: '789' }] },
 *   'user-id'
 * );
 *
 * // Results are automatically saved to judgments table
 * // Returns: [{ validatorId: 'must_cite_if_claims', passed: true, ... }]
 */
