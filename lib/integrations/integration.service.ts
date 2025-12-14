/**
 * Integration Service
 * Handles CRUD operations and event logging for integrations
 * Date: 2025-12-12
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserIntegration,
  UserIntegrationDisplay,
  IntegrationType,
  IntegrationCredentials,
  IntegrationConfig,
  NotionCredentials,
  TeamsCredentials,
  TelegramCredentials,
  PagerDutyCredentials,
  DEFAULT_INTEGRATION_CONFIG,
} from './integration.types';

class IntegrationService {
  private supabase: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!url || !key) {
        throw new Error('Missing Supabase configuration');
      }

      this.supabase = createClient(url, key);
    }
    return this.supabase;
  }

  /**
   * Get all integrations for a user (with masked credentials)
   */
  async getUserIntegrations(userId: string): Promise<UserIntegrationDisplay[]> {
    const { data, error } = await this.getClient()
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[IntegrationService] Error fetching integrations:', error);
      throw new Error('Failed to fetch integrations');
    }

    return (data || []).map(this.toDisplayFormat);
  }

  /**
   * Get a specific integration (full data, for internal use)
   */
  async getIntegration(userId: string, integrationType: IntegrationType): Promise<UserIntegration | null> {
    const { data, error } = await this.getClient()
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('integration_type', integrationType)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[IntegrationService] Error fetching integration:', error);
      throw new Error('Failed to fetch integration');
    }

    return data || null;
  }

  /**
   * Create or update an integration
   */
  async upsertIntegration(
    userId: string,
    integrationType: IntegrationType,
    credentials: IntegrationCredentials,
    config?: IntegrationConfig,
    name?: string
  ): Promise<UserIntegrationDisplay> {
    const existing = await this.getIntegration(userId, integrationType);

    const integrationData = {
      user_id: userId,
      integration_type: integrationType,
      name: name || integrationType,
      credentials,
      config: config || existing?.config || DEFAULT_INTEGRATION_CONFIG,
      enabled: true,
      error_count: 0,
      last_error: null,
    };

    const { data, error } = existing
      ? await this.getClient()
          .from('user_integrations')
          .update(integrationData)
          .eq('id', existing.id)
          .select()
          .single()
      : await this.getClient()
          .from('user_integrations')
          .insert(integrationData)
          .select()
          .single();

    if (error) {
      console.error('[IntegrationService] Error upserting integration:', error);
      throw new Error('Failed to save integration');
    }

    return this.toDisplayFormat(data);
  }

  /**
   * Update integration config only
   */
  async updateConfig(
    userId: string,
    integrationType: IntegrationType,
    config: IntegrationConfig
  ): Promise<UserIntegrationDisplay> {
    const { data, error } = await this.getClient()
      .from('user_integrations')
      .update({ config })
      .eq('user_id', userId)
      .eq('integration_type', integrationType)
      .select()
      .single();

    if (error) {
      console.error('[IntegrationService] Error updating config:', error);
      throw new Error('Failed to update config');
    }

    return this.toDisplayFormat(data);
  }

  /**
   * Toggle integration enabled state
   */
  async toggleEnabled(userId: string, integrationType: IntegrationType, enabled: boolean): Promise<void> {
    const { error } = await this.getClient()
      .from('user_integrations')
      .update({ enabled })
      .eq('user_id', userId)
      .eq('integration_type', integrationType);

    if (error) {
      console.error('[IntegrationService] Error toggling enabled:', error);
      throw new Error('Failed to toggle integration');
    }
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(userId: string, integrationType: IntegrationType): Promise<void> {
    const { error } = await this.getClient()
      .from('user_integrations')
      .delete()
      .eq('user_id', userId)
      .eq('integration_type', integrationType);

    if (error) {
      console.error('[IntegrationService] Error deleting integration:', error);
      throw new Error('Failed to delete integration');
    }
  }

  /**
   * Test Notion integration by creating a test entry
   */
  async testNotionIntegration(credentials: NotionCredentials): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.notion.com/v1/databases/' + credentials.database_id, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.api_key}`,
          'Notion-Version': '2022-06-28',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        return {
          success: false,
          error: data.message || `Notion API error: ${response.status}`,
        };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  /**
   * Get Notion database schema to discover available properties
   */
  private async getNotionDatabaseSchema(
    credentials: NotionCredentials
  ): Promise<Record<string, { type: string; name: string }> | null> {
    try {
      const response = await fetch(
        `https://api.notion.com/v1/databases/${credentials.database_id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${credentials.api_key}`,
            'Notion-Version': '2022-06-28',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[IntegrationService] Failed to get Notion schema:', {
          status: response.status,
          error: errorData,
        });
        return null;
      }

      const data = await response.json();
      const schema: Record<string, { type: string; name: string }> = {};

      // Map property names to their types
      for (const [name, prop] of Object.entries(data.properties || {})) {
        const propData = prop as { type: string };
        schema[name.toLowerCase()] = { type: propData.type, name };
      }

      return schema;
    } catch (err) {
      console.error('[IntegrationService] Error fetching Notion schema:', err);
      return null;
    }
  }

  /**
   * Log an event to Notion
   * Dynamically adapts to the database schema - only sets properties that exist
   */
  async logToNotion(
    credentials: NotionCredentials,
    event: {
      type: string;
      title: string;
      jobId: string;
      modelName?: string;
      status: string;
      errorMessage?: string;
      duration?: string;
      loss?: number;
    }
  ): Promise<boolean> {
    try {
      // Get database schema to know which properties exist
      const schema = await this.getNotionDatabaseSchema(credentials);
      if (!schema) {
        console.error('[IntegrationService] Could not fetch Notion database schema');
        return false;
      }

      const properties: Record<string, unknown> = {};

      // Find the title property (every Notion DB has exactly one)
      const titleProp = Object.values(schema).find((p) => p.type === 'title');
      if (titleProp) {
        properties[titleProp.name] = {
          title: [{ text: { content: event.title } }],
        };
      }

      // Helper to add property if it exists in schema
      const addIfExists = (
        key: string,
        value: unknown,
        propType: 'select' | 'rich_text' | 'number'
      ) => {
        const prop = schema[key.toLowerCase()];
        if (!prop) return;

        // Only set if the property type matches what we're trying to set
        if (propType === 'select' && prop.type === 'select') {
          properties[prop.name] = { select: { name: value as string } };
        } else if (propType === 'rich_text' && prop.type === 'rich_text') {
          properties[prop.name] = {
            rich_text: [{ text: { content: String(value).slice(0, 2000) } }],
          };
        } else if (propType === 'number' && prop.type === 'number') {
          properties[prop.name] = { number: value as number };
        } else if (propType === 'rich_text' && prop.type === 'url') {
          // Allow rich_text content to go into url fields
          properties[prop.name] = { url: String(value) };
        }
      };

      // Try to set optional properties if they exist
      addIfExists('Type', event.type, 'select');
      addIfExists('Status', event.status, 'select');
      addIfExists('Job ID', event.jobId, 'rich_text');
      addIfExists('JobID', event.jobId, 'rich_text');
      addIfExists('Job', event.jobId, 'rich_text');
      addIfExists('Model', event.modelName || '', 'rich_text');
      addIfExists('Model Name', event.modelName || '', 'rich_text');

      if (event.errorMessage) {
        addIfExists('Error', event.errorMessage, 'rich_text');
        addIfExists('Error Message', event.errorMessage, 'rich_text');
      }

      if (event.duration) {
        addIfExists('Duration', event.duration, 'rich_text');
      }

      if (event.loss !== undefined) {
        addIfExists('Loss', event.loss, 'number');
        addIfExists('Final Loss', event.loss, 'number');
      }

      console.log('[IntegrationService] Notion properties to set:', Object.keys(properties));

      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.api_key}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: credentials.database_id },
          properties,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[IntegrationService] Notion log failed:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[IntegrationService] Notion log error:', err);
      return false;
    }
  }

  /**
   * Log an event to Microsoft Teams via webhook
   */
  async logToTeams(
    credentials: TeamsCredentials,
    event: {
      type: string;
      title: string;
      jobId: string;
      modelName?: string;
      status: string;
      errorMessage?: string;
      duration?: string;
      loss?: number;
    }
  ): Promise<boolean> {
    try {
      const color = this.getStatusColor(event.type);
      const facts = [
        { name: 'Job ID', value: event.jobId },
        { name: 'Status', value: event.status },
      ];

      if (event.modelName) {
        facts.push({ name: 'Model', value: event.modelName });
      }
      if (event.duration) {
        facts.push({ name: 'Duration', value: event.duration });
      }
      if (event.loss !== undefined) {
        facts.push({ name: 'Final Loss', value: event.loss.toFixed(4) });
      }
      if (event.errorMessage) {
        facts.push({ name: 'Error', value: event.errorMessage.slice(0, 500) });
      }

      const payload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: color,
        summary: event.title,
        sections: [
          {
            activityTitle: event.title,
            activitySubtitle: `Training Job ${event.type.replace('job_', '')}`,
            facts,
            markdown: true,
          },
        ],
      };

      const response = await fetch(credentials.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('[IntegrationService] Teams log failed:', response.status);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[IntegrationService] Teams log error:', err);
      return false;
    }
  }

  /**
   * Log an event to Telegram
   */
  async logToTelegram(
    credentials: TelegramCredentials,
    event: {
      type: string;
      title: string;
      jobId: string;
      modelName?: string;
      status: string;
      errorMessage?: string;
      duration?: string;
      loss?: number;
    }
  ): Promise<boolean> {
    try {
      const emoji = this.getStatusEmoji(event.type);
      let message = `${emoji} *${event.title}*\n\n`;
      message += `Job ID: \`${event.jobId}\`\n`;
      message += `Status: ${event.status}\n`;

      if (event.modelName) {
        message += `Model: ${event.modelName}\n`;
      }
      if (event.duration) {
        message += `Duration: ${event.duration}\n`;
      }
      if (event.loss !== undefined) {
        message += `Final Loss: ${event.loss.toFixed(4)}\n`;
      }
      if (event.errorMessage) {
        message += `\nError: ${event.errorMessage.slice(0, 500)}`;
      }

      const response = await fetch(
        `https://api.telegram.org/bot${credentials.bot_token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: credentials.chat_id,
            text: message,
            parse_mode: 'Markdown',
          }),
        }
      );

      const data = await response.json();

      if (!data.ok) {
        console.error('[IntegrationService] Telegram log failed:', data.description);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[IntegrationService] Telegram log error:', err);
      return false;
    }
  }

  /**
   * Log an event to PagerDuty
   */
  async logToPagerDuty(
    credentials: PagerDutyCredentials,
    event: {
      type: string;
      title: string;
      jobId: string;
      modelName?: string;
      status: string;
      errorMessage?: string;
      duration?: string;
      loss?: number;
    }
  ): Promise<boolean> {
    try {
      const severity = this.getPagerDutySeverity(event.type);
      const customDetails: Record<string, string> = {
        job_id: event.jobId,
        status: event.status,
      };

      if (event.modelName) {
        customDetails.model_name = event.modelName;
      }
      if (event.duration) {
        customDetails.duration = event.duration;
      }
      if (event.loss !== undefined) {
        customDetails.final_loss = event.loss.toFixed(4);
      }
      if (event.errorMessage) {
        customDetails.error_message = event.errorMessage.slice(0, 1000);
      }

      const payload = {
        routing_key: credentials.routing_key,
        event_action: 'trigger',
        dedup_key: `finetune-lab-${event.jobId}-${event.type}`,
        payload: {
          summary: event.title,
          severity,
          source: 'FineTune Lab',
          custom_details: customDetails,
        },
      };

      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.status !== 'success') {
        console.error('[IntegrationService] PagerDuty log failed:', data.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[IntegrationService] PagerDuty log error:', err);
      return false;
    }
  }

  /**
   * Get color for Teams message based on event type
   */
  private getStatusColor(type: string): string {
    const colors: Record<string, string> = {
      job_started: '0076D7',
      job_completed: '2DC72D',
      job_failed: 'D72D2D',
      job_cancelled: 'FFA500',
      gpu_oom: 'D72D2D',
    };
    return colors[type] || '808080';
  }

  /**
   * Get emoji for Telegram message based on event type
   */
  private getStatusEmoji(type: string): string {
    const emojis: Record<string, string> = {
      job_started: '▶️',
      job_completed: '✅',
      job_failed: '❌',
      job_cancelled: '⏹️',
      gpu_oom: '💥',
    };
    return emojis[type] || '📢';
  }

  /**
   * Get severity for PagerDuty based on event type
   */
  private getPagerDutySeverity(type: string): string {
    const severities: Record<string, string> = {
      job_started: 'info',
      job_completed: 'info',
      job_failed: 'error',
      job_cancelled: 'warning',
      gpu_oom: 'critical',
    };
    return severities[type] || 'info';
  }

  /**
   * Record integration error
   */
  async recordError(integrationId: string, error: string): Promise<void> {
    await this.getClient()
      .from('user_integrations')
      .update({
        last_error: error,
        error_count: this.getClient().rpc('increment_integration_error', { p_integration_id: integrationId }),
      })
      .eq('id', integrationId);
  }

  /**
   * Mark successful sync
   */
  async recordSuccess(integrationId: string): Promise<void> {
    await this.getClient()
      .from('user_integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null,
        error_count: 0,
      })
      .eq('id', integrationId);
  }

  /**
   * Convert to display format (mask credentials)
   */
  private toDisplayFormat(integration: UserIntegration): UserIntegrationDisplay {
    const creds = integration.credentials as Record<string, string>;
    let preview = '';
    let hasDbId = false;

    // Create masked preview based on integration type
    if (integration.integration_type === 'notion') {
      const apiKey = creds.api_key || '';
      preview = apiKey ? `secret_...${apiKey.slice(-4)}` : 'Not configured';
      hasDbId = !!creds.database_id;
    } else if (creds.api_key) {
      preview = `...${creds.api_key.slice(-4)}`;
    } else if (creds.webhook_url) {
      preview = 'Webhook configured';
    } else {
      preview = 'Configured';
    }

    return {
      id: integration.id,
      user_id: integration.user_id,
      integration_type: integration.integration_type,
      name: integration.name,
      config: integration.config,
      enabled: integration.enabled,
      last_sync_at: integration.last_sync_at,
      last_error: integration.last_error,
      error_count: integration.error_count,
      created_at: integration.created_at,
      credentials_preview: preview,
      has_database_id: hasDbId,
    };
  }
}

export const integrationService = new IntegrationService();
