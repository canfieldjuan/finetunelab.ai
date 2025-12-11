// GET /api/batch-testing/[id]/validators - Get validator breakdown for a batch test run
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: testRunId } = await params;

    // 1. Get all conversations for this batch test run
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('batch_test_run_id', testRunId);

    if (convError) {
      console.error('[ValidatorBreakdown] Error fetching conversations:', convError);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        success: true,
        validators: [],
        total_messages: 0
      });
    }

    const conversationIds = conversations.map(c => c.id);

    // 2. Get all messages for these conversations
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id')
      .in('conversation_id', conversationIds);

    if (messagesError) {
      console.error('[ValidatorBreakdown] Error fetching messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        validators: [],
        total_messages: 0
      });
    }

    const messageIds = messages.map(m => m.id);

    // 2. Get all judgments for these messages (excluding 'basic' judge_type)
    const { data: judgments, error: judgementsError } = await supabase
      .from('judgments')
      .select('judge_name, judge_type, criterion, passed, message_id')
      .in('message_id', messageIds)
      .neq('judge_type', 'basic'); // Exclude basic quality judgments

    if (judgementsError) {
      console.error('[ValidatorBreakdown] Error fetching judgments:', judgementsError);
      return NextResponse.json(
        { error: 'Failed to fetch judgments' },
        { status: 500 }
      );
    }

    if (!judgments || judgments.length === 0) {
      return NextResponse.json({
        success: true,
        validators: [],
        total_messages: messages.length
      });
    }

    // 3. Group by judge_name and calculate stats
    const validatorStats: Record<string, {
      judge_name: string;
      judge_type: string;
      total: number;
      passed: number;
      failed: number;
      pass_rate: number;
      criteria: Record<string, { total: number; passed: number; failed: number }>;
    }> = {};

    judgments.forEach(judgment => {
      if (!validatorStats[judgment.judge_name]) {
        validatorStats[judgment.judge_name] = {
          judge_name: judgment.judge_name,
          judge_type: judgment.judge_type,
          total: 0,
          passed: 0,
          failed: 0,
          pass_rate: 0,
          criteria: {}
        };
      }

      const stats = validatorStats[judgment.judge_name];
      stats.total += 1;

      if (judgment.passed) {
        stats.passed += 1;
      } else {
        stats.failed += 1;
      }

      // Track per-criterion stats
      if (judgment.criterion) {
        if (!stats.criteria[judgment.criterion]) {
          stats.criteria[judgment.criterion] = { total: 0, passed: 0, failed: 0 };
        }
        stats.criteria[judgment.criterion].total += 1;
        if (judgment.passed) {
          stats.criteria[judgment.criterion].passed += 1;
        } else {
          stats.criteria[judgment.criterion].failed += 1;
        }
      }
    });

    // 4. Calculate pass rates
    const validators = Object.values(validatorStats).map(stats => ({
      ...stats,
      pass_rate: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0
    }));

    // 5. Sort by pass_rate (lowest first to highlight issues)
    validators.sort((a, b) => a.pass_rate - b.pass_rate);

    return NextResponse.json({
      success: true,
      validators,
      total_messages: messages.length
    });

  } catch (error) {
    console.error('[ValidatorBreakdown] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
