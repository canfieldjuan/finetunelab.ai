// Intelligent Email Tool - SMTP Provider
// Phase 3.1: SMTP provider implementation (example)
// Date: October 24, 2025

import type {
  SendEmailParams,
  SendEmailResult,
  EmailProvider,
  EmailProviderCapabilities,
} from './types';

/**
 * SMTP Email Provider
 * Example provider showing how to add new providers
 * Note: This is a stub implementation for demonstration
 */
export class SMTPProvider implements EmailProvider {
  name = 'smtp';
  private host: string;
  private port: number;
  private username?: string;
  private password?: string;

  constructor(config?: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  }) {
    this.host = config?.host || process.env.SMTP_HOST || '';
    this.port = config?.port || parseInt(process.env.SMTP_PORT || '587');
    this.username = config?.username || process.env.SMTP_USERNAME;
    this.password = config?.password || process.env.SMTP_PASSWORD;

    console.log('[SMTPProvider] Initialized:', {
      host: this.host,
      port: this.port,
      hasAuth: !!(this.username && this.password),
    });
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    const configured = !!(this.host && this.port);
    console.log('[SMTPProvider] Configuration check:', configured);
    return configured;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): EmailProviderCapabilities {
    return {
      supportsHtml: true,
      supportsCc: true,
      supportsBcc: true,
      supportsAttachments: true,
      supportsScheduling: false,
      maxRecipients: 100,
    };
  }

  /**
   * Send email via SMTP
   * Note: This is a stub - real implementation would use nodemailer or similar
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    console.log('[SMTPProvider] Send email (STUB):', {
      to: params.to,
      subject: params.subject,
      from: params.from,
    });

    // Stub implementation - would use nodemailer in production
    console.warn('[SMTPProvider] This is a stub implementation');
    console.warn('[SMTPProvider] Real implementation requires nodemailer or similar SMTP client');

    return {
      success: false,
      error: 'SMTP provider is a stub implementation. Use Resend provider for actual email sending.',
      provider: 'smtp',
    };
  }
}

/**
 * Singleton instance
 */
export const smtpProvider = new SMTPProvider();
