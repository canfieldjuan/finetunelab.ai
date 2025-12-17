/**
 * Individual Webhook API
 * GET /api/alerts/webhooks/[id] - Get webhook
 * PUT /api/alerts/webhooks/[id] - Update webhook
 * DELETE /api/alerts/webhooks/[id] - Delete webhook
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

export async function GET(
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

    return NextResponse.json({
      webhook: { ...webhook, secret: webhook.secret ? '********' : null },
    });
  } catch (err) {
    console.error('[WebhookAPI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch webhook' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updates.name = String(body.name).slice(0, 100);
    }

    if (body.url !== undefined) {
      if (!isValidUrl(body.url)) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }
      updates.url = body.url;
    }

    if (body.webhook_type !== undefined) {
      const validTypes: WebhookType[] = ['slack', 'discord', 'generic'];
      if (validTypes.includes(body.webhook_type)) {
        updates.webhook_type = body.webhook_type;
      }
    }

    if (body.secret !== undefined) {
      updates.secret = body.secret || null;
    }

    const booleanFields = [
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
      'enabled',
    ];

    for (const field of booleanFields) {
      if (body[field] !== undefined) {
        updates[field] = Boolean(body[field]);
      }
    }

    const alertService = getAlertService();
    const webhook = await alertService.updateWebhook(id, user.id, updates);

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      webhook: { ...webhook, secret: webhook.secret ? '********' : null },
    });
  } catch (err) {
    console.error('[WebhookAPI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const alertService = getAlertService();
    const success = await alertService.deleteWebhook(id, user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Webhook not found or delete failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[WebhookAPI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
