/**
 * LLM Judge Integration for Chat API
 * Automatically evaluates chat messages using GPT-4 or Claude
 *
 * This provides deep quality analysis beyond simple heuristics:
 * - Semantic understanding
 * - Hallucination detection (using GraphRAG ground truth)
 * - Detailed reasoning and improvement suggestions
 */

import { LLMJudge, STANDARD_CRITERIA } from './llm-judge';
import { createClient } from '@supabase/supabase-js';
import { graphragService } from '../graphrag';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE5MjgyMCwiZXhwIjoxOTYwNzY4ODIwfQ.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE'
);

export interface LLMJudgeContext {
  messageId: string;
  conversationId: string;
  userId: string;
  prompt: string;
  response: string;
  modelId: string;
  traceId?: string;
}

/**
 * Evaluate message using LLM judge (async, non-blocking)
 * Call this after message is saved to database
 *
 * @param context - Message context for evaluation
 * @returns Promise that resolves when judgment is saved
 */
export async function evaluateWithLLMJudge(context: LLMJudgeContext): Promise<void> {
  // Skip if no API keys configured (optional feature)
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.log('[LLM Judge] Skipping - no API key configured');
    return;
  }

  // Check if enabled via environment variable (default: disabled for auto-sampling)
  const enabled = process.env.LLM_JUDGE_AUTO_SAMPLE === 'true'; // Default: false
  if (!enabled) {
    console.log('[LLM Judge] Auto-sampling disabled (set LLM_JUDGE_AUTO_SAMPLE=true to enable)');
    return;
  }

  try {
    // Get judge model from env or use default
    const judgeModel = (process.env.LLM_JUDGE_MODEL || 'gpt-4.1') as
      'gpt-4.1' | 'claude-sonnet-4-5-20250929' | 'claude-haiku-4-5-20251001';

    console.log(`[LLM Judge] Evaluating message ${context.messageId} with ${judgeModel}`);

    const judge = new LLMJudge(judgeModel);

    // Fetch GraphRAG context for ground truth validation
    let groundTruthContext = '';
    try {
      const graphragResult = await graphragService.enhancePrompt(
        context.userId,
        context.prompt,
        { maxSources: 10, includeMetadata: true }
      );

      if (graphragResult.contextUsed && graphragResult.sources?.length) {
        const facts = graphragResult.sources.map(s =>
          `- ${s.fact} (entity: ${s.entity}, confidence: ${s.confidence})`
        ).join('\n');

        groundTruthContext = `\n\n**GROUND TRUTH FROM USER'S KNOWLEDGE BASE:**
The following facts are verified from the user's uploaded documents. Use these to evaluate accuracy:
${facts}

IMPORTANT: If the response aligns with these facts, it should be considered ACCURATE.
If the response contradicts these facts, it should be marked as inaccurate.
If the facts don't cover the topic, evaluate based on general knowledge.`;

        console.log(`[LLM Judge] Added ${graphragResult.sources.length} ground truth facts for validation`);
      }
    } catch (err) {
      console.log('[LLM Judge] Could not fetch GraphRAG context:', err);
      // Continue without ground truth - will use general evaluation
    }

    // Build full context with user prompt + ground truth
    const fullContext = `**USER QUESTION:**
${context.prompt}${groundTruthContext}`;

    // Evaluate against all standard criteria
    const results = await judge.judgeMessage({
      message_id: context.messageId,
      message_content: context.response,
      context: fullContext,
      criteria: STANDARD_CRITERIA,
      judge_model: judgeModel
    });

    // Save judgments to database
    const judgments = results.map(result => ({
      message_id: context.messageId,
      judge_type: 'llm' as const,
      judge_name: result.judge_model,
      criterion: result.criterion,
      score: result.score / 10, // Normalize 1-10 scale to 0-1 for consistency
      passed: result.passed,
      trace_id: context.traceId || null,
      evidence_json: {
        reasoning: result.reasoning,
        confidence: result.confidence,
        positive_aspects: result.evidence.positive_aspects,
        negative_aspects: result.evidence.negative_aspects,
        improvement_suggestions: result.evidence.improvement_suggestions,
        original_score: result.score // Store original 1-10 score
      },
      notes: `AI evaluation: ${result.score}/10 (${(result.confidence * 100).toFixed(0)}% confidence)`
    }));

    const { error } = await supabase.from('judgments').insert(judgments);

    if (error) {
      console.error('[LLM Judge] Failed to save judgments:', error);
    } else {
      const passedCount = judgments.filter(j => j.passed).length;
      const totalCount = judgments.length;
      console.log(`[LLM Judge] Saved ${totalCount} judgments (${passedCount} passed) for message ${context.messageId}`);

      // Update trace with groundedness score if trace_id exists
      if (context.traceId) {
        const groundednessJudgment = judgments.find(j => j.criterion === 'groundedness');
        if (groundednessJudgment) {
          const { error: traceError } = await supabase
            .from('llm_traces')
            .update({
              groundedness_score: groundednessJudgment.score
            })
            .eq('trace_id', context.traceId);

          if (traceError) {
            console.error('[LLM Judge] Failed to update trace groundedness_score:', traceError);
          } else {
            console.log(`[LLM Judge] Updated trace ${context.traceId} with groundedness_score: ${groundednessJudgment.score.toFixed(3)}`);
          }
        }
      }
    }

  } catch (error) {
    // Log error but don't throw - this is non-critical
    console.error('[LLM Judge] Evaluation error:', error);

    // Log specific error types for debugging
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        console.error('[LLM Judge] API key error - check environment variables');
      } else if (error.message.includes('rate limit')) {
        console.error('[LLM Judge] Rate limit hit - consider reducing sample rate');
      }
    }
  }
}

/**
 * Determine if message should be evaluated (sampling logic)
 *
 * @param heuristicScore - Score from basic heuristic (0-1)
 * @param responseLength - Length of response
 * @param sampleRate - Random sampling rate (0-1)
 * @returns true if message should be evaluated
 */
export function shouldEvaluateMessage(
  heuristicScore: number,
  responseLength: number,
  sampleRate: number = 0.1
): boolean {
  // Get sample rate from environment or use default
  const envSampleRate = parseFloat(process.env.LLM_JUDGE_SAMPLE_RATE || String(sampleRate));

  // Strategy: Always evaluate if borderline quality OR random sampling
  const isBorderline = heuristicScore >= 0.5 && heuristicScore <= 0.7;
  const isLongResponse = responseLength > 500; // Important queries tend to be longer
  const randomSample = Math.random() < envSampleRate;

  return isBorderline || (isLongResponse && randomSample) || randomSample;
}
