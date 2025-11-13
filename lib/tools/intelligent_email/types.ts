// Intelligent Email Tool - Type Definitions
// Phase 1.1: Core email types
// Phase 2.1: Intelligence feature types
// Date: October 24, 2025

/**
 * Email address interface
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

/**
 * Email send parameters
 */
export interface SendEmailParams {
  from: string | EmailAddress;
  to: string | string[] | EmailAddress | EmailAddress[];
  subject: string;
  body: string;
  html?: string;
  cc?: string | string[] | EmailAddress | EmailAddress[];
  bcc?: string | string[] | EmailAddress | EmailAddress[];
  replyTo?: string | EmailAddress;
}

/**
 * Email send result
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

/**
 * Email message for intelligence features
 */
export interface EmailMessage {
  from: string;
  to: string[];
  subject: string;
  body: string;
  date?: string;
  messageId?: string;
}

/**
 * Email thread for summarization
 */
export interface EmailThread {
  messages: EmailMessage[];
  subject: string;
}

/**
 * Email summary result
 */
export interface EmailSummaryResult {
  summary: string;
  keyPoints: string[];
  sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
  actionItems?: string[];
}

/**
 * Smart reply suggestion
 */
export interface ReplySuggestionResponse {
  suggestions: string[];
  tone: 'professional' | 'casual' | 'formal';
}

/**
 * Email provider interface
 * Phase 3.1: Generic provider abstraction
 */
export interface EmailProvider {
  /**
   * Provider name (e.g., 'resend', 'gmail', 'outlook')
   */
  name: string;

  /**
   * Send an email
   */
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;

  /**
   * Validate provider configuration
   */
  isConfigured(): boolean;

  /**
   * Get provider capabilities
   */
  getCapabilities(): EmailProviderCapabilities;
}

/**
 * Email provider capabilities
 */
export interface EmailProviderCapabilities {
  supportsHtml: boolean;
  supportsCc: boolean;
  supportsBcc: boolean;
  supportsAttachments: boolean;
  supportsScheduling: boolean;
  maxRecipients: number;
}
