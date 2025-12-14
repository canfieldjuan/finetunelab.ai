/**
 * Integration Test API
 * POST /api/integrations/[type]/test - Test integration connection
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { integrationService } from '@/lib/integrations/integration.service';
import { IntegrationType, INTEGRATION_METADATA, NotionCredentials } from '@/lib/integrations/integration.types';

export const runtime = 'nodejs';

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await params;

  if (!INTEGRATION_METADATA[type as IntegrationType]) {
    return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 });
  }

  try {
    let credentials;

    // Try to get credentials from request body first
    try {
      const body = await request.json();
      credentials = body.credentials;
    } catch {
      // No body provided, will fetch from database
    }

    // If no credentials provided, fetch from database (for saved integrations)
    if (!credentials) {
      const integration = await integrationService.getIntegration(user.id, type as IntegrationType);
      if (!integration) {
        return NextResponse.json({ error: 'Integration not found. Please configure it first.' }, { status: 404 });
      }
      credentials = integration.credentials;
    }

    // Test based on integration type
    switch (type) {
      case 'notion': {
        if (!credentials?.api_key || !credentials?.database_id) {
          return NextResponse.json({ error: 'API key and database ID required' }, { status: 400 });
        }

        const result = await integrationService.testNotionIntegration(credentials as NotionCredentials);
        return NextResponse.json(result);
      }

      case 'teams': {
        if (!credentials?.webhook_url) {
          return NextResponse.json({ error: 'Webhook URL required' }, { status: 400 });
        }

        // Test Teams webhook by sending a test message
        try {
          const response = await fetch(credentials.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              '@type': 'MessageCard',
              '@context': 'http://schema.org/extensions',
              themeColor: '0076D7',
              summary: 'Test Alert',
              sections: [{
                activityTitle: 'Integration Test',
                activitySubtitle: 'This is a test message from FineTune Lab',
                markdown: true,
              }],
            }),
          });

          if (response.ok) {
            return NextResponse.json({ success: true });
          }
          return NextResponse.json({ success: false, error: `Teams webhook failed: ${response.status}` });
        } catch (err) {
          return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Connection failed',
          });
        }
      }

      case 'telegram': {
        if (!credentials?.bot_token || !credentials?.chat_id) {
          return NextResponse.json({ error: 'Bot token and chat ID required' }, { status: 400 });
        }

        try {
          const response = await fetch(
            `https://api.telegram.org/bot${credentials.bot_token}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: credentials.chat_id,
                text: '✅ *Integration Test*\n\nThis is a test message from FineTune Lab.',
                parse_mode: 'Markdown',
              }),
            }
          );

          const data = await response.json();

          if (data.ok) {
            return NextResponse.json({ success: true });
          }
          return NextResponse.json({
            success: false,
            error: data.description || 'Telegram API error',
          });
        } catch (err) {
          return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Connection failed',
          });
        }
      }

      case 'pagerduty': {
        if (!credentials?.routing_key) {
          return NextResponse.json({ error: 'Routing key required' }, { status: 400 });
        }

        // Test PagerDuty by sending a test event (acknowledge type so it doesn't create incident)
        try {
          const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              routing_key: credentials.routing_key,
              event_action: 'trigger',
              dedup_key: 'finetune-lab-test-' + Date.now(),
              payload: {
                summary: 'FineTune Lab Integration Test',
                severity: 'info',
                source: 'FineTune Lab',
              },
            }),
          });

          const data = await response.json();

          if (data.status === 'success') {
            return NextResponse.json({ success: true });
          }
          return NextResponse.json({
            success: false,
            error: data.message || 'PagerDuty API error',
          });
        } catch (err) {
          return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Connection failed',
          });
        }
      }

      default:
        return NextResponse.json({ error: 'Test not implemented for this integration type' }, { status: 400 });
    }
  } catch (err) {
    console.error('[IntegrationTestAPI] Error:', err);
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
}
