// Intelligent Email Tool - Resend Provider
// Phase 1.1: Resend API integration
// Phase 3.1: Implement EmailProvider interface
// Date: October 24, 2025

import type { 
  SendEmailParams, 
  SendEmailResult, 
  EmailAddress,
  EmailProvider,
  EmailProviderCapabilities,
} from './types';
import { emailConfig } from './email.config';

/**
 * Normalize email address to string format
 */
function normalizeEmailAddress(addr: string | EmailAddress): string {
  if (typeof addr === 'string') {
    return addr;
  }
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

/**
 * Normalize email addresses array
 */
function normalizeEmailAddresses(
  addrs: string | string[] | EmailAddress | EmailAddress[]
): string[] {
  if (Array.isArray(addrs)) {
    return addrs.map(normalizeEmailAddress);
  }
  return [normalizeEmailAddress(addrs)];
}

/**
 * Resend Email Provider
 * Implements the EmailProvider interface
 */
export class ResendProvider implements EmailProvider {
  name = 'resend';

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!emailConfig.apiKey;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): EmailProviderCapabilities {
    return {
      supportsHtml: true,
      supportsCc: true,
      supportsBcc: true,
      supportsAttachments: false,
      supportsScheduling: false,
      maxRecipients: emailConfig.maxRecipients,
    };
  }

  /**
   * Send email via Resend API
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    return sendEmailViaResend(params);
  }
}

/**
 * Singleton instance
 */
export const resendProvider = new ResendProvider();

/**
 * Legacy function export for backward compatibility
 */
export async function sendEmailViaResend(
  params: SendEmailParams
): Promise<SendEmailResult> {
  console.log('[ResendProvider] Sending email:', {
    to: params.to,
    subject: params.subject,
    from: params.from,
  });

  if (!emailConfig.apiKey) {
    console.error('[ResendProvider] API key not configured');
    return {
      success: false,
      error: 'Resend API key not configured. Set RESEND_API_KEY environment variable.',
      provider: 'resend',
    };
  }

  try {
    const toAddresses = normalizeEmailAddresses(params.to);
    const fromAddress = normalizeEmailAddress(params.from);

    if (toAddresses.length > emailConfig.maxRecipients) {
      return {
        success: false,
        error: `Too many recipients. Maximum allowed: ${emailConfig.maxRecipients}`,
        provider: 'resend',
      };
    }

    const payload = {
      from: fromAddress,
      to: toAddresses,
      subject: params.subject,
      html: params.html || params.body,
      text: params.body,
      ...(params.cc && { cc: normalizeEmailAddresses(params.cc) }),
      ...(params.bcc && { bcc: normalizeEmailAddresses(params.bcc) }),
      ...(params.replyTo && { reply_to: normalizeEmailAddress(params.replyTo) }),
    };

    console.log('[ResendProvider] Payload prepared:', {
      from: payload.from,
      to: payload.to.length,
      hasHtml: !!payload.html,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), emailConfig.timeout);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[ResendProvider] API error:', {
        status: response.status,
        error: errorData,
      });
      return {
        success: false,
        error: `Resend API error: ${response.status} - ${errorData.message || 'Unknown error'}`,
        provider: 'resend',
      };
    }

    const result = await response.json();
    console.log('[ResendProvider] Email sent successfully:', result.id);

    return {
      success: true,
      messageId: result.id,
      provider: 'resend',
    };
  } catch (error) {
    console.error('[ResendProvider] Error sending email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to send email: ${errorMessage}`,
      provider: 'resend',
    };
  }
}
