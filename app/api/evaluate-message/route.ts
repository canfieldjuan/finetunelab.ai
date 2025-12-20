// Evaluate Message API Route
// Date: October 14, 2025
// Purpose: Post-process message evaluation with validators and save judgments
//
// This endpoint is called after a message is saved to:
// 1. Extract and validate structured output
// 2. Run domain-specific validators
// 3. Save citations to database
// 4. Save judgments to database

import { NextRequest, NextResponse } from 'next/server';
import { structuredOutputValidator } from '@/lib/evaluation/validators/structured-output.validator';
import { executeDomainValidation } from '@/lib/evaluation/domains/registry';
import { citationsService } from '@/lib/evaluation/citations.service';
import { judgmentsService } from '@/lib/evaluation/judgments.service';
import { supabase } from '@/lib/supabaseClient';

/**
 * POST /api/evaluate-message
 *
 * Request body:
 * {
 *   messageId: string;
 *   domain: 'company_expert' | 'pc_expert';
 *   retrievedSources?: Array<{ text: string }>;
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   validationResults?: Array<{ validator, passed, score, message }>;
 *   errors?: string[];
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { messageId, domain, retrievedSources } = body;

    // Validate required fields
    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    if (!domain) {
      return NextResponse.json(
        { error: 'domain is required' },
        { status: 400 }
      );
    }

    // Get message from database
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('id, content, user_id, conversation_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      console.error('[EvaluateMessage] Message not found:', fetchError);
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // 1. Validate structured output
    const validation = structuredOutputValidator.validate(message.content, domain);

    if (!validation.valid) {
      console.warn('[EvaluateMessage] Structured output validation failed:', validation.errors);
      return NextResponse.json({
        success: false,
        errors: validation.errors || ['Validation failed']
      }, { status: 400 });
    }

    const contentJson = validation.data;

    // 2. Update message with content_json
    const { error: updateError } = await supabase
      .from('messages')
      .update({ content_json: contentJson })
      .eq('id', messageId);

    if (updateError) {
      console.error('[EvaluateMessage] Error updating message:', updateError);
    }

    // 3. Execute domain validators
    const validationResults = await executeDomainValidation(domain, {
      content: message.content,
      contentJson: (contentJson || {}) as import('@/lib/types').JsonValue,
      userId: message.user_id,
      retrievedDocs: retrievedSources || [],
    });

    // 4. Save citations (async, don't block)
    if (contentJson && typeof contentJson === 'object' && 'citations' in contentJson) {
      const citations = (contentJson as Record<string, unknown>).citations;
      if (Array.isArray(citations) && citations.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        citationsService.saveCitations(messageId, contentJson as any).catch((err: Error) => {
          console.error('[EvaluateMessage] Error saving citations:', err);
        });
      }
    }

    // 5. Get trace_id for this message (if exists)
    let traceId: string | undefined;
    const { data: trace } = await supabase
      .from('llm_traces')
      .select('trace_id')
      .eq('message_id', messageId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (trace) {
      traceId = trace.trace_id;
    }

    // 6. Save judgments (async, don't block)
    if (validationResults.length > 0) {
      judgmentsService.saveRuleJudgments(messageId, validationResults, traceId).catch(err => {
        console.error('[EvaluateMessage] Error saving judgments:', err);
      });
    }

    // Return success with validation results
    return NextResponse.json({
      success: true,
      validationResults: validationResults.map(vr => ({
        validator: vr.validator,
        criterion: vr.criterion,
        passed: vr.result.passed,
        score: vr.result.score,
        message: vr.result.message,
      }))
    });

  } catch (error) {
    console.error('[EvaluateMessage] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Example usage from frontend:
 *
 * const response = await fetch('/api/evaluate-message', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     messageId: 'msg-id-123',
 *     domain: 'company_expert',
 *     retrievedSources: [
 *       { text: 'Company policy states...' },
 *       { text: 'PTO guidelines...' }
 *     ]
 *   })
 * });
 *
 * const result = await response.json();
 * if (result.success) {
 *   console.log('Evaluation complete:', result.validationResults);
 * } else {
 *   console.error('Evaluation failed:', result.errors);
 * }
 */
