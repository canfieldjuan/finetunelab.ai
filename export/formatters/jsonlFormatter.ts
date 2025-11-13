/**
 * JSONL Format Generator for LLM Training
 *
 * Generates JSONL (JSON Lines) exports with metrics for fine-tuning.
 * Supports OpenAI, Anthropic, and full custom formats.
 *
 * @module lib/export/formatters/jsonlFormatter
 */

import {
  FormatGenerator,
  ConversationData,
  ExportOptions,
  JsonlSubFormat,
  MessageData,
} from '../types';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Helper interface for conversation turns
 */
interface ConversationTurn {
  user: MessageData;
  assistant: MessageData;
}

/**
 * JSONL formatter for LLM training
 */
export class JsonlFormatter implements FormatGenerator {
  private subFormat: JsonlSubFormat;
  private includeMetrics: boolean;
  private includeEvaluations: boolean;

  constructor(
    subFormat: JsonlSubFormat = 'full',
    includeMetrics: boolean = true,
    includeEvaluations: boolean = true
  ) {
    this.subFormat = subFormat;
    this.includeMetrics = includeMetrics;
    this.includeEvaluations = includeEvaluations;
  }

  /**
   * Generate JSONL export
   */
  async generate(
    conversations: ConversationData[],
    options: ExportOptions
  ): Promise<string> {
    const lines: string[] = [];

    for (const conv of conversations) {
      // Load evaluations if needed
      const evaluations = this.includeEvaluations
        ? await this.loadEvaluations(conv.messages.map(m => m.id))
        : {};

      // Process conversation turns
      const turns = this.extractTurns(conv.messages);

      for (const turn of turns) {
        const line = this.formatTurn(turn, evaluations, conv.id);
        if (line) {
          lines.push(line);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Extract conversation turns (user + assistant pairs)
   */
  private extractTurns(messages: MessageData[]): ConversationTurn[] {
    const turns: ConversationTurn[] = [];
    let currentUser: MessageData | null = null;

    for (const msg of messages) {
      if (msg.role === 'user') {
        currentUser = msg;
      } else if (msg.role === 'assistant' && currentUser) {
        turns.push({
          user: currentUser,
          assistant: msg,
        });
        currentUser = null;
      }
    }

    return turns;
  }

  /**
   * Format a single turn based on sub-format
   */
  private formatTurn(
    turn: ConversationTurn,
    evaluations: Record<string, any>,
    conversationId: string
  ): string | null {
    switch (this.subFormat) {
      case 'openai':
        return this.formatOpenAI(turn, evaluations);
      case 'anthropic':
        return this.formatAnthropic(turn, evaluations);
      case 'full':
        return this.formatFull(turn, evaluations, conversationId);
      default:
        return null;
    }
  }

  /**
   * Format for OpenAI fine-tuning
   */
  private formatOpenAI(
    turn: ConversationTurn,
    evaluations: Record<string, any>
  ): string {
    const obj: any = {
      messages: [
        { role: 'user', content: turn.user.content },
        { role: 'assistant', content: turn.assistant.content },
      ],
    };

    if (this.includeMetrics && turn.assistant.metadata) {
      obj.metrics = this.extractMetrics(turn.assistant.metadata);
    }

    if (this.includeEvaluations && evaluations[turn.assistant.id]) {
      obj.evaluation = evaluations[turn.assistant.id];
    }

    return JSON.stringify(obj);
  }

  /**
   * Format for Anthropic fine-tuning
   */
  private formatAnthropic(
    turn: ConversationTurn,
    evaluations: Record<string, any>
  ): string {
    const obj: any = {
      prompt: `Human: ${turn.user.content}\n\nAssistant:`,
      completion: ` ${turn.assistant.content}`,
    };

    if (this.includeMetrics && turn.assistant.metadata) {
      obj.metrics = this.extractMetrics(turn.assistant.metadata);
    }

    if (this.includeEvaluations && evaluations[turn.assistant.id]) {
      obj.evaluation = evaluations[turn.assistant.id];
    }

    return JSON.stringify(obj);
  }

  /**
   * Format full training format with all metrics
   */
  private formatFull(
    turn: ConversationTurn,
    evaluations: Record<string, any>,
    conversationId: string
  ): string {
    const obj: any = {
      conversation_id: conversationId,
      timestamp: turn.assistant.created_at.toISOString(),
      messages: {
        user: turn.user.content,
        assistant: turn.assistant.content,
      },
    };

    if (this.includeMetrics && turn.assistant.metadata) {
      obj.metrics = this.extractMetrics(turn.assistant.metadata);
    }

    if (this.includeEvaluations && evaluations[turn.assistant.id]) {
      obj.evaluation = evaluations[turn.assistant.id];
    }

    return JSON.stringify(obj);
  }

  /**
   * Extract metrics from message metadata
   */
  private extractMetrics(metadata?: Record<string, unknown>): any {
    if (!metadata) {
      return {
        latency_ms: null,
        input_tokens: null,
        output_tokens: null,
        tools_called: null,
        tool_success: null,
        error_type: null,
      };
    }

    return {
      latency_ms: metadata.latency_ms || null,
      input_tokens: metadata.input_tokens || null,
      output_tokens: metadata.output_tokens || null,
      tools_called: metadata.tools_called || null,
      tool_success: metadata.tool_success || null,
      error_type: metadata.error_type || null,
    };
  }

  /**
   * Load evaluations for messages
   */
  private async loadEvaluations(
    messageIds: string[]
  ): Promise<Record<string, any>> {
    if (messageIds.length === 0) return {};

    const { data, error } = await supabase
      .from('message_evaluations')
      .select('message_id, rating, success, failure_tags, notes')
      .in('message_id', messageIds);

    if (error || !data) return {};

    return data.reduce((acc: any, evaluation: any) => {
      acc[evaluation.message_id] = {
        rating: evaluation.rating,
        success: evaluation.success,
        failure_tags: evaluation.failure_tags || [],
        notes: evaluation.notes || null,
      };
      return acc;
    }, {});
  }

  /**
   * Get file extension
   */
  getExtension(): string {
    return 'jsonl';
  }

  /**
   * Get MIME type
   */
  getMimeType(): string {
    return 'application/jsonl';
  }
}
