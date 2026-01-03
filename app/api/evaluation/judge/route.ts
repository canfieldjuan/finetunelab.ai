/**
 * API Route: LLM-Judge Evaluation
 * POST /api/evaluation/judge
 *
 * Evaluates AI messages using GPT-4.1 or Claude as judges
 * Uses GraphRAG to fetch ground truth from user's documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LLMJudge, STANDARD_CRITERIA, LLMJudgeCriterion, LLMJudgmentResult } from '@/lib/evaluation/llm-judge';
import { graphragService } from '@/lib/graphrag';
// DEPRECATED: import { recordUsageEvent } from '@/lib/usage/checker';

export const runtime = 'nodejs';

interface EvaluationRequest {
  message_id: string;
  message_content?: string; // Optional - will fetch from DB if not provided
  context?: string;
  criteria?: string[] | LLMJudgeCriterion[]; // Criterion names or full objects
  judge_model?: 'gpt-4.1' | 'claude-sonnet-4-5-20250929' | 'claude-haiku-4-5-20251001';
  save_to_db?: boolean; // Whether to save results to database
}

interface BatchEvaluationRequest {
  message_ids: string[];
  criteria?: string[] | LLMJudgeCriterion[];
  judge_model?: 'gpt-4.1' | 'claude-sonnet-4-5-20250929' | 'claude-haiku-4-5-20251001';
  save_to_db?: boolean;
}

/**
 * POST /api/evaluation/judge
 * Evaluate single or multiple messages
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    }: { data: { user: any }; error: any } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[EvaluationJudge] Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine if batch or single evaluation
    const isBatch = 'message_ids' in body;

    if (isBatch) {
      return await handleBatchEvaluation(supabase, user.id, body as BatchEvaluationRequest);
    } else {
      return await handleSingleEvaluation(supabase, user.id, body as EvaluationRequest);
    }
  } catch (error) {
    console.error('[EvaluationJudge] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Evaluation failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle single message evaluation
 */
async function handleSingleEvaluation(
  supabase: SupabaseClient,
  userId: string,
  request: EvaluationRequest
) {
  console.log('[EvaluationJudge] Single evaluation:', request.message_id);

  // Fetch message content AND the preceding user prompt
  let messageContent = request.message_content;
  let userPrompt = '';
  let conversationId = '';

  if (!messageContent) {
    // Get the assistant message with conversation context
    const { data: message, error }: { data: any; error: any } = await supabase
      .from('messages')
      .select('content, conversation_id, created_at')
      .eq('id', request.message_id)
      .single();

    if (error || !message) {
      console.error('[EvaluationJudge] Message not found:', request.message_id, error);
      return NextResponse.json(
        { error: 'Message not found or access denied' },
        { status: 404 }
      );
    }

    messageContent = message.content;
    conversationId = message.conversation_id;

    // Fetch the user message that preceded this assistant response
    const { data: prevMessage }: { data: any } = await supabase
      .from('messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .lt('created_at', message.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (prevMessage) {
      userPrompt = prevMessage.content;
    }
  }

  // Ensure we have message content
  if (!messageContent) {
    return NextResponse.json(
      { error: 'Message content is required' },
      { status: 400 }
    );
  }

  // Fetch GraphRAG ground truth for accuracy validation
  let groundTruthContext = '';
  if (userPrompt) {
    console.log(`[EvaluationJudge] Fetching GraphRAG context for: "${userPrompt.slice(0, 100)}..."`);
    console.log(`[EvaluationJudge] User ID for GraphRAG: ${userId}`);

    try {
      const graphragResult = await graphragService.enhancePrompt(
        userId,
        userPrompt,
        { maxSources: 15, includeMetadata: true }
      );

      console.log(`[EvaluationJudge] GraphRAG result:`, {
        contextUsed: graphragResult.contextUsed,
        sourcesCount: graphragResult.sources?.length || 0,
        metadata: graphragResult.metadata
      });

      if (graphragResult.contextUsed && graphragResult.sources?.length) {
        const facts = graphragResult.sources.map(s =>
          `- ${s.fact} (entity: ${s.entity}, confidence: ${(s.confidence * 100).toFixed(0)}%)`
        ).join('\n');

        groundTruthContext = `

**GROUND TRUTH FROM USER'S KNOWLEDGE BASE:**
The following facts are verified from the user's uploaded documents:
${facts}

IMPORTANT: If the response aligns with these facts, it is ACCURATE. Do NOT penalize for matching documented behavior.`;

        console.log(`[EvaluationJudge] Added ${graphragResult.sources.length} ground truth facts`);
      } else {
        console.log(`[EvaluationJudge] No GraphRAG context found - contextUsed: ${graphragResult.contextUsed}`);
      }
    } catch (err) {
      console.error('[EvaluationJudge] GraphRAG error:', err);
    }
  } else {
    console.log('[EvaluationJudge] No userPrompt available for GraphRAG lookup');
  }

  // Build full context with user question + ground truth
  const fullContext = userPrompt
    ? `**USER QUESTION:**\n${userPrompt}${groundTruthContext}`
    : request.context || '';

  // Log what we're sending to the judge
  console.log('[EvaluationJudge] === JUDGE CONTEXT ===');
  console.log('[EvaluationJudge] Has ground truth:', groundTruthContext.length > 0);
  console.log('[EvaluationJudge] Full context length:', fullContext.length);
  console.log('[EvaluationJudge] Context preview:', fullContext.slice(0, 500));
  console.log('[EvaluationJudge] ======================');

  // Prepare criteria
  const criteria = prepareCriteria(request.criteria);

  // Initialize judge with correct model
  const judge = new LLMJudge(request.judge_model || 'gpt-4.1');

  // Perform evaluation with ground truth context
  const results = await judge.judgeMessage({
    message_id: request.message_id,
    message_content: messageContent,
    context: fullContext,
    criteria,
    judge_model: request.judge_model,
  });

  // Save to database if requested
  if (request.save_to_db !== false) {
    // Default to true
    await saveJudgmentsToDatabase(supabase, results);
  }

  // DEPRECATED: OLD usage tracking system
  // Now using usage_meters table via increment_root_trace_count()
  // await recordUsageEvent({
  //   userId,
  //   metricType: 'evaluation_run',
  //   value: 1,
  //   resourceType: 'message',
  //   resourceId: request.message_id,
  //   metadata: {
  //     judgeModel: request.judge_model || 'gpt-4.1',
  //     criteriaCount: criteria.length,
  //     passedCount: results.filter((r) => r.passed).length,
  //   },
  // });

  return NextResponse.json({
    success: true,
    message_id: request.message_id,
    evaluations: results,
    summary: {
      total_criteria: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      average_score: results.reduce((sum, r) => sum + r.score, 0) / results.length / 10, // Normalize to 0-1
      average_confidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
    },
  });
}

/**
 * Handle batch message evaluation
 */
async function handleBatchEvaluation(
  supabase: SupabaseClient,
  userId: string,
  request: BatchEvaluationRequest
) {
  console.log('[EvaluationJudge] Batch evaluation:', request.message_ids.length, 'messages');

  // Fetch messages with conversation context
  const { data: messages, error }: { data: any; error: any } = await supabase
    .from('messages')
    .select('id, content, conversation_id, created_at, role')
    .in('id', request.message_ids);

  if (error || !messages || messages.length === 0) {
    console.error('[EvaluationJudge] Messages not found:', request.message_ids, error);
    return NextResponse.json(
      { error: 'Messages not found or access denied' },
      { status: 404 }
    );
  }

  // Optimize: Fetch all user messages for all conversations in a single query
  // This reduces O(n) queries to just 1 query
  const conversationIds = [...new Set(messages
    .filter((m: any) => m.role === 'assistant' && m.conversation_id)
    .map((m: any) => m.conversation_id)
  )];

  const messageContextMap = new Map<string, { userPrompt: string; conversationId: string }>();

  if (conversationIds.length > 0) {
    // Fetch all user messages for these conversations
    const { data: userMessages }: { data: any } = await supabase
      .from('messages')
      .select('content, conversation_id, created_at')
      .in('conversation_id', conversationIds)
      .eq('role', 'user')
      .order('created_at', { ascending: false });

    if (userMessages && userMessages.length > 0) {
      // Build a map of conversation_id → sorted user messages
      const userMsgsByConversation = new Map<string, any[]>();
      for (const userMsg of userMessages) {
        const convId = userMsg.conversation_id;
        if (!userMsgsByConversation.has(convId)) {
          userMsgsByConversation.set(convId, []);
        }
        userMsgsByConversation.get(convId)!.push(userMsg);
      }

      // For each assistant message, find the preceding user question
      for (const msg of messages) {
        if (msg.role === 'assistant' && msg.conversation_id) {
          const userMsgs = userMsgsByConversation.get(msg.conversation_id);
          if (userMsgs) {
            // Find the first user message before this assistant message
            const prevMessage = userMsgs.find((um: any) =>
              new Date(um.created_at) < new Date(msg.created_at)
            );

            if (prevMessage) {
              messageContextMap.set(msg.id, {
                userPrompt: prevMessage.content,
                conversationId: msg.conversation_id
              });
            }
          }
        }
      }
    }
  }

  // Prepare criteria
  const criteria = prepareCriteria(request.criteria);

  // Initialize judge with correct model
  const judge = new LLMJudge(request.judge_model || 'gpt-4.1');

  // Prepare batch requests with GraphRAG context
  const batchRequests = await Promise.all(
    messages.map(async (msg: { id: string; content: string; role: string }) => {
      let context = '';
      const msgContext = messageContextMap.get(msg.id);

      if (msgContext?.userPrompt) {
        // Fetch GraphRAG ground truth
        try {
          const graphragResult = await graphragService.enhancePrompt(
            userId,
            msgContext.userPrompt,
            { maxSources: 10, includeMetadata: true }
          );

          if (graphragResult.contextUsed && graphragResult.sources?.length) {
            const facts = graphragResult.sources.map(s =>
              `- ${s.fact} (entity: ${s.entity}, confidence: ${(s.confidence * 100).toFixed(0)}%)`
            ).join('\n');

            context = `**USER QUESTION:**
${msgContext.userPrompt}

**GROUND TRUTH FROM KNOWLEDGE BASE:**
${facts}

IMPORTANT: If response aligns with these facts, it is ACCURATE.`;
          } else {
            context = `**USER QUESTION:**\n${msgContext.userPrompt}`;
          }
        } catch {
          context = `**USER QUESTION:**\n${msgContext.userPrompt}`;
        }
      }

      return {
        message_id: msg.id,
        message_content: msg.content,
        context,
        criteria,
        judge_model: request.judge_model,
      };
    })
  );

  console.log(`[EvaluationJudge] Prepared ${batchRequests.length} requests with GraphRAG context`);

  // Perform batch evaluation
  const results = await judge.batchJudge(batchRequests);

  // Convert Map to object for JSON response
  const resultsObject: Record<string, LLMJudgmentResult[]> = {};
  results.forEach((judgments, messageId) => {
    resultsObject[messageId] = judgments;
  });

  // Save to database if requested
  if (request.save_to_db !== false) {
    const allJudgments = Array.from(results.values()).flat();
    await saveJudgmentsToDatabase(supabase, allJudgments);
  }

  // DEPRECATED: OLD usage tracking system
  // Now using usage_meters table via increment_root_trace_count()
  // await recordUsageEvent({
  //   userId,
  //   metricType: 'evaluation_run',
  //   value: request.message_ids.length,
  //   resourceType: 'batch_evaluation',
  //   resourceId: request.message_ids[0],
  //   metadata: {
  //     judgeModel: request.judge_model || 'gpt-4.1',
  //     criteriaCount: criteria.length,
  //     messagesEvaluated: request.message_ids.length,
  //   },
  // });

  // Calculate summary statistics
  const allJudgments = Array.from(results.values()).flat();
  const summary = {
    total_messages: messages.length,
    total_evaluations: allJudgments.length,
    passed: allJudgments.filter((r) => r.passed).length,
    failed: allJudgments.filter((r) => !r.passed).length,
    average_score: allJudgments.reduce((sum, r) => sum + r.score, 0) / allJudgments.length / 10, // Normalize to 0-1
    average_confidence:
      allJudgments.reduce((sum, r) => sum + r.confidence, 0) / allJudgments.length,
  };

  return NextResponse.json({
    success: true,
    results: resultsObject,
    summary,
  });
}

/**
 * Prepare criteria from request
 */
function prepareCriteria(
  criteria?: string[] | LLMJudgeCriterion[]
): LLMJudgeCriterion[] {
  if (!criteria || criteria.length === 0) {
    // Default to all standard criteria
    return STANDARD_CRITERIA;
  }

  // Check if array of criterion names or full objects
  if (typeof criteria[0] === 'string') {
    // Map criterion names to standard criteria
    return (criteria as string[])
      .map((name) => STANDARD_CRITERIA.find((c) => c.name === name))
      .filter((c): c is LLMJudgeCriterion => c !== undefined);
  }

  // Already full criterion objects
  return criteria as LLMJudgeCriterion[];
}

/**
 * Save judgments to database
 */
async function saveJudgmentsToDatabase(supabase: SupabaseClient, judgments: LLMJudgmentResult[]) {
  const uniqueMessageIds = Array.from(new Set(judgments.map(j => j.message_id)));

  console.log('[EvaluationJudge] saveJudgmentsToDatabase - Looking up trace_ids for message_ids:', uniqueMessageIds);

  // Fetch trace IDs for these messages to link judgments
  const { data: traces, error: tracesError } = await supabase
    .from('llm_traces')
    .select('message_id, trace_id')
    .in('message_id', uniqueMessageIds)
    .order('created_at', { ascending: false });

  if (tracesError) {
    console.error('[EvaluationJudge] Error fetching traces:', tracesError);
  }

  console.log('[EvaluationJudge] Found traces:', traces?.length || 0, traces);

  const messageToTraceMap = new Map<string, string>();
  if (traces) {
    for (const trace of traces) {
      if (trace.message_id && !messageToTraceMap.has(trace.message_id)) {
        messageToTraceMap.set(trace.message_id, trace.trace_id);
        console.log('[EvaluationJudge] Mapped message_id:', trace.message_id, '-> trace_id:', trace.trace_id);
      }
    }
  }

  console.log('[EvaluationJudge] Final messageToTraceMap size:', messageToTraceMap.size);

  const records = judgments.map((judgment) => ({
    message_id: judgment.message_id,
    trace_id: messageToTraceMap.get(judgment.message_id) || null,
    judge_type: 'llm',
    judge_name: judgment.judge_model,
    criterion: judgment.criterion,
    score: judgment.score / 10,
    passed: judgment.passed,
    evidence_json: {
      reasoning: judgment.reasoning,
      confidence: judgment.confidence,
      positive_aspects: judgment.evidence.positive_aspects,
      negative_aspects: judgment.evidence.negative_aspects,
      improvement_suggestions: judgment.evidence.improvement_suggestions,
      original_score: judgment.score,
    },
    notes: `AI evaluation: ${judgment.score}/10 (${(judgment.confidence * 100).toFixed(0)}% confidence)`,
  }));

  console.log('[EvaluationJudge] Inserting judgment records:', records.map(r => ({
    message_id: r.message_id,
    trace_id: r.trace_id,
    criterion: r.criterion,
    score: r.score
  })));

  const { error } = await supabase.from('judgments').insert(records);

  if (error) {
    console.error('[EvaluationJudge] Failed to save judgments:', error);
    throw new Error(`Database save failed: ${error.message}`);
  }

  // Update trace with evaluation summary if trace_id exists
  const traceUpdates = new Map<string, { groundedness: number[], quality: number[] }>();
  
  for (const record of records) {
    if (!record.trace_id) continue;
    
    if (!traceUpdates.has(record.trace_id)) {
      traceUpdates.set(record.trace_id, { groundedness: [], quality: [] });
    }
    
    const update = traceUpdates.get(record.trace_id)!;
    
    if (record.criterion === 'groundedness') {
      update.groundedness.push(record.score);
    } else {
      update.quality.push(record.score);
    }
  }

  // Apply updates to traces (fire and forget)
  for (const [traceId, scores] of traceUpdates.entries()) {
    const updates: Record<string, unknown> = {};
    
    if (scores.groundedness.length > 0) {
      const avg = scores.groundedness.reduce((a, b) => a + b, 0) / scores.groundedness.length;
      updates.groundedness_score = avg;
    }
    
    // We could also update response_quality_breakdown here if needed
    
    if (Object.keys(updates).length > 0) {
      supabase.from('llm_traces').update(updates).eq('trace_id', traceId).then(({ error }) => {
        if (error) console.error(`[EvaluationJudge] Failed to update trace ${traceId}:`, error);
      });
    }
  }

  console.log('[EvaluationJudge] Saved', records.length, 'judgments to database');
}

/**
 * GET /api/evaluation/judge/criteria
 * Get available evaluation criteria
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    standard_criteria: STANDARD_CRITERIA.map((c) => ({
      name: c.name,
      description: c.description,
      min_score: c.min_score,
      max_score: c.max_score,
      passing_score: c.passing_score,
    })),
    available_models: ['gpt-4', 'gpt-4-turbo', 'claude-3-opus', 'claude-3-sonnet'],
  });
}
