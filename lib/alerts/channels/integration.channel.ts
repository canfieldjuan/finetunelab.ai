/**
 * Integration Alert Channel
 * Dispatches alerts to third-party integrations (Notion, Teams, Telegram, PagerDuty)
 * Date: 2025-12-13
 */

import {
  AlertPayload,
  IntegrationDeliveryResult,
  alertTypeToIntegrationKey,
} from '../alert.types';
import { integrationService } from '@/lib/integrations/integration.service';
import type {
  UserIntegration,
  IntegrationType,
  NotionCredentials,
  TeamsCredentials,
  TelegramCredentials,
  PagerDutyCredentials,
} from '@/lib/integrations/integration.types';

export interface IntegrationAlertEvent {
  type: string;
  title: string;
  jobId: string;
  modelName?: string;
  status: string;
  errorMessage?: string;
  duration?: string;
  loss?: number;
}

export class IntegrationChannel {
  /**
   * Send alert to all enabled integrations for a user
   */
  async sendToAll(
    alert: AlertPayload,
    integrations: UserIntegration[]
  ): Promise<IntegrationDeliveryResult[]> {
    const results: IntegrationDeliveryResult[] = [];

    for (const integration of integrations) {
      const result = await this.send(alert, integration);
      results.push(result);
    }

    return results;
  }

  /**
   * Send alert to a specific integration
   */
  async send(
    alert: AlertPayload,
    integration: UserIntegration
  ): Promise<IntegrationDeliveryResult> {
    // Check if integration is enabled
    if (!integration.enabled) {
      return {
        success: false,
        integrationType: integration.integration_type,
        integrationId: integration.id,
        error: 'Integration disabled',
      };
    }

    // Check if this alert type is enabled for this integration
    const configKey = alertTypeToIntegrationKey(alert.type);
    if (configKey && !integration.config[configKey]) {
      return {
        success: false,
        integrationType: integration.integration_type,
        integrationId: integration.id,
        error: `Alert type ${alert.type} disabled for this integration`,
      };
    }

    // Build event payload
    const event = this.buildEvent(alert);

    console.log(
      '[IntegrationChannel] Sending to:',
      integration.integration_type,
      'event:',
      event.type
    );

    try {
      const success = await this.dispatchToIntegration(
        integration.integration_type,
        integration.credentials,
        event
      );

      if (success) {
        await integrationService.recordSuccess(integration.id);
        return {
          success: true,
          integrationType: integration.integration_type,
          integrationId: integration.id,
        };
      } else {
        const errorMsg = 'Delivery failed';
        await integrationService.recordError(integration.id, errorMsg);
        return {
          success: false,
          integrationType: integration.integration_type,
          integrationId: integration.id,
          error: errorMsg,
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[IntegrationChannel] Error:', errorMsg);
      await integrationService.recordError(integration.id, errorMsg);
      return {
        success: false,
        integrationType: integration.integration_type,
        integrationId: integration.id,
        error: errorMsg,
      };
    }
  }

  /**
   * Build event payload from alert
   */
  private buildEvent(alert: AlertPayload): IntegrationAlertEvent {
    const metadata = (alert.metadata || {}) as Record<string, unknown>;

    return {
      type: alert.type,
      title: alert.title,
      jobId: alert.jobId || (metadata.jobId as string) || 'unknown',
      modelName: (metadata.modelName as string) || undefined,
      status: (metadata.status as string) || alert.type.replace('job_', ''),
      errorMessage: (metadata.errorMessage as string) || undefined,
      duration: metadata.duration
        ? this.formatDuration(metadata.duration as number)
        : undefined,
      loss: (metadata.loss as number) || undefined,
    };
  }

  /**
   * Format duration from ms to human-readable
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Dispatch to specific integration type
   */
  private async dispatchToIntegration(
    integrationType: IntegrationType,
    credentials: unknown,
    event: IntegrationAlertEvent
  ): Promise<boolean> {
    switch (integrationType) {
      case 'notion':
        return await integrationService.logToNotion(
          credentials as unknown as NotionCredentials,
          event
        );

      case 'teams':
        return await integrationService.logToTeams(
          credentials as unknown as TeamsCredentials,
          event
        );

      case 'telegram':
        return await integrationService.logToTelegram(
          credentials as unknown as TelegramCredentials,
          event
        );

      case 'pagerduty':
        return await integrationService.logToPagerDuty(
          credentials as unknown as PagerDutyCredentials,
          event
        );

      case 'linear':
      case 'jira':
        // Not implemented yet
        console.log(
          `[IntegrationChannel] ${integrationType} delivery not implemented`
        );
        return false;

      default:
        console.warn('[IntegrationChannel] Unknown integration type:', integrationType);
        return false;
    }
  }
}

export const integrationChannel = new IntegrationChannel();
