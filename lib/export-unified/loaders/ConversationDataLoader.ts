/**
 * Conversation Data Loader
 * Loads conversation and message data for export
 * Phase 2: Data Loaders
 *
 * Ported from lib/export/exportService.ts
 */

import type {
  DataLoader,
  DataSelector,
  ConversationDataSelector,
  ExportData,
  ConversationData,
  MessageData,
  ExportMetadata,
  ValidationResult,
} from '../interfaces';
import { validateConversationSelector, validateUserId, estimateDataSize } from '../utils/validation';
import type { JsonValue } from '@/lib/types';

interface DBConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_widget_session: boolean;
}

interface DBMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: JsonValue;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  tools_called?: JsonValue;
  tool_success?: boolean;
  fallback_used?: boolean;
  error_type?: string;
}

export class ConversationDataLoader implements DataLoader {
  /**
   * Load conversation data from database
   */
  async load(selector: DataSelector, userId: string): Promise<ExportData> {
    console.log('[ConversationDataLoader] Loading data for user:', userId);

    // Validate inputs
    const userValidation = validateUserId(userId);
    if (!userValidation.valid) {
      throw new Error(`Invalid user ID: ${userValidation.error}`);
    }

    if (selector.type !== 'conversation') {
      throw new Error(`Invalid selector type: ${selector.type}. Expected: conversation`);
    }

    const convSelector = selector as ConversationDataSelector;

    // Import Supabase client
    const { supabase } = await import('@/lib/supabaseClient');

    // Load conversations
    const { data: dbConversations, error: convError } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at, is_widget_session')
      .eq('user_id', userId)
      .in('id', convSelector.conversationIds)
      .order('created_at', { ascending: true });

    if (convError) {
      throw new Error(`Failed to load conversations: ${convError.message}`);
    }

    if (!dbConversations || dbConversations.length === 0) {
      console.warn('[ConversationDataLoader] No conversations found');
      return {
        type: 'conversation',
        userId,
        data: [],
        metadata: {
          conversationCount: 0,
          messageCount: 0,
        },
      };
    }

    // Filter by widget session type if specified
    let filteredConversations = dbConversations as DBConversation[];
    if (convSelector.widgetSessionFilter && convSelector.widgetSessionFilter !== 'all') {
      console.log('[ConversationDataLoader] Filtering by widget session:', convSelector.widgetSessionFilter);

      if (convSelector.widgetSessionFilter === 'widget') {
        filteredConversations = dbConversations.filter((c) => c.is_widget_session === true);
      } else if (convSelector.widgetSessionFilter === 'normal') {
        filteredConversations = dbConversations.filter((c) => c.is_widget_session === false);
      }

      console.log('[ConversationDataLoader] Filtered conversations:', {
        before: dbConversations.length,
        after: filteredConversations.length,
      });
    }

    if (filteredConversations.length === 0) {
      console.warn('[ConversationDataLoader] No conversations after filtering');
      return {
        type: 'conversation',
        userId,
        data: [],
        metadata: {
          conversationCount: 0,
          messageCount: 0,
        },
      };
    }

    // Load messages for filtered conversations
    const filteredConversationIds = filteredConversations.map((c) => c.id);
    const { data: dbMessages, error: msgError } = await supabase
      .from('messages')
      .select(`
        id, conversation_id, role, content, created_at, metadata,
        latency_ms, input_tokens, output_tokens, tools_called,
        tool_success, fallback_used, error_type
      `)
      .in('conversation_id', filteredConversationIds)
      .order('created_at', { ascending: true });

    if (msgError) {
      throw new Error(`Failed to load messages: ${msgError.message}`);
    }

    // Group messages by conversation ID
    const messagesByConv = (dbMessages || []).reduce(
      (acc: Record<string, DBMessage[]>, msg: DBMessage) => {
        if (!acc[msg.conversation_id]) {
          acc[msg.conversation_id] = [];
        }
        acc[msg.conversation_id].push(msg);
        return acc;
      },
      {}
    );

    // Transform conversations and messages
    const conversations: ConversationData[] = filteredConversations.map((conv) => {
      const rawMessages = messagesByConv[conv.id] || [];

      // Filter by date range if specified
      let filteredMessages = rawMessages;
      if (convSelector.dateRange) {
        filteredMessages = filteredMessages.filter((msg) => {
          const msgDate = new Date(msg.created_at);
          return (
            msgDate >= convSelector.dateRange!.start &&
            msgDate <= convSelector.dateRange!.end
          );
        });
      }

      // Filter out system messages if not included
      if (!convSelector.includeSystemMessages) {
        filteredMessages = filteredMessages.filter((msg) => msg.role !== 'system');
      }

      // Apply message limit if specified
      if (convSelector.messageLimit && filteredMessages.length > convSelector.messageLimit) {
        filteredMessages = filteredMessages.slice(0, convSelector.messageLimit);
      }

      // Transform messages to MessageData
      const messages: MessageData[] = filteredMessages.map((msg) => {
        const messageData: MessageData = {
          id: msg.id,
          role: msg.role,
          content: msg.content,
          created_at: new Date(msg.created_at),
        };

        // Include metadata if available
        if (msg.metadata) {
          messageData.metadata = {
            ...msg.metadata as Record<string, unknown>,
            latency_ms: msg.latency_ms,
            input_tokens: msg.input_tokens,
            output_tokens: msg.output_tokens,
            tools_called: msg.tools_called,
            tool_success: msg.tool_success,
            fallback_used: msg.fallback_used,
            error_type: msg.error_type,
          };
        }

        return messageData;
      });

      return {
        id: conv.id,
        title: conv.title,
        created_at: new Date(conv.created_at),
        updated_at: new Date(conv.updated_at),
        messages,
      };
    });

    // Calculate metadata
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    const metadata: ExportMetadata = {
      conversationCount: conversations.length,
      messageCount: totalMessages,
    };

    if (convSelector.dateRange) {
      metadata.dateRange = {
        start: convSelector.dateRange.start,
        end: convSelector.dateRange.end,
      };
    }

    console.log('[ConversationDataLoader] Data loaded successfully:', {
      conversations: conversations.length,
      messages: totalMessages,
    });

    return {
      type: 'conversation',
      userId,
      data: conversations,
      metadata,
    };
  }

  /**
   * Validate selector before loading
   */
  validate(selector: DataSelector): ValidationResult {
    if (selector.type !== 'conversation') {
      return {
        valid: false,
        error: `Invalid selector type: ${selector.type}. Expected: conversation`,
      };
    }

    return validateConversationSelector(selector as ConversationDataSelector);
  }

  /**
   * Estimate size of export
   */
  async estimateSize(selector: DataSelector): Promise<number> {
    if (selector.type !== 'conversation') {
      throw new Error(`Invalid selector type: ${selector.type}. Expected: conversation`);
    }

    // Use validation utility for basic estimation
    const baseEstimate = estimateDataSize(selector);

    // Could enhance with actual database count query here
    // For now, return the estimation based on conversation count
    return baseEstimate;
  }
}
