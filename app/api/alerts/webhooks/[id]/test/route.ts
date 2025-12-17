/**
 * Test Webhook API
 * POST /api/alerts/webhooks/[id]/test - Send test alert to webhook
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { webhookChannel, UserAlertPreferences, UserWebhook, AlertPayload } from '@/lib/alerts';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const supabase = createClient(
      supabaseUrl!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: webhook, error: fetchError } = await supabase
      .from('user_webhooks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const testAlert: AlertPayload = {
      type: 'job_completed',
      userId: user.id,
      title: 'Test Alert',
      message: 'This is a test alert from your training platform.',
      metadata: {
        jobId: 'test-job-123',
        userId: user.id,
        modelName: 'test-model',
        baseModel: 'mistralai/Mistral-7B',
        status: 'completed',
        progress: 100,
        currentStep: 1000,
        totalSteps: 1000,
        loss: 0.342,
        duration: 3600000,
        errorMessage: null,
        errorType: null,
      },
      jobId: 'test-job-123',
    };

    const dummyPrefs: UserAlertPreferences = {
      id: '',
      user_id: user.id,
      email_enabled: false,
      email_address: null,
      alert_job_started: true,
      alert_job_completed: true,
      alert_job_failed: true,
      alert_job_cancelled: true,
      alert_gpu_oom: true,
      alert_disk_warning: true,
      alert_timeout_warning: true,
      alert_batch_test_completed: true,
      alert_batch_test_failed: true,
      alert_scheduled_eval_completed: true,
      alert_scheduled_eval_failed: true,
      alert_scheduled_eval_disabled: true,
      alert_scheduled_eval_regression: true,
      daily_summary_enabled: false,
      daily_summary_hour: 9,
      weekly_digest_enabled: false,
      weekly_digest_day: 1,
      quiet_hours_enabled: false,
      quiet_hours_start: 22,
      quiet_hours_end: 8,
      timezone: 'UTC',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const testWebhook: UserWebhook = {
      ...webhook,
      enabled: true,
      alert_job_completed: true,
    };

    const result = await webhookChannel.send(testAlert, dummyPrefs, testWebhook);

    return NextResponse.json({
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
    });
  } catch (err) {
    console.error('[WebhookTestAPI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    );
  }
}
