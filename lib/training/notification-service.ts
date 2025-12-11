/**
 * Phase 2.4.3: Notification Service
 * 
 * Multi-channel notification delivery system for approval workflows.
 * Supports Slack, Email, Webhook, and In-App notifications.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ApprovalRequest,
  NotificationChannel,
  NotificationStatus,
  NotificationInput,
  NotificationTemplate,
  SlackMessage,
  EmailMessage,
  WebhookPayload,
  InAppNotification,
  ApprovalNotification,
} from './types/approval-types';

// =============================================================================
// Base Notification Service
// =============================================================================

export interface NotificationServiceConfig {
  supabase?: SupabaseClient;
  maxRetries?: number;
  retryDelayMs?: number;
  enableBatchSending?: boolean;
  batchSize?: number;
}

export abstract class NotificationService {
  protected supabase: SupabaseClient;
  protected maxRetries: number;
  protected retryDelayMs: number;
  protected enableBatchSending: boolean;
  protected batchSize: number;

  constructor(config: NotificationServiceConfig = {}) {
    // Initialize Supabase client
    if (config.supabase) {
      this.supabase = config.supabase as SupabaseClient;
    } else {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }
      
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    this.maxRetries = config.maxRetries || 3;
    this.retryDelayMs = config.retryDelayMs || 5000;
    this.enableBatchSending = config.enableBatchSending || false;
    this.batchSize = config.batchSize || 10;
  }

  /**
   * Send notification for approval request
   */
  async sendApprovalNotification(
    request: ApprovalRequest,
    template: NotificationTemplate
  ): Promise<void> {
    const channels = request.notifyChannels;
    const recipients = request.notifyUsers;

    // Send to each channel
    for (const channel of channels) {
      for (const recipient of recipients) {
        await this.sendNotification({
          approvalRequestId: request.id,
          channel,
          recipient,
          subject: this.renderTemplate(template.subject, request),
          body: this.renderTemplate(template.body, request),
          metadata: {
            priority: template.priority,
            workflowId: request.workflowId,
            jobId: request.jobId,
          },
        });
      }
    }
  }

  /**
   * Send single notification
   */
  async sendNotification(input: NotificationInput): Promise<ApprovalNotification> {
    // Create notification record
    const { data, error } = await this.supabase
      .from('approval_notifications')
      .insert({
        approval_request_id: input.approvalRequestId,
        channel: input.channel,
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
        status: NotificationStatus.PENDING,
        retry_count: 0,
        max_retries: this.maxRetries,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification record: ${error.message}`);
    }

    const notification = this.mapToNotification(data);

    // Send via appropriate channel
    try {
      await this.sendViaChannel(notification);
      
      // Update status to sent
      await this.updateNotificationStatus(notification.id, NotificationStatus.SENT);
      
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
    } catch (error) {
      // Update status to failed
      await this.updateNotificationStatus(
        notification.id,
        NotificationStatus.FAILED,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      notification.status = NotificationStatus.FAILED;
      notification.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    return notification;
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(): Promise<number> {
    // Get failed notifications that haven't exceeded max retries
    const { data, error } = await this.supabase
      .from('approval_notifications')
      .select('*')
      .eq('status', NotificationStatus.FAILED)
      .lt('retry_count', this.maxRetries);

    if (error) {
      console.error('Error fetching failed notifications:', error);
      return 0;
    }

    if (!data || data.length === 0) {
      return 0;
    }

    let retryCount = 0;

    for (const item of data) {
      const notification = this.mapToNotification(item);
      
      try {
        await this.sendViaChannel(notification);
        
        // Success - update status
        await this.updateNotificationStatus(notification.id, NotificationStatus.SENT);
        retryCount++;
      } catch (error) {
        // Failed again - increment retry count
        await this.supabase
          .from('approval_notifications')
          .update({
            retry_count: notification.retryCount + 1,
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', notification.id);
      }
    }

    return retryCount;
  }

  /**
   * Send notification via appropriate channel
   */
  protected abstract sendViaChannel(notification: ApprovalNotification): Promise<void>;

  /**
   * Render template with approval request data
   */
  protected renderTemplate(template: string, request: ApprovalRequest): string {
    return template
      .replace('{{title}}', request.title)
      .replace('{{description}}', request.description || '')
      .replace('{{workflowId}}', request.workflowId)
      .replace('{{jobId}}', request.jobId)
      .replace('{{requestedBy}}', request.requestedBy)
      .replace('{{expiresAt}}', request.expiresAt.toLocaleString())
      .replace('{{timeoutMs}}', (request.timeoutMs / 60000).toFixed(0))
      .replace('{{approvalUrl}}', this.getApprovalUrl(request.id));
  }

  /**
   * Get approval URL
   */
  protected getApprovalUrl(requestId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/approvals/${requestId}`;
  }

  /**
   * Update notification status
   */
  protected async updateNotificationStatus(
    notificationId: string,
    status: NotificationStatus,
    errorMessage?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = { status };

    if (status === NotificationStatus.SENT) {
      updates.sent_at = new Date().toISOString();
    } else if (status === NotificationStatus.FAILED) {
      updates.failed_at = new Date().toISOString();
      updates.error_message = errorMessage;
    } else if (status === NotificationStatus.READ) {
      updates.read_at = new Date().toISOString();
    }

    await this.supabase
      .from('approval_notifications')
      .update(updates)
      .eq('id', notificationId);
  }

  /**
   * Map database row to ApprovalNotification
   */
  protected mapToNotification(data: Record<string, unknown>): ApprovalNotification {
    return {
      id: data.id as string,
      approvalRequestId: data.approval_request_id as string,
      channel: data.channel as NotificationChannel,
      recipient: data.recipient as string,
      status: data.status as NotificationStatus,
      sentAt: data.sent_at ? new Date(data.sent_at as string) : undefined,
      readAt: data.read_at ? new Date(data.read_at as string) : undefined,
      failedAt: data.failed_at ? new Date(data.failed_at as string) : undefined,
      errorMessage: data.error_message as string | undefined,
      retryCount: data.retry_count as number,
      maxRetries: data.max_retries as number,
      subject: data.subject as string | undefined,
      body: data.body as string | undefined,
      metadata: (data.metadata as Record<string, unknown>) || {},
      externalId: data.external_id as string | undefined,
      externalUrl: data.external_url as string | undefined,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}

// =============================================================================
// Slack Notification Service
// =============================================================================

export class SlackNotificationService extends NotificationService {
  private webhookUrl: string;
  private botToken?: string;

  constructor(config: NotificationServiceConfig & { webhookUrl?: string; botToken?: string } = {}) {
    super(config);
    
    this.webhookUrl = config.webhookUrl || process.env.SLACK_WEBHOOK_URL || '';
    this.botToken = config.botToken || process.env.SLACK_BOT_TOKEN;

    if (!this.webhookUrl && !this.botToken) {
      console.warn('Slack webhook URL or bot token not configured');
    }
  }

  protected async sendViaChannel(notification: ApprovalNotification): Promise<void> {
    const message = this.buildSlackMessage(notification);

    if (this.botToken) {
      // Use Slack Web API for more features
      await this.sendViaWebAPI(notification.recipient, message);
    } else if (this.webhookUrl) {
      // Use webhook for simple messages
      await this.sendViaWebhook(message);
    } else {
      throw new Error('Slack not configured');
    }
  }

  private buildSlackMessage(notification: ApprovalNotification): SlackMessage {
    return {
      channel: notification.recipient,
      text: notification.subject || 'Approval Required',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: notification.subject || 'Approval Required',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: notification.body || '',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Approval',
              },
              url: this.getApprovalUrl(notification.approvalRequestId),
              style: 'primary',
            },
          ],
        },
      ],
      attachments: notification.metadata?.priority === 'high' ? [
        {
          color: '#ff0000',
          text: '⚠️ *High Priority* - Requires immediate attention',
        },
      ] : undefined,
    };
  }

  private async sendViaWebhook(message: SlackMessage): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`);
    }
  }

  private async sendViaWebAPI(channel: string, message: SlackMessage): Promise<void> {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.botToken}`,
      },
      body: JSON.stringify({
        channel,
        text: message.text,
        blocks: message.blocks,
        attachments: message.attachments,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API failed: ${data.error}`);
    }

    // Store external ID
    await this.supabase
      .from('approval_notifications')
      .update({
        external_id: data.ts,
        external_url: `slack://channel?team=${data.team}&id=${data.channel}`,
      })
      .eq('id', channel);
  }
}

// =============================================================================
// Email Notification Service
// =============================================================================

export class EmailNotificationService extends NotificationService {
  private smtpHost?: string;
  private smtpPort?: number;
  private smtpUser?: string;
  private smtpPassword?: string;
  private fromEmail?: string;
  private fromName?: string;

  constructor(config: NotificationServiceConfig & {
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    fromEmail?: string;
    fromName?: string;
  } = {}) {
    super(config);
    
    this.smtpHost = config.smtpHost || process.env.SMTP_HOST;
    this.smtpPort = config.smtpPort || parseInt(process.env.SMTP_PORT || '587');
    this.smtpUser = config.smtpUser || process.env.SMTP_USER;
    this.smtpPassword = config.smtpPassword || process.env.SMTP_PASSWORD;
    this.fromEmail = config.fromEmail || process.env.SMTP_FROM_EMAIL || 'noreply@example.com';
    this.fromName = config.fromName || process.env.SMTP_FROM_NAME || 'Approval System';

    if (!this.smtpHost) {
      console.warn('Email SMTP not configured');
    }
  }

  protected async sendViaChannel(notification: ApprovalNotification): Promise<void> {
    const message = this.buildEmailMessage(notification);

    // In production, use nodemailer or similar
    // For now, we'll use a simple fetch-based approach
    await this.sendEmail(message);
  }

  private buildEmailMessage(notification: ApprovalNotification): EmailMessage {
    const approvalUrl = this.getApprovalUrl(notification.approvalRequestId);

    return {
      from: `${this.fromName} <${this.fromEmail}>`,
      to: notification.recipient,
      subject: notification.subject || 'Approval Required',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0; color: #0066cc;">${notification.subject}</h2>
            ${notification.metadata?.priority === 'high' ? 
              '<p style="color: #ff0000; font-weight: bold; margin: 10px 0;">⚠️ High Priority - Requires immediate attention</p>' : 
              ''}
          </div>
          
          <div style="background-color: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
            <div style="white-space: pre-wrap;">${notification.body}</div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${approvalUrl}" 
               style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Approval Request
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${approvalUrl}</p>
          </div>
        </body>
        </html>
      `.trim(),
      text: `
${notification.subject}

${notification.body}

View approval request: ${approvalUrl}
      `.trim(),
    };
  }

  private async sendEmail(message: EmailMessage): Promise<void> {
    // In production, integrate with nodemailer, SendGrid, AWS SES, etc.
    // For now, log the email
    const toAddress = Array.isArray(message.to) ? message.to.join(', ') : message.to;
    console.log('Email notification:', {
      to: toAddress,
      subject: message.subject,
    });

    // Simulated delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // If you have SendGrid configured:
    // const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
    //   },
    //   body: JSON.stringify(message),
    // });
  }
}

// =============================================================================
// Webhook Notification Service
// =============================================================================

export class WebhookNotificationService extends NotificationService {
  private webhookUrl?: string;
  private signingSecret?: string;

  constructor(config: NotificationServiceConfig & {
    webhookUrl?: string;
    signingSecret?: string;
  } = {}) {
    super(config);
    
    this.webhookUrl = config.webhookUrl || process.env.WEBHOOK_URL;
    this.signingSecret = config.signingSecret || process.env.WEBHOOK_SIGNING_SECRET;

    if (!this.webhookUrl) {
      console.warn('Webhook URL not configured');
    }
  }

  protected async sendViaChannel(notification: ApprovalNotification): Promise<void> {
    if (!this.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const payload = this.buildWebhookPayload(notification);
    const signature = this.signPayload(payload);

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
  }

  private buildWebhookPayload(notification: ApprovalNotification): WebhookPayload {
    return {
      url: this.webhookUrl!,
      method: 'POST',
      body: {
        event: 'approval.required',
        timestamp: new Date().toISOString(),
        data: {
          notificationId: notification.id,
          approvalRequestId: notification.approvalRequestId,
          recipient: notification.recipient,
          subject: notification.subject,
          body: notification.body,
          approvalUrl: this.getApprovalUrl(notification.approvalRequestId),
        },
        metadata: notification.metadata,
      },
    };
  }

  private signPayload(payload: WebhookPayload): string {
    if (!this.signingSecret) {
      return '';
    }

    // In production, use crypto.createHmac
    import('crypto').then(crypto => {
      const hmac = crypto.createHmac('sha256', this.signingSecret!);
      hmac.update(JSON.stringify(payload));
      return hmac.digest('hex');
    });
    
    return '';
  }
}

// =============================================================================
// In-App Notification Service
// =============================================================================

export class InAppNotificationService extends NotificationService {
  protected async sendViaChannel(notification: ApprovalNotification): Promise<void> {
    // In-app notifications are already stored in the database
    // Just mark as sent since they're visible immediately
    console.log('In-app notification created:', notification.id);
  }

  /**
   * Get unread notifications for user
   */
  async getUnreadNotifications(userId: string): Promise<InAppNotification[]> {
    const { data, error } = await this.supabase
      .from('approval_notifications')
      .select(`
        *,
        approval_requests (
          id,
          workflow_id,
          job_id,
          title,
          description,
          status,
          expires_at
        )
      `)
      .eq('channel', NotificationChannel.IN_APP)
      .eq('recipient', userId)
      .eq('status', NotificationStatus.SENT)
      .is('read_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get unread notifications: ${error.message}`);
    }

    return data.map(item => this.mapToInAppNotification(item));
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.updateNotificationStatus(notificationId, NotificationStatus.READ);
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.supabase
      .from('approval_notifications')
      .update({
        status: NotificationStatus.READ,
        read_at: new Date().toISOString(),
      })
      .eq('channel', NotificationChannel.IN_APP)
      .eq('recipient', userId)
      .is('read_at', null);
  }

  private mapToInAppNotification(data: Record<string, unknown>): InAppNotification {
    const request = data.approval_requests as Record<string, unknown>;

    return {
      userId: data.recipient as string,
      title: data.subject as string,
      message: data.body as string,
      type: 'info',
      link: this.getApprovalUrl(data.approval_request_id as string),
      metadata: {
        notificationId: data.id as string,
        priority: (data.metadata as Record<string, unknown>)?.priority as 'low' | 'medium' | 'high',
        timestamp: new Date(data.created_at as string),
        read: data.read_at !== null,
        approvalRequest: request ? {
          id: request.id as string,
          workflowId: request.workflow_id as string,
          jobId: request.job_id as string,
          title: request.title as string,
          description: request.description as string,
          status: request.status as string,
          expiresAt: new Date(request.expires_at as string),
        } : undefined,
      },
    };
  }
}

// =============================================================================
// Multi-Channel Notification Manager
// =============================================================================

export class MultiChannelNotificationService {
  private services: Map<NotificationChannel, NotificationService>;

  constructor(
    slackService?: SlackNotificationService,
    emailService?: EmailNotificationService,
    webhookService?: WebhookNotificationService,
    inAppService?: InAppNotificationService
  ) {
    this.services = new Map();

    if (slackService) {
      this.services.set(NotificationChannel.SLACK, slackService);
    }
    if (emailService) {
      this.services.set(NotificationChannel.EMAIL, emailService);
    }
    if (webhookService) {
      this.services.set(NotificationChannel.WEBHOOK, webhookService);
    }
    if (inAppService) {
      this.services.set(NotificationChannel.IN_APP, inAppService);
    }
  }

  async sendApprovalNotification(
    request: ApprovalRequest,
    template: NotificationTemplate
  ): Promise<void> {
    const channels = request.notifyChannels;

    // Send to each configured channel
    const promises = channels
      .filter(channel => this.services.has(channel))
      .map(channel => {
        const service = this.services.get(channel)!;
        return service.sendApprovalNotification(request, template);
      });

    await Promise.allSettled(promises);
  }

  getService(channel: NotificationChannel): NotificationService | undefined {
    return this.services.get(channel);
  }
}

// =============================================================================
// Notification Templates
// =============================================================================

export const APPROVAL_TEMPLATES = {
  approvalRequired: {
    subject: 'Approval Required: {{title}}',
    body: `
An approval request requires your attention:

**Workflow**: {{workflowId}}
**Job**: {{jobId}}
**Title**: {{title}}
**Description**: {{description}}

**Requested by**: {{requestedBy}}
**Expires in**: {{timeoutMs}} minutes

Please review and approve or reject this request.
    `.trim(),
    priority: 'medium' as const,
    channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
  },

  approvalUrgent: {
    subject: '🚨 URGENT: Approval Required - {{title}}',
    body: `
⚠️ **URGENT APPROVAL REQUIRED**

An urgent approval request requires your immediate attention:

**Workflow**: {{workflowId}}
**Job**: {{jobId}}
**Title**: {{title}}
**Description**: {{description}}

**Requested by**: {{requestedBy}}
**Expires in**: {{timeoutMs}} minutes

This request is expiring soon. Please review immediately.
    `.trim(),
    priority: 'high' as const,
    channels: [NotificationChannel.SLACK, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
  },

  approvalDecision: {
    subject: 'Approval {{decision}}: {{title}}',
    body: `
An approval request has been {{decision}}:

**Workflow**: {{workflowId}}
**Job**: {{jobId}}
**Title**: {{title}}

**Decided by**: {{decidedBy}}
**Decision**: {{decision}}
**Comment**: {{comment}}
    `.trim(),
    priority: 'low' as const,
    channels: [NotificationChannel.IN_APP],
  },
};

// Singleton instances
let multiChannelService: MultiChannelNotificationService | null = null;

export function getNotificationService(): MultiChannelNotificationService {
  if (!multiChannelService) {
    multiChannelService = new MultiChannelNotificationService(
      new SlackNotificationService(),
      new EmailNotificationService(),
      new WebhookNotificationService(),
      new InAppNotificationService()
    );
  }
  return multiChannelService;
}
