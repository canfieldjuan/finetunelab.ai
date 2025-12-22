// Intelligent Email Tool - Main Export
// Phase 1.1: Tool definition and registration
// Phase 3.1: Use provider registry
// Date: October 24, 2025

import { ToolDefinition } from '../types';
import { emailConfig } from './email.config';
import { emailProviderRegistry } from './provider.registry';
import { SendEmailParams } from './types';

/**
 * Intelligent Email Tool Definition
 * Sends emails intelligently using Resend API
 */
const intelligentEmailTool: ToolDefinition = {
  name: 'intelligent_email',
  description: 'Send emails intelligently using the Resend API. Supports HTML and plain text emails, multiple recipients, CC, BCC, and reply-to addresses. Use this tool when you need to send professional emails on behalf of the user.',
  version: '1.0.0',

  parameters: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address or comma-separated list of email addresses',
        required: true,
      },
      subject: {
        type: 'string',
        description: 'Email subject line',
        required: true,
      },
      body: {
        type: 'string',
        description: 'Email body content (plain text or HTML)',
        required: true,
      },
      from: {
        type: 'string',
        description: 'Sender email address (must be verified with Resend)',
      },
      html: {
        type: 'string',
        description: 'HTML version of the email body (optional, overrides plain text formatting)',
      },
      cc: {
        type: 'string',
        description: 'CC email addresses (comma-separated)',
      },
      bcc: {
        type: 'string',
        description: 'BCC email addresses (comma-separated)',
      },
      replyTo: {
        type: 'string',
        description: 'Reply-to email address',
      },
    },
    required: ['to', 'subject', 'body'],
  },

  config: {
    enabled: emailConfig.enabled,
    provider: emailConfig.provider,
    timeout: emailConfig.timeout,
  },

  /**
   * Execute email sending operation
   */
  async execute(params: Record<string, unknown>, _conversationId?: string, _userId?: string, _supabaseClient?: unknown, _traceContext?: any) {
    console.log('[IntelligentEmail] Executing email send');

    const to = params.to as string;
    const subject = params.subject as string;
    const body = params.body as string;
    const from = (params.from as string) || emailConfig.defaultFrom;

    if (!to || !subject || !body) {
      throw new Error('[IntelligentEmail] Missing required parameters: to, subject, and body are required');
    }

    if (!from) {
      throw new Error('[IntelligentEmail] No sender address provided. Set "from" parameter or EMAIL_DEFAULT_FROM environment variable');
    }

    const toArray = to.split(',').map(email => email.trim());
    const ccArray = params.cc ? (params.cc as string).split(',').map(email => email.trim()) : undefined;
    const bccArray = params.bcc ? (params.bcc as string).split(',').map(email => email.trim()) : undefined;

    const emailParams: SendEmailParams = {
      from,
      to: toArray,
      subject,
      body,
      html: params.html as string | undefined,
      cc: ccArray,
      bcc: bccArray,
      replyTo: params.replyTo as string | undefined,
    };

    const result = await emailProviderRegistry.sendEmail(emailParams);

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    return {
      success: true,
      messageId: result.messageId,
      provider: result.provider,
      to: toArray,
      subject,
    };
  },
};

export default intelligentEmailTool;
