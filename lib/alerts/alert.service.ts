/**
 * Alert Service - Core Dispatcher
 * Handles alert routing, preference checking, and delivery
 * Date: 2025-12-12
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AlertPayload,
  AlertDeliveryResult,
  IntegrationDeliveryResult,
  UserAlertPreferences,
  UserWebhook,
  TrainingJobAlertData,
  BatchTestAlertData,
  AlertType,
} from './alert.types';
import { emailChannel } from './channels/email.channel';
import { webhookChannel } from './channels/webhook.channel';
import { integrationChannel } from './channels/integration.channel';
import type { UserIntegration } from '@/lib/integrations/integration.types';

const DEFAULT_PREFERENCES: Omit<UserAlertPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  email_enabled: true,
  email_address: null,
  alert_job_started: false,
  alert_job_completed: true,
  alert_job_failed: true,
  alert_job_cancelled: false,
  alert_batch_test_completed: false,
  alert_batch_test_failed: true,
  alert_gpu_oom: true,
  alert_disk_warning: true,
  alert_timeout_warning: true,
  daily_summary_enabled: false,
  daily_summary_hour: 9,
  weekly_digest_enabled: false,
  weekly_digest_day: 1,
  quiet_hours_enabled: false,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  timezone: 'UTC',
};

export class AlertService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('[AlertService] Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async sendAlert(alert: AlertPayload): Promise<{
    emailResult?: AlertDeliveryResult;
    webhookResults: AlertDeliveryResult[];
    integrationResults: IntegrationDeliveryResult[];
  }> {
    console.log('[AlertService] Processing alert:', alert.type, 'for user:', alert.userId);

    const preferences = await this.getUserPreferences(alert.userId);
    const webhooks = await this.getUserWebhooks(alert.userId);
    const integrations = await this.getUserIntegrations(alert.userId);

    const results: {
      emailResult?: AlertDeliveryResult;
      webhookResults: AlertDeliveryResult[];
      integrationResults: IntegrationDeliveryResult[];
    } = {
      webhookResults: [],
      integrationResults: [],
    };

    const emailResult = await emailChannel.send(alert, preferences);
    results.emailResult = emailResult;

    for (const webhook of webhooks) {
      const webhookResult = await webhookChannel.send(alert, preferences, webhook);
      results.webhookResults.push(webhookResult);

      await this.logAlertHistory(alert, emailResult, webhookResult, webhook.id);
    }

    // Send to third-party integrations (Notion, Teams, Telegram, PagerDuty)
    if (integrations.length > 0) {
      const integrationResults = await integrationChannel.sendToAll(alert, integrations);
      results.integrationResults = integrationResults;
    }

    if (webhooks.length === 0 && integrations.length === 0 && emailResult) {
      await this.logAlertHistory(alert, emailResult, undefined, undefined);
    }

    console.log('[AlertService] Alert processed:', {
      email: emailResult?.success,
      webhooks: results.webhookResults.map(r => r.success),
      integrations: results.integrationResults.map(r => `${r.integrationType}:${r.success}`),
    });

    return results;
  }

  async sendTrainingJobAlert(
    type: AlertType,
    jobData: TrainingJobAlertData
  ): Promise<void> {
    const titleMap: Record<string, string> = {
      job_started: `Training Started: ${jobData.modelName || 'Job'}`,
      job_completed: `Training Complete: ${jobData.modelName || 'Job'}`,
      job_failed: `Training Failed: ${jobData.modelName || 'Job'}`,
      job_cancelled: `Training Cancelled: ${jobData.modelName || 'Job'}`,
      gpu_oom: `GPU OOM: ${jobData.modelName || 'Job'}`,
      timeout_warning: `Timeout Warning: ${jobData.modelName || 'Job'}`,
    };

    const messageMap: Record<string, string> = {
      job_started: `Your training job has started.`,
      job_completed: `Your training job completed successfully.`,
      job_failed: `Your training job failed. ${jobData.errorMessage || ''}`.trim(),
      job_cancelled: `Your training job was cancelled.`,
      gpu_oom: `GPU out of memory detected during training.`,
      timeout_warning: `No progress detected for an extended period.`,
    };

    const alert: AlertPayload = {
      type,
      userId: jobData.userId,
      title: titleMap[type] || `Training Alert: ${type}`,
      message: messageMap[type] || '',
      metadata: jobData,
      jobId: jobData.jobId,
    };

    await this.sendAlert(alert);
  }

  async sendBatchTestAlert(
    type: AlertType,
    testData: BatchTestAlertData
  ): Promise<void> {
    const titleMap: Record<string, string> = {
      batch_test_completed: `Test Run Complete: ${testData.modelName || 'Model'}`,
      batch_test_failed: `Test Run Failed: ${testData.modelName || 'Model'}`,
    };

    const messageMap: Record<string, string> = {
      batch_test_completed: `Your batch test run completed successfully.`,
      batch_test_failed: `Your batch test run failed. ${testData.errorMessage || ''}`.trim(),
    };

    const alert: AlertPayload = {
      type,
      userId: testData.userId,
      title: titleMap[type] || `Batch Test Alert: ${type}`,
      message: messageMap[type] || '',
      metadata: testData,
    };

    await this.sendAlert(alert);
  }

  async getUserPreferences(userId: string): Promise<UserAlertPreferences> {
    const { data, error } = await this.supabase
      .from('user_alert_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.log('[AlertService] No preferences found, using defaults for user:', userId);
      return {
        id: '',
        user_id: userId,
        ...DEFAULT_PREFERENCES,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data as UserAlertPreferences;
  }

  async getUserWebhooks(userId: string): Promise<UserWebhook[]> {
    const { data, error } = await this.supabase
      .from('user_webhooks')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (error) {
      console.error('[AlertService] Error fetching webhooks:', error.message);
      return [];
    }

    return (data || []) as UserWebhook[];
  }

  async getUserIntegrations(userId: string): Promise<UserIntegration[]> {
    const { data, error } = await this.supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (error) {
      console.error('[AlertService] Error fetching integrations:', error.message);
      return [];
    }

    return (data || []) as UserIntegration[];
  }

  async upsertPreferences(
    userId: string,
    preferences: Partial<UserAlertPreferences>
  ): Promise<UserAlertPreferences | null> {
    const { data, error } = await this.supabase
      .from('user_alert_preferences')
      .upsert(
        {
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[AlertService] Error upserting preferences:', error.message);
      return null;
    }

    return data as UserAlertPreferences;
  }

  async createWebhook(
    userId: string,
    webhook: Omit<UserWebhook, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_success_at' | 'last_failure_at' | 'failure_count'>
  ): Promise<UserWebhook | null> {
    const { data, error } = await this.supabase
      .from('user_webhooks')
      .insert({
        user_id: userId,
        ...webhook,
      })
      .select()
      .single();

    if (error) {
      console.error('[AlertService] Error creating webhook:', error.message);
      return null;
    }

    return data as UserWebhook;
  }

  async updateWebhook(
    webhookId: string,
    userId: string,
    updates: Partial<UserWebhook>
  ): Promise<UserWebhook | null> {
    const { data, error } = await this.supabase
      .from('user_webhooks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', webhookId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[AlertService] Error updating webhook:', error.message);
      return null;
    }

    return data as UserWebhook;
  }

  async deleteWebhook(webhookId: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('user_webhooks')
      .delete()
      .eq('id', webhookId)
      .eq('user_id', userId);

    if (error) {
      console.error('[AlertService] Error deleting webhook:', error.message);
      return false;
    }

    return true;
  }

  async getAlertHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ alerts: unknown[]; total: number }> {
    const { data, error, count } = await this.supabase
      .from('alert_history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[AlertService] Error fetching history:', error.message);
      return { alerts: [], total: 0 };
    }

    return { alerts: data || [], total: count || 0 };
  }

  private async logAlertHistory(
    alert: AlertPayload,
    emailResult?: AlertDeliveryResult,
    webhookResult?: AlertDeliveryResult,
    webhookId?: string
  ): Promise<void> {
    try {
      await this.supabase.from('alert_history').insert({
        user_id: alert.userId,
        alert_type: alert.type,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata || {},
        job_id: alert.jobId || null,
        email_sent: emailResult?.success || false,
        email_sent_at: emailResult?.success ? new Date().toISOString() : null,
        email_message_id: emailResult?.messageId || null,
        email_error: emailResult?.error || null,
        webhook_sent: webhookResult?.success || false,
        webhook_sent_at: webhookResult?.success ? new Date().toISOString() : null,
        webhook_id: webhookId || null,
        webhook_status_code: webhookResult?.statusCode || null,
        webhook_error: webhookResult?.error || null,
      });
    } catch (err) {
      console.error('[AlertService] Failed to log alert history:', err);
    }
  }
}

let alertServiceInstance: AlertService | null = null;

export function getAlertService(): AlertService {
  if (!alertServiceInstance) {
    alertServiceInstance = new AlertService();
  }
  return alertServiceInstance;
}

export async function sendTrainingJobAlert(
  type: AlertType,
  jobData: TrainingJobAlertData
): Promise<void> {
  const service = getAlertService();
  await service.sendTrainingJobAlert(type, jobData);
}

export async function sendBatchTestAlert(
  type: AlertType,
  testData: BatchTestAlertData
): Promise<void> {
  const service = getAlertService();
  await service.sendBatchTestAlert(type, testData);
}
