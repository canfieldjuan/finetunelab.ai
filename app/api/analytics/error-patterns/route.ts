/**
 * Error Patterns Analytics API
 *
 * Analyzes error patterns from LLM traces:
 * - Error distribution by category
 * - Error counts and percentages
 * - Affected providers per error type
 * - Suggested remediation actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';
import { detectErrorPatterns } from '@/lib/tracing/error-categorizer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY_PREFIX = 'wak_';

interface TraceRecord {
  error_category?: string | null;
  error_message?: string | null;
  model_provider?: string | null;
  duration_ms?: number | null;
  status?: string | null;
  operation_type?: string | null;
}

/**
 * GET - Retrieve error pattern analytics
 */
export async function GET(req: NextRequest) {
  try {
    let userId: string | null = null;
    let supabase = null as unknown as ReturnType<typeof createClient>;

    const headerApiKey = req.headers.get('x-api-key') || req.headers.get('x-workspace-api-key');
    const authHeader = req.headers.get('authorization');

    if (headerApiKey) {
      if (!supabaseServiceKey) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      const validation = await validateRequestWithScope(req.headers, 'production');
      if (!validation.isValid || !validation.userId) {
        return NextResponse.json(
          { error: validation.errorMessage || 'Unauthorized' },
          { status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401) }
        );
      }
      userId = validation.userId;
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    } else if (authHeader) {
      const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
      const bearerValue = bearerMatch?.[1]?.trim();

      if (bearerValue?.startsWith(API_KEY_PREFIX)) {
        if (!supabaseServiceKey) {
          return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        const validation = await validateRequestWithScope(req.headers, 'production');
        if (!validation.isValid || !validation.userId) {
          return NextResponse.json(
            { error: validation.errorMessage || 'Unauthorized' },
            { status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401) }
          );
        }
        userId = validation.userId;
        supabase = createClient(supabaseUrl, supabaseServiceKey);
      } else {
        supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 });
        }
        userId = user.id;
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('timeRange') || '7d';

    const now = new Date();
    const startDate = new Date(now);
    if (timeRange === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (timeRange === '90d') {
      startDate.setDate(now.getDate() - 90);
    }

    const { data: traces, error } = await supabase
      .from('llm_traces')
      .select('error_category, error_message, model_provider, duration_ms, status, operation_type')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .eq('status', 'failed');

    if (error) {
      console.error('[Error Patterns API] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve error patterns' },
        { status: 500 }
      );
    }

    const patterns = detectErrorPatterns((traces as TraceRecord[]) || []);

    const totalErrors = traces?.length || 0;

    const operationStats = new Map<string, number>();
    for (const trace of (traces as TraceRecord[]) || []) {
      if (trace.operation_type) {
        const count = operationStats.get(trace.operation_type) || 0;
        operationStats.set(trace.operation_type, count + 1);
      }
    }

    const mostAffectedOperations = Array.from(operationStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([operation, count]) => ({
        operation,
        count,
        percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0,
      }));

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalErrors,
        patterns,
        mostAffectedOperations,
      }
    });

  } catch (error) {
    console.error('[Error Patterns API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
