// Intelligent Email Tool - Security Analysis Tool
// Phase 4.2: Tool definition for PII, spam, and sentiment analysis
// Date: October 24, 2025

import { ToolDefinition } from '../types';
import { emailSecurityService } from './security.service';
import type { EmailMessage } from './types';

/**
 * Email Security Analysis Tool
 * 
 * Provides comprehensive security analysis for emails including:
 * - PII (Personally Identifiable Information) detection
 * - Spam/phishing detection
 * - Enhanced sentiment analysis
 */
const emailSecurityTool: ToolDefinition = {
  name: 'email_security',
  description: 'Perform security analysis on email content including PII detection, spam/phishing detection, and sentiment analysis',
  version: '1.0.0',
  
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['detect_pii', 'detect_spam', 'analyze_sentiment'],
        description: 'The security analysis action to perform',
      },
      email: {
        type: 'object',
        description: 'Email message to analyze (JSON string or object)',
      },
    },
    required: ['action', 'email'],
  },

  config: {
    enabled: true,
    requiresAuth: false,
    rateLimit: {
      requests: 50,
      window: 60000, // 1 minute
    },
  },

  execute: async (params: Record<string, unknown>, _conversationId?: string, _userId?: string, _supabaseClient?: unknown, _traceContext?: unknown) => {
    const action = params.action as 'detect_pii' | 'detect_spam' | 'analyze_sentiment';
    const emailParam = params.email;

    console.log('[EmailSecurityTool] Action requested:', action);

    // Parse email if it's a string
    let email: EmailMessage;
    if (typeof emailParam === 'string') {
      try {
        email = JSON.parse(emailParam);
      } catch {
        throw new Error('[EmailSecurityTool] Invalid email JSON');
      }
    } else {
      email = emailParam as EmailMessage;
    }

    if (!email || !email.from || !email.subject || !email.body) {
      throw new Error('[EmailSecurityTool] Invalid email parameter - must have from, subject, and body');
    }

    try {
      switch (action) {
        case 'detect_pii': {
          const result = await emailSecurityService.detectPII(email);
          return {
            success: true,
            action: 'detect_pii',
            result,
            message: result.hasPII
              ? `Detected ${result.detectedItems.length} PII items (${result.piiTypes.join(', ')})`
              : 'No PII detected',
          };
        }

        case 'detect_spam': {
          const result = await emailSecurityService.detectSpamPhishing(email);
          return {
            success: true,
            action: 'detect_spam',
            result,
            message: result.isPhishing
              ? `PHISHING DETECTED - Risk level: ${result.riskLevel}`
              : result.isSpam
              ? `SPAM DETECTED - Risk level: ${result.riskLevel}`
              : 'Email appears safe',
          };
        }

        case 'analyze_sentiment': {
          const result = await emailSecurityService.analyzeSentiment(email);
          return {
            success: true,
            action: 'analyze_sentiment',
            result,
            message: `Sentiment: ${result.sentiment}, Tone: ${result.tone}${
              result.emotions.length > 0 ? `, Emotions: ${result.emotions.join(', ')}` : ''
            }`,
          };
        }

        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error) {
      console.error('[EmailSecurityTool] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
};

export { emailSecurityTool };
