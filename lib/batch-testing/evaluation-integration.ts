import { createClient } from '@supabase/supabase-js';
import type { JudgmentRecord } from '../benchmarks/validator-orchestrator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface EvaluationContext {
  messageId: string;
  conversationId: string;
  userId: string;
  prompt: string;
  response: string;
  modelId: string;
  provider: string;
  benchmarkId?: string;  // Optional: Link judgment to benchmark
  traceId?: string;  // Optional: Link judgment to trace
}

/**
 * Save basic quality judgment for response
 * Note: Benchmark validators are now handled by executeValidators() in chat API
 */
export async function saveBasicJudgment(context: EvaluationContext) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[Evaluation] Starting evaluation for message:', context.messageId);

  // Array to collect all judgment records
  const judgments: JudgmentRecord[] = [];

  // 1. Always run basic quality heuristics
  const score = calculateBasicQualityScore(context.response);
  const passed = score >= 0.6;

  judgments.push({
    message_id: context.messageId,
    judge_type: 'rule',
    judge_name: 'basic-quality-checker',
    criterion: 'response_quality',
    score: score,
    passed: passed,
    benchmark_id: context.benchmarkId || null,
    trace_id: context.traceId || null,
    evidence_json: {
      response_length: context.response.length,
      has_code_block: context.response.includes('```'),
      has_list: context.response.includes('\n-') || context.response.includes('\n*')
    }
  });

  // 2. Note: Benchmark validators are handled by executeValidators() in chat/route.ts
  //    which uses the improved V2 validator system with proper authentication.
  //    This function now only saves the basic-quality-checker judgment.

  // 3. Save all judgments (basic-quality-checker only)
  console.log('[Evaluation] Saving', judgments.length, 'judgment records');

  const { error } = await supabase.from('judgments').insert(judgments);

  if (error) {
    console.error('[Evaluation] Failed to save judgments:', error);
  } else {
    console.log('[Evaluation] Saved', judgments.length, 'judgments successfully');
  }
}

/**
 * Calculate basic quality score (0-1)
 * Based on heuristics like length, structure, etc.
 */
export function calculateBasicQualityScore(response: string): number {
  let score = 0.5; // Start at neutral

  // Length check
  if (response.length > 50) score += 0.1;
  if (response.length > 200) score += 0.1;

  // Structure checks
  if (response.includes('\n')) score += 0.05; // Multi-line
  if (response.includes('```')) score += 0.1; // Code block
  if (response.match(/\n[-*•]/)) score += 0.05; // Lists

  // Content quality signals
  if (response.match(/\b(because|however|therefore|specifically)\b/i)) {
    score += 0.1; // Reasoning words
  }

  // Penalize very short responses
  if (response.length < 20) score -= 0.2;

  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}
