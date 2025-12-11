// Intelligent Email Tool - Intelligence Service
// Phase 2.1: AI-powered email analysis
// Date: October 24, 2025

import { getOpenAIResponse } from '@/lib/llm/openai';
import type {
  EmailMessage,
  EmailThread,
  EmailSummaryResult,
  ReplySuggestionResponse,
} from './types';

/**
 * Intelligence service configuration
 */
interface IntelligenceConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_CONFIG: IntelligenceConfig = {
  model: process.env.EMAIL_INTELLIGENCE_MODEL || 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 1000,
};

export class EmailIntelligenceService {
  private config: IntelligenceConfig;

  constructor(config?: Partial<IntelligenceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[EmailIntelligence] Initialized:', this.config);
  }

  /**
   * Summarize an email thread
   */
  async summarizeThread(thread: EmailThread): Promise<EmailSummaryResult> {
    console.log('[EmailIntelligence] Summarizing thread:', {
      subject: thread.subject,
      messageCount: thread.messages.length,
    });

    try {
      const prompt = this.buildThreadSummaryPrompt(thread);
      const response = await this.callLLM(prompt);
      const parsed = this.parseThreadSummaryResponse(response);

      console.log('[EmailIntelligence] Summary generated:', {
        summaryLength: parsed.summary.length,
        keyPoints: parsed.keyPoints.length,
        sentiment: parsed.sentiment,
      });

      return parsed;
    } catch (error) {
      console.error('[EmailIntelligence] Summarization error:', error);
      throw new Error(`Failed to summarize thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate smart reply suggestions
   */
  async suggestReplies(email: EmailMessage): Promise<ReplySuggestionResponse> {
    console.log('[EmailIntelligence] Generating reply suggestions:', {
      from: email.from,
      subject: email.subject,
    });

    try {
      const prompt = this.buildReplySuggestionPrompt(email);
      const response = await this.callLLM(prompt);
      const parsed = this.parseReplySuggestionResponse(response);

      console.log('[EmailIntelligence] Suggestions generated:', {
        count: parsed.suggestions.length,
        tone: parsed.tone,
      });

      return parsed;
    } catch (error) {
      console.error('[EmailIntelligence] Reply suggestion error:', error);
      throw new Error(`Failed to generate replies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build prompt for summarizing an email thread
   */
  private buildThreadSummaryPrompt(thread: EmailThread): string {
    const messagesText = thread.messages
      .map((msg, idx) => `
Message ${idx + 1}:
From: ${msg.from}
To: ${msg.to.join(', ')}
Date: ${msg.date || 'Unknown'}
Subject: ${msg.subject}
Body:
${msg.body}
`)
      .join('\n---\n');

    return `Analyze this email thread and provide a structured summary.

Thread Subject: ${thread.subject}
Number of Messages: ${thread.messages.length}

${messagesText}

Provide your analysis in this JSON format:
{
  "summary": "A brief 2-3 sentence overview of the entire thread",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "sentiment": "positive|neutral|negative|urgent",
  "actionItems": ["Action 1", "Action 2"]
}

Focus on the main topics discussed, any decisions made, and any action items or next steps.`;
  }

  /**
   * Call LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    const messages = [
      {
        role: 'system' as const,
        content: 'You are an expert email analyst. Provide precise, structured analysis in the requested format. Always respond with valid JSON when requested.',
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    return await getOpenAIResponse(
      messages,
      this.config.model,
      this.config.temperature,
      this.config.maxTokens
    );
  }

  /**
   * Parse thread summary response from LLM
   */
  private parseThreadSummaryResponse(response: string): EmailSummaryResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        summary: parsed.summary || 'No summary available',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        sentiment: parsed.sentiment || 'neutral',
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      };
    } catch (error) {
      console.error('[EmailIntelligence] Parse error:', error);
      return {
        summary: response.substring(0, 500),
        keyPoints: [],
        sentiment: 'neutral',
        actionItems: [],
      };
    }
  }

  /**
   * Build prompt for generating reply suggestions
   */
  private buildReplySuggestionPrompt(email: EmailMessage): string {
    return `Generate 3 smart reply suggestions for this email.

From: ${email.from}
Subject: ${email.subject}
Body:
${email.body}

Provide your suggestions in this JSON format:
{
  "suggestions": [
    "Reply option 1 (brief and professional)",
    "Reply option 2 (more detailed)",
    "Reply option 3 (alternative approach)"
  ],
  "tone": "professional|casual|formal"
}

Each suggestion should be a complete, ready-to-send response that directly addresses the email content.`;
  }

  /**
   * Parse reply suggestion response from LLM
   */
  private parseReplySuggestionResponse(response: string): ReplySuggestionResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        suggestions: Array.isArray(parsed.suggestions) 
          ? parsed.suggestions.slice(0, 3) 
          : ['Thank you for your email. I will review and get back to you soon.'],
        tone: parsed.tone || 'professional',
      };
    } catch (error) {
      console.error('[EmailIntelligence] Parse error:', error);
      return {
        suggestions: ['Thank you for your email. I will review and get back to you soon.'],
        tone: 'professional',
      };
    }
  }
}

export const emailIntelligenceService = new EmailIntelligenceService();
