/**
 * Webhooks API
 * GET /api/alerts/webhooks - List user webhooks
 * POST /api/alerts/webhooks - Create webhook
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAlertService, WebhookType } from '@/lib/alerts';

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

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  try {
    const alertService = getAlertService();
    const webhooks = await alertService.getUserWebhooks(user.id);

    const sanitized = webhooks.map(w => ({
      ...w,
      secret: w.secret ? '********' : null,
    }));

    return NextResponse.json({ webhooks: sanitized });
  } catch (err) {
    console.error('[WebhooksAPI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!body.url || !isValidUrl(body.url)) {
      return NextResponse.json({ error: 'Valid URL is required' }, { status: 400 });
    }

    const validTypes: WebhookType[] = ['slack', 'discord', 'generic'];
    const webhookType = validTypes.includes(body.webhook_type)
      ? body.webhook_type
      : 'generic';

    const alertService = getAlertService();
    const webhook = await alertService.createWebhook(user.id, {
      name: body.name.slice(0, 100),
      url: body.url,
      webhook_type: webhookType,
      secret: body.secret || null,
      alert_job_started: body.alert_job_started ?? false,
      alert_job_completed: body.alert_job_completed ?? true,
      alert_job_failed: body.alert_job_failed ?? true,
      alert_job_cancelled: body.alert_job_cancelled ?? false,
      alert_batch_test_completed: body.alert_batch_test_completed ?? false,
      alert_batch_test_failed: body.alert_batch_test_failed ?? true,
      alert_gpu_oom: body.alert_gpu_oom ?? true,
      alert_disk_warning: body.alert_disk_warning ?? true,
      alert_timeout_warning: body.alert_timeout_warning ?? true,
      enabled: body.enabled ?? true,
    });

    if (!webhook) {
      return NextResponse.json(
        { error: 'Failed to create webhook' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      webhook: { ...webhook, secret: webhook.secret ? '********' : null },
    }, { status: 201 });
  } catch (err) {
    console.error('[WebhooksAPI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}
