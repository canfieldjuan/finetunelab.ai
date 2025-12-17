/**
 * Alert Preferences API
 * GET /api/alerts/preferences - Get user preferences
 * PUT /api/alerts/preferences - Update user preferences
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

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  try {
    const alertService = getAlertService();
    const preferences = await alertService.getUserPreferences(user.id);

    return NextResponse.json({ preferences });
  } catch (err) {
    console.error('[AlertPreferencesAPI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const alertService = getAlertService();

    const allowedFields = [
      'email_enabled',
      'email_address',
      'alert_job_started',
      'alert_job_completed',
      'alert_job_failed',
      'alert_job_cancelled',
      'alert_batch_test_completed',
      'alert_batch_test_failed',
      'alert_scheduled_eval_completed',
      'alert_scheduled_eval_failed',
      'alert_scheduled_eval_disabled',
      'alert_scheduled_eval_regression',
      'alert_gpu_oom',
      'alert_disk_warning',
      'alert_timeout_warning',
      'daily_summary_enabled',
      'daily_summary_hour',
      'weekly_digest_enabled',
      'weekly_digest_day',
      'quiet_hours_enabled',
      'quiet_hours_start',
      'quiet_hours_end',
      'timezone',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    const preferences = await alertService.upsertPreferences(user.id, updates);

    if (!preferences) {
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ preferences });
  } catch (err) {
    console.error('[AlertPreferencesAPI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
