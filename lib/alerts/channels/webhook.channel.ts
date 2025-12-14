/**
 * Webhook Alert Channel
 * Supports Slack, Discord, and generic webhooks
 * Date: 2025-12-12
 */

import crypto from 'crypto';
import {
  AlertPayload,
  AlertDeliveryResult,
  AlertChannel,
  UserAlertPreferences,
  UserWebhook,
  alertTypeToWebhookKey,
  getAlertConfig,
  WebhookPayload,
} from '../alert.types';
import { formatSlackAlert } from '../formatters/slack.formatter';
import { formatDiscordAlert } from '../formatters/discord.formatter';

export class WebhookChannel implements AlertChannel {
  async send(
    alert: AlertPayload,
    _preferences: UserAlertPreferences,
    webhook?: UserWebhook
  ): Promise<AlertDeliveryResult> {
    if (!webhook) {
      return { success: false, channel: 'webhook', error: 'No webhook provided' };
    }

    if (!webhook.enabled) {
      console.log('[WebhookChannel] Webhook disabled:', webhook.name);
      return { success: false, channel: 'webhook', error: 'Webhook disabled' };
    }

    const prefKey = alertTypeToWebhookKey(alert.type);
    if (prefKey && !webhook[prefKey]) {
      console.log('[WebhookChannel] Alert type disabled for webhook:', alert.type);
      return { success: false, channel: 'webhook', error: `Alert type ${alert.type} disabled` };
    }

    console.log('[WebhookChannel] Sending to webhook:', webhook.name, webhook.webhook_type);

    const payload = this.formatPayload(alert, webhook.webhook_type);
    const config = getAlertConfig();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.webhookTimeoutMs);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'AlertService/1.0',
      };

      if (webhook.secret) {
        const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log('[WebhookChannel] Sent successfully:', response.status);
        await this.updateWebhookStatus(webhook.id, true);
        return {
          success: true,
          channel: 'webhook',
          statusCode: response.status,
        };
      }

      const errorBody = await response.text().catch(() => '');
      console.error('[WebhookChannel] Failed:', response.status, errorBody.slice(0, 200));
      await this.updateWebhookStatus(webhook.id, false);

      return {
        success: false,
        channel: 'webhook',
        statusCode: response.status,
        error: `HTTP ${response.status}: ${errorBody.slice(0, 100)}`,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[WebhookChannel] Exception:', errorMsg);
      await this.updateWebhookStatus(webhook.id, false);

      return {
        success: false,
        channel: 'webhook',
        error: errorMsg,
      };
    }
  }

  private formatPayload(
    alert: AlertPayload,
    webhookType: string
  ): WebhookPayload | Record<string, unknown> {
    switch (webhookType) {
      case 'slack':
        return formatSlackAlert(alert);
      case 'discord':
        return formatDiscordAlert(alert);
      default:
        return {
          type: alert.type,
          title: alert.title,
          message: alert.message,
          timestamp: new Date().toISOString(),
          metadata: alert.metadata || {},
          jobId: alert.jobId,
        };
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  private async updateWebhookStatus(webhookId: string, success: boolean): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) return;

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const now = new Date().toISOString();

      if (success) {
        await supabase
          .from('user_webhooks')
          .update({
            last_success_at: now,
            failure_count: 0,
          })
          .eq('id', webhookId);
      } else {
        await supabase.rpc('increment_webhook_failure', { webhook_id: webhookId });
      }
    } catch (err) {
      console.error('[WebhookChannel] Failed to update webhook status:', err);
    }
  }
}

export const webhookChannel = new WebhookChannel();
