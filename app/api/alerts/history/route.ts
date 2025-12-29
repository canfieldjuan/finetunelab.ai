/**
 * Alert History API
 * GET /api/alerts/history - Get user alert history
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAlertService } from '@/lib/alerts';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function getAuthenticatedUser(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { user: null, error: 'Server configuration error' };
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { user: null, error: 'Unauthorized' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: 'Unauthorized' };
  }

  return { user, error: null };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { user, error } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    const alertService = getAlertService();
    const { alerts, total } = await alertService.getAlertHistory(user.id, limit, offset);

    return NextResponse.json({
      alerts,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[AlertHistoryAPI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch alert history' },
      { status: 500 }
    );
  }
}
