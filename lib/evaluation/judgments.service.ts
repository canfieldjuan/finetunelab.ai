// Judgments Service
// Date: October 14, 2025
// Purpose: Save judgment records to unified judgments table
//
// This service handles:
// - Saving rule-based judgments
// - Saving human judgments
// - Saving LLM-as-judge judgments
// - Batch operations for efficiency
// - Querying judgments for analysis

import { supabase } from '@/lib/supabaseClient';
import type { ValidatorResult } from './validators/rule-validators';
import type { JsonValue } from '@/lib/types';

/**
 * Judgment Record Interface
 * Used for database insertion
 */
export interface JudgmentRecord {
  message_id: string;
  judge_type: 'rule' | 'human' | 'llm';
  criterion: string;
  score: number;
  passed: boolean;
  evidence_json?: JsonValue;
  judge_name?: string;
  notes?: string;
}

/**
 * Judgments Service Class
 * Handles all judgment operations
 */
export class JudgmentsService {
  /**
   * Save a single rule-based judgment
   *
   * @param messageId - Message ID to link judgment to
   * @param validatorName - Name of the validator (e.g., must_cite_if_claims)
   * @param criterion - Criterion being evaluated (e.g., citation_required)
   * @param result - Validator result with passed/score/evidence
   */
  async saveRuleJudgment(
    messageId: string,
    validatorName: string,
    criterion: string,
    result: ValidatorResult
  ): Promise<void> {
    const judgment: JudgmentRecord = {
      message_id: messageId,
      judge_type: 'rule',
      judge_name: validatorName,
      criterion,
      score: result.score || (result.passed ? 1 : 0),
      passed: result.passed,
      evidence_json: result.evidence,
      notes: result.message,
    };

    const { error } = await supabase
      .from('judgments')
      .insert(judgment);

    if (error) {
      console.error('[Judgments] Error saving judgment:', error);
      throw error;
    }

    console.log(`[Judgments] Saved ${criterion} judgment for message ${messageId}`);
  }

  /**
   * Save multiple rule-based judgments in a single batch
   * More efficient than calling saveRuleJudgment multiple times
   *
   * @param messageId - Message ID to link judgments to
   * @param validationResults - Array of validation results from domain validators
   */
  async saveRuleJudgments(
    messageId: string,
    validationResults: Array<{
      validator: string;
      criterion: string;
      result: ValidatorResult
    }>
  ): Promise<void> {
    const judgments = validationResults.map(vr => ({
      message_id: messageId,
      judge_type: 'rule' as const,
      judge_name: vr.validator,
      criterion: vr.criterion,
      score: vr.result.score || (vr.result.passed ? 1 : 0),
      passed: vr.result.passed,
      evidence_json: vr.result.evidence,
      notes: vr.result.message,
    }));

    const { error } = await supabase
      .from('judgments')
      .insert(judgments);

    if (error) {
      console.error('[Judgments] Error saving batch judgments:', error);
      throw error;
    }

    console.log(`[Judgments] Saved ${judgments.length} judgments for message ${messageId}`);
  }

  /**
   * Save a human judgment
   * Called when user provides evaluation in UI
   *
   * @param messageId - Message ID
   * @param criterion - What is being evaluated (e.g., overall_quality, citation_correctness)
   * @param score - Human-provided score (0-1)
   * @param passed - Whether evaluation passed
   * @param notes - Optional human notes
   */
  async saveHumanJudgment(
    messageId: string,
    criterion: string,
    score: number,
    passed: boolean,
    notes?: string
  ): Promise<void> {
    const judgment: JudgmentRecord = {
      message_id: messageId,
      judge_type: 'human',
      criterion,
      score,
      passed,
      notes,
    };

    const { error } = await supabase
      .from('judgments')
      .insert(judgment);

    if (error) {
      console.error('[Judgments] Error saving human judgment:', error);
      throw error;
    }

    console.log(`[Judgments] Saved human judgment for ${criterion} on message ${messageId}`);
  }

  /**
   * Get all judgments for a message
   *
   * @param messageId - Message ID
   * @returns Array of judgments
   */
  async getJudgments(messageId: string): Promise<JudgmentRecord[]> {
    const { data, error } = await supabase
      .from('judgments')
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Judgments] Error fetching judgments:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get judgments by type
   *
   * @param messageId - Message ID
   * @param judgeType - Type of judge (rule, human, llm)
   * @returns Array of judgments
   */
  async getJudgmentsByType(
    messageId: string,
    judgeType: 'rule' | 'human' | 'llm'
  ): Promise<JudgmentRecord[]> {
    const { data, error } = await supabase
      .from('judgments')
      .select('*')
      .eq('message_id', messageId)
      .eq('judge_type', judgeType)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Judgments] Error fetching judgments by type:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Calculate judgment statistics for a message
   *
   * @param messageId - Message ID
   * @returns Statistics object with pass rate, average score, etc.
   */
  async getJudgmentStats(messageId: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgScore: number;
    byType: {
      rule: { count: number; passed: number };
      human: { count: number; passed: number };
      llm: { count: number; passed: number };
    };
  }> {
    const judgments = await this.getJudgments(messageId);

    const total = judgments.length;
    const passed = judgments.filter(j => j.passed).length;
    const failed = total - passed;
    const passRate = total > 0 ? passed / total : 0;

    const totalScore = judgments.reduce((sum, j) => sum + (j.score || 0), 0);
    const avgScore = total > 0 ? totalScore / total : 0;

    const byType = {
      rule: {
        count: judgments.filter(j => j.judge_type === 'rule').length,
        passed: judgments.filter(j => j.judge_type === 'rule' && j.passed).length,
      },
      human: {
        count: judgments.filter(j => j.judge_type === 'human').length,
        passed: judgments.filter(j => j.judge_type === 'human' && j.passed).length,
      },
      llm: {
        count: judgments.filter(j => j.judge_type === 'llm').length,
        passed: judgments.filter(j => j.judge_type === 'llm' && j.passed).length,
      },
    };

    return {
      total,
      passed,
      failed,
      passRate,
      avgScore,
      byType,
    };
  }

  /**
   * Get failed judgments for a message
   * Useful for identifying issues
   *
   * @param messageId - Message ID
   * @returns Array of failed judgments
   */
  async getFailedJudgments(messageId: string): Promise<JudgmentRecord[]> {
    const { data, error } = await supabase
      .from('judgments')
      .select('*')
      .eq('message_id', messageId)
      .eq('passed', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Judgments] Error fetching failed judgments:', error);
      throw error;
    }

    return data || [];
  }
}

/**
 * Singleton instance for convenience
 */
export const judgmentsService = new JudgmentsService();

/**
 * Example usage:
 *
 * // 1. Save rule-based judgments from validators
 * const validationResults = await executeDomainValidation('company_expert', {...});
 * await judgmentsService.saveRuleJudgments('msg-id-123', validationResults);
 *
 * // 2. Save a single rule judgment
 * await judgmentsService.saveRuleJudgment(
 *   'msg-id-123',
 *   'must_cite_if_claims',
 *   'citation_required',
 *   { passed: true, score: 1, message: 'Found 2 citations' }
 * );
 *
 * // 3. Save human judgment from UI
 * await judgmentsService.saveHumanJudgment(
 *   'msg-id-123',
 *   'overall_quality',
 *   0.85,
 *   true,
 *   'Good response, minor formatting issues'
 * );
 *
 * // 4. Get judgment statistics
 * const stats = await judgmentsService.getJudgmentStats('msg-id-123');
 * console.log(`Pass rate: ${(stats.passRate * 100).toFixed(1)}%`);
 * console.log(`Avg score: ${stats.avgScore.toFixed(2)}`);
 * console.log(`Rule judgments: ${stats.byType.rule.count} (${stats.byType.rule.passed} passed)`);
 *
 * // 5. Get failed judgments to debug
 * const failed = await judgmentsService.getFailedJudgments('msg-id-123');
 * failed.forEach(j => {
 *   console.log(`Failed: ${j.criterion} - ${j.notes}`);
 *   console.log(`Evidence:`, j.evidence_json);
 * });
 */
