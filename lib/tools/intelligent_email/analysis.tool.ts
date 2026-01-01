// Intelligent Email Tool - Email Analysis
// Phase 2.1: AI-powered email analysis tool
// Date: October 24, 2025

import { ToolDefinition } from '../types';
import { emailIntelligenceService } from './intelligence.service';
import type { EmailThread, EmailMessage } from './types';

/**
 * Handle thread summarization
 */
async function handleSummarizeThread(params: Record<string, unknown>) {
  const emailThreadStr = params.emailThread as string;

  if (!emailThreadStr) {
    throw new Error('[EmailAnalysis] Missing emailThread parameter for summarize_thread action');
  }

  try {
    const thread: EmailThread = JSON.parse(emailThreadStr);

    if (!thread.messages || !Array.isArray(thread.messages)) {
      throw new Error('Invalid thread format: messages array required');
    }

    console.log('[EmailAnalysis] Summarizing thread with', thread.messages.length, 'messages');

    const result = await emailIntelligenceService.summarizeThread(thread);

    return {
      action: 'summarize_thread',
      success: true,
      summary: result.summary,
      keyPoints: result.keyPoints,
      sentiment: result.sentiment,
      actionItems: result.actionItems,
      messageCount: thread.messages.length,
    };
  } catch (error) {
    console.error('[EmailAnalysis] Summarization error:', error);
    throw new Error(`Failed to summarize thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handle reply suggestions
 */
async function handleSuggestReplies(params: Record<string, unknown>) {
  const emailStr = params.email as string;

  if (!emailStr) {
    throw new Error('[EmailAnalysis] Missing email parameter for suggest_replies action');
  }

  try {
    const email: EmailMessage = JSON.parse(emailStr);

    if (!email.subject || !email.body) {
      throw new Error('Invalid email format: subject and body required');
    }

    console.log('[EmailAnalysis] Generating replies for:', email.subject);

    const result = await emailIntelligenceService.suggestReplies(email);

    return {
      action: 'suggest_replies',
      success: true,
      suggestions: result.suggestions,
      tone: result.tone,
      originalSubject: email.subject,
    };
  } catch (error) {
    console.error('[EmailAnalysis] Reply suggestion error:', error);
    throw new Error(`Failed to suggest replies: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Email Analysis Tool Definition
 * Provides AI-powered email analysis features
 */
const emailAnalysisTool: ToolDefinition = {
  name: 'email_analysis',
  description: 'Analyze emails using AI to summarize threads, suggest replies, detect sentiment, and extract action items. Use this tool to help users understand and respond to emails more effectively.',
  version: '1.0.0',

  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Analysis action to perform',
        enum: ['summarize_thread', 'suggest_replies'],
        required: true,
      },
      emailThread: {
        type: 'string',
        description: 'JSON string of email thread for summarization. Format: {"subject": "...", "messages": [{"from": "...", "to": ["..."], "subject": "...", "body": "...", "date": "..."}]}',
      },
      email: {
        type: 'string',
        description: 'JSON string of single email for reply suggestions. Format: {"from": "...", "to": ["..."], "subject": "...", "body": "..."}',
      },
    },
    required: ['action'],
  },

  config: {
    enabled: process.env.EMAIL_ANALYSIS_ENABLED !== 'false',
  },

  /**
   * Execute email analysis operation
   */
  async execute(params: Record<string, unknown>, _conversationId?: string, _userId?: string, _supabaseClient?: unknown, _traceContext?: unknown) {
    const action = params.action as string;

    console.log('[EmailAnalysis] Executing action:', action);

    if (!action) {
      throw new Error('[EmailAnalysis] Missing required parameter: action');
    }

    switch (action) {
      case 'summarize_thread':
        return await handleSummarizeThread(params);

      case 'suggest_replies':
        return await handleSuggestReplies(params);

      default:
        throw new Error(`[EmailAnalysis] Unknown action: ${action}`);
    }
  },
};

export default emailAnalysisTool;
