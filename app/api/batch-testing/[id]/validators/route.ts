// GET /api/batch-testing/[id]/validators - Get validator breakdown for a batch test run
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope, extractApiKeyFromHeaders } from '@/lib/auth/api-key-validator';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const API_KEY_PREFIX = 'wak_';

async function authenticateBatchTesting(request: NextRequest): Promise<
  | { ok: true; userId: string; mode: 'session' | 'apiKey'; authorizationHeader?: string }
  | { ok: false; status: number; error: string }
> {
  const headerApiKey = request.headers.get('x-api-key') || request.headers.get('x-workspace-api-key');
  const authHeader = request.headers.get('authorization');

  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const bearerValue = bearerMatch?.[1]?.trim() || null;
  const apiKeyInAuthorization = !!(bearerValue && bearerValue.startsWith(API_KEY_PREFIX));

  if (headerApiKey || apiKeyInAuthorization) {
    const validation = await validateRequestWithScope(request.headers, 'testing');
    if (!validation.isValid || !validation.userId) {
      return {
        ok: false,
        status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401),
        error: validation.errorMessage || 'Unauthorized',
      };
    }

    const extracted = extractApiKeyFromHeaders(request.headers);
    if (!extracted || !extracted.startsWith(API_KEY_PREFIX)) {
      return { ok: false, status: 401, error: 'Invalid API key' };
    }

    return { ok: true, userId: validation.userId, mode: 'apiKey' };
  }

  if (!authHeader) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  return { ok: true, userId: user.id, mode: 'session', authorizationHeader: authHeader };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: testRunId } = await params;

    const auth = await authenticateBatchTesting(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Always enforce ownership at the batch_test_runs level.
    const authClient =
      auth.mode === 'apiKey'
        ? createClient(supabaseUrl, supabaseServiceKey)
        : createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: auth.authorizationHeader! } },
          });

    const { data: run, error: runError } = await authClient
      .from('batch_test_runs')
      .select('id')
      .eq('id', testRunId)
      .eq('user_id', auth.userId)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: 'Batch test run not found' }, { status: 404 });
    }

    // 1. Get all conversations for this batch test run
    const { data: conversations, error: convError } = await authClient
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
    const { data: messages, error: messagesError } = await authClient
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
    const { data: judgments, error: judgementsError } = await authClient
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
