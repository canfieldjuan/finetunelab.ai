/**
 * Test Suites API
 * CRUD operations for test prompt suites (separate from training datasets)
 * Date: 2025-11-25
 * Updated: 2025-12-13 - Added API key auth for SDK access
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope, extractApiKeyFromHeaders } from '@/lib/auth/api-key-validator';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const API_KEY_PREFIX = 'wak_';

/**
 * Authenticate request - supports both session tokens (UI) and API keys (SDK)
 */
async function authenticateTestSuites(req: NextRequest): Promise<
  | { ok: true; userId: string; mode: 'session' | 'apiKey' }
  | { ok: false; status: number; error: string }
> {
  const headerApiKey = req.headers.get('x-api-key') || req.headers.get('x-workspace-api-key');
  const authHeader = req.headers.get('authorization');

  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const bearerValue = bearerMatch?.[1]?.trim() || null;
  const apiKeyInAuthorization = !!(bearerValue && bearerValue.startsWith(API_KEY_PREFIX));

  // Path 1: API Key Authentication
  if (headerApiKey || apiKeyInAuthorization) {
    const validation = await validateRequestWithScope(req.headers, 'testing');
    if (!validation.isValid || !validation.userId) {
      return {
        ok: false,
        status: validation.scopeError ? 403 : (validation.rateLimitExceeded ? 429 : 401),
        error: validation.errorMessage || 'Unauthorized',
      };
    }

    const extracted = extractApiKeyFromHeaders(req.headers);
    if (!extracted || !extracted.startsWith(API_KEY_PREFIX)) {
      return { ok: false, status: 401, error: 'Invalid API key format' };
    }

    return { ok: true, userId: validation.userId, mode: 'apiKey' };
  }

  // Path 2: Session Token Authentication
  if (!authHeader) {
    return { ok: false, status: 401, error: 'Missing authorization header' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: 'Authentication failed' };
  }

  return { ok: true, userId: user.id, mode: 'session' };
}

/**
 * GET /api/test-suites
 * List all test suites for the authenticated user
 * Auth: Session token or API key with 'testing' scope
 */
export async function GET(request: NextRequest) {
  console.log('[TestSuitesAPI] GET - Fetching test suites');

  try {
    const authResult = await authenticateTestSuites(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const userId = authResult.userId;
    console.log('[TestSuitesAPI] User authenticated:', userId, 'mode:', authResult.mode);

    // Use service role for API key auth, or session for UI
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('test_suites')
      .select('id, name, description, prompt_count, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[TestSuitesAPI] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[TestSuitesAPI] Found', data.length, 'test suites');

    return NextResponse.json({
      success: true,
      testSuites: data,
      count: data.length,
    });

  } catch (error) {
    console.error('[TestSuitesAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/test-suites
 * Create a new test suite from uploaded prompts
 * Accepts: { name, description?, prompts: string[], expected_answers?: string[] }
 * Auth: Session token or API key with 'testing' scope
 */
export async function POST(request: NextRequest) {
  console.log('[TestSuitesAPI] POST - Creating test suite');

  try {
    const authResult = await authenticateTestSuites(request);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const userId = authResult.userId;
    console.log('[TestSuitesAPI] User authenticated:', userId, 'mode:', authResult.mode);

    const body = await request.json();
    const { name, description, prompts, expected_answers } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json({ error: 'Prompts array is required' }, { status: 400 });
    }

    // Filter out empty prompts
    const cleanedPrompts = prompts
      .map((p: any) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p: string) => p.length > 0);

    if (cleanedPrompts.length === 0) {
      return NextResponse.json({ error: 'No valid prompts found' }, { status: 400 });
    }

    // Process expected_answers if provided
    let cleanedExpectedAnswers: string[] | undefined;
    if (expected_answers && Array.isArray(expected_answers)) {
      cleanedExpectedAnswers = expected_answers
        .map((a: any) => (typeof a === 'string' ? a.trim() : ''))
        .filter((a: string) => a.length > 0);

      // Validate that expected_answers length matches prompts length
      if (cleanedExpectedAnswers.length !== cleanedPrompts.length) {
        return NextResponse.json({
          error: `Expected answers count (${cleanedExpectedAnswers.length}) must match prompts count (${cleanedPrompts.length})`
        }, { status: 400 });
      }
    }

    console.log('[TestSuitesAPI] Creating suite:', {
      name,
      promptCount: cleanedPrompts.length,
      hasExpectedAnswers: !!cleanedExpectedAnswers
    });

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('test_suites')
      .insert({
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || null,
        prompts: cleanedPrompts,
        expected_answers: cleanedExpectedAnswers || [],
        prompt_count: cleanedPrompts.length,
      })
      .select()
      .single();

    if (error) {
      console.error('[TestSuitesAPI] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[TestSuitesAPI] Created test suite:', data.id);

    return NextResponse.json({
      success: true,
      testSuite: {
        id: data.id,
        name: data.name,
        description: data.description,
        prompt_count: data.prompt_count,
        has_expected_answers: cleanedExpectedAnswers && cleanedExpectedAnswers.length > 0,
        created_at: data.created_at,
      },
    });

  } catch (error) {
    console.error('[TestSuitesAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

console.log('[TestSuitesAPI] Module loaded');
