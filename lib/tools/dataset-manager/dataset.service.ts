// Dataset Manager Service - Database Operations
// Date: October 13, 2025

import { supabase } from '@/lib/supabaseClient';
import { exportService } from '@/lib/export';
import type { ExportFormat, ExportResult } from '@/lib/export';
import type {
  DatasetFilter,
  DatasetStats,
  DatasetItem,
  DatasetExport,
  DatasetExportWithDownload,
  ValidationResult,
} from './types';
import { datasetConfig } from './dataset.config';

class DatasetService {
  async listDatasets(userId: string): Promise<DatasetItem[]> {
    console.debug(
      `[DatasetService] Calling get_conversation_stats for user: ${userId}`
    );
    try {
      const { data, error } = await supabase.rpc('get_conversation_stats', {
        p_user_id: userId,
      });

      if (error) {
        console.error(
          '[DatasetService] RPC call failed:',
          error
        );
        throw error;
      }

      if (!data) {
        console.debug('[DatasetService] No datasets found for user.');
        return [];
      }

      console.debug(`[DatasetService] Received ${data.length} records.`);

      type ConversationStatsRow = {
        id: string;
        title: string;
        created_at: string;
        message_count: number;
        assistant_count: number;
        evaluation_count: number;
        avg_rating: number | null;
      };

      return data.map((item: ConversationStatsRow) => ({
        id: item.id,
        title: item.title,
        created_at: item.created_at,
        message_count: item.message_count,
        assistant_count: item.assistant_count,
        evaluation_count: item.evaluation_count,
        avg_rating: item.avg_rating,
      }));
    } catch (error) {
      console.error(
        '[DatasetService] Error in listDatasets:',
        error
      );
      throw new Error(
        `[DatasetService] Failed to list datasets via RPC: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async getDatasetStats(
    userId: string,
    filter?: DatasetFilter
  ): Promise<DatasetStats> {
    try {
      let convQuery = supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId);

      if (filter?.date_from) {
        convQuery = convQuery.gte('created_at', filter.date_from);
      }
      if (filter?.date_to) {
        convQuery = convQuery.lte('created_at', filter.date_to);
      }
      if (filter?.conversation_ids) {
        convQuery = convQuery.in('id', filter.conversation_ids);
      }

      const { data: conversations, error: convError } = 
        await convQuery;

      if (convError) throw convError;

      const convIds = conversations?.map(c => c.id) || [];

      const { count: totalConvCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .in('id', convIds);

      const { count: totalMsgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds);

      const { count: userMsgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .eq('role', 'user');

      const { count: assistantMsgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .eq('role', 'assistant');

      const { count: evalCount } = await supabase
        .from('message_evaluations')
        .select('*', { count: 'exact', head: true });

      const stats: DatasetStats = {
        total_conversations: totalConvCount || 0,
        total_messages: totalMsgCount || 0,
        user_messages: userMsgCount || 0,
        assistant_messages: assistantMsgCount || 0,
        evaluated_messages: evalCount || 0,
        avg_rating: null,
        successful_interactions: 0,
        failed_interactions: 0,
        evaluation_coverage: 0,
      };

      if (stats.total_messages > 0) {
        stats.evaluation_coverage = Math.round(
          (stats.evaluated_messages / stats.total_messages) * 100
        );
      }

      return stats;
    } catch (error) {
      throw new Error(
        `Failed to get dataset stats: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async exportDataset(
    userId: string,
    filter?: DatasetFilter,
    format: 'jsonl' | 'json' | 'csv' = 'jsonl',
    limit?: number
  ): Promise<DatasetExport> {
    try {
      const maxLimit = datasetConfig.maxExportSize;
      const actualLimit = limit && limit < maxLimit ? limit : maxLimit;

      // Step 1: Get conversation IDs for the user
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId);

      if (convError) {
        console.error('[DatasetService] Failed to fetch conversation IDs:', convError);
        throw convError;
      }

      const conversationIds = convData.map(c => c.id);

      if (conversationIds.length === 0) {
        return {
          format,
          total_records: 0,
          data: [],
          generated_at: new Date().toISOString(),
        };
      }

      // Step 2: Fetch messages using the retrieved conversation IDs
      let query = supabase
        .from('messages')
        .select(`
          id, conversation_id, role, content, created_at,
          token_count, model, temperature,
          message_evaluations ( rating, success, failure_tags, notes )
        `)
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true });

      // Apply date and conversation filters at the query level
      if (filter?.date_from) {
        query = query.gte('created_at', filter.date_from);
      }
      if (filter?.date_to) {
        query = query.lte('created_at', filter.date_to);
      }
      if (filter?.conversation_ids) {
        query = query.in('conversation_id', filter.conversation_ids);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[DatasetService] Export query failed:', error);
        throw error;
      }

      console.debug(`[DatasetService] Fetched ${data?.length || 0} messages before filtering`);

      // Map and filter the records
      let records = (data || []).map(msg => {
        const evalData = Array.isArray(msg.message_evaluations) 
          ? msg.message_evaluations[0] 
          : msg.message_evaluations;

        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          created_at: msg.created_at,
          token_count: msg.token_count || null,
          model: msg.model || null,
          temperature: msg.temperature || null,
          rating: evalData?.rating ?? null,
          success: evalData?.success ?? null,
          failure_tags: evalData?.failure_tags ?? null,
          notes: evalData?.notes ?? null,
        };
      });

      // Apply evaluation-based filters in JavaScript
      if (filter?.success_only) {
        console.debug('[DatasetService] Applying success_only filter');
        records = records.filter(r => r.success === true);
      }
      if (filter?.min_rating && filter.min_rating > 0) {
        const minRating = filter.min_rating;
        console.debug(`[DatasetService] Applying min_rating filter: ${minRating}`);
        records = records.filter(r => r.rating !== null && r.rating >= minRating);
      }

      // Apply limit after filtering
      const limitedRecords = records.slice(0, actualLimit);
      console.debug(`[DatasetService] Returning ${limitedRecords.length} records after filtering`);

      return {
        format,
        total_records: limitedRecords.length,
        data: limitedRecords,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[DatasetService] Error in exportDataset:', error);
      throw new Error(
        `Failed to export dataset: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Export dataset using exportService (returns download URL)
   * Supports jsonl and json formats only
   */
  async exportDatasetWithDownload(
    userId: string,
    filter?: DatasetFilter,
    format: 'jsonl' | 'json' = 'jsonl',
    limit?: number
  ): Promise<DatasetExportWithDownload> {
    console.debug('[DatasetService] exportDatasetWithDownload called', {
      userId,
      format,
      filter,
      limit,
    });

    try {
      // Step 1: Get conversation IDs matching filter
      let convQuery = supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId);

      if (filter?.date_from) {
        convQuery = convQuery.gte('created_at', filter.date_from);
      }
      if (filter?.date_to) {
        convQuery = convQuery.lte('created_at', filter.date_to);
      }
      if (filter?.conversation_ids) {
        convQuery = convQuery.in('id', filter.conversation_ids);
      }

      const { data: convData, error: convError } = await convQuery;

      if (convError) {
        console.error('[DatasetService] Failed to fetch conversation IDs:', convError);
        throw convError;
      }

      const conversationIds = (convData || []).map(c => c.id);
      console.debug('[DatasetService] Found conversation IDs:', conversationIds.length);

      if (conversationIds.length === 0) {
        throw new Error('No conversations found matching filter criteria');
      }

      // Step 2: Count messages that will be exported
      let msgQuery = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds);

      if (filter?.date_from) {
        msgQuery = msgQuery.gte('created_at', filter.date_from);
      }
      if (filter?.date_to) {
        msgQuery = msgQuery.lte('created_at', filter.date_to);
      }

      const { count: messageCount } = await msgQuery;
      const totalMessages = messageCount || 0;

      console.debug('[DatasetService] Total messages to export:', totalMessages);

      // Step 3: Call exportService to generate file
      const exportFormat: ExportFormat = format as ExportFormat;

      const exportResult: ExportResult = await exportService.generate(userId, {
        format: exportFormat,
        conversationIds,
        includeMetadata: true,
        includeSystemMessages: false,
      });

      console.debug('[DatasetService] Export generated successfully:', {
        exportId: exportResult.id,
        downloadUrl: exportResult.downloadUrl,
        fileSize: exportResult.fileSize,
      });

      // Step 4: Return result with download URL
      return {
        format,
        total_records: totalMessages,
        downloadUrl: exportResult.downloadUrl,
        exportId: exportResult.id,
        fileSize: exportResult.fileSize,
        expiresAt: exportResult.expiresAt,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[DatasetService] Error in exportDatasetWithDownload:', error);
      throw new Error(
        `Failed to export dataset with download: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async validateDataset(
    userId: string,
    filter?: DatasetFilter
  ): Promise<ValidationResult> {
    try {
      const stats = await this.getDatasetStats(userId, filter);

      const issues: string[] = [];
      const recommendations: string[] = [];

      if (stats.total_messages === 0) {
        issues.push('No messages found in dataset');
        return {
          is_valid: false,
          total_messages: 0,
          user_assistant_ratio: 0,
          evaluation_coverage: 0,
          rating_distribution: {},
          issues,
          recommendations: ['Start conversations to build training data'],
        };
      }

      const ratio = stats.user_messages > 0
        ? stats.assistant_messages / stats.user_messages
        : 0;

      if (ratio < 0.8 || ratio > 1.2) {
        issues.push(`Imbalanced user/assistant ratio: ${ratio.toFixed(2)}`);
        recommendations.push(
          'Aim for 1:1 ratio of user to assistant messages'
        );
      }

      if (stats.evaluation_coverage < 50) {
        issues.push(`Low evaluation coverage: ${stats.evaluation_coverage}%`);
        recommendations.push(
          'Evaluate more messages to improve training quality'
        );
      }

      return {
        is_valid: issues.length === 0,
        total_messages: stats.total_messages,
        user_assistant_ratio: ratio,
        evaluation_coverage: stats.evaluation_coverage,
        rating_distribution: {},
        issues,
        recommendations,
      };
    } catch (error) {
      throw new Error(
        `Failed to validate dataset: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async deleteConversations(
    userId: string,
    conversationIds: string[]
  ): Promise<{ deleted_count: number }> {
    console.debug(
      `[DatasetService] Delete requested for user ${userId}, conversations:`,
      conversationIds
    );

    try {
      // Verify ownership
      const { data: conversations, error: verifyError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .in('id', conversationIds);

      if (verifyError) throw verifyError;

      const ownedIds = conversations?.map(c => c.id) || [];
      const unauthorizedIds = conversationIds.filter(
        id => !ownedIds.includes(id)
      );

      if (unauthorizedIds.length > 0) {
        throw new Error(
          `[DatasetService] Unauthorized: User does not own conversations: ${unauthorizedIds.join(', ')}`
        );
      }

      // Delete cascade: evaluations -> messages -> conversations
      console.debug('[DatasetService] Step 1: Deleting message evaluations...');
      const { data: messageIds } = await supabase
        .from('messages')
        .select('id')
        .in('conversation_id', ownedIds);

      const msgIds = messageIds?.map(m => m.id) || [];

      if (msgIds.length > 0) {
        await supabase
          .from('message_evaluations')
          .delete()
          .in('message_id', msgIds);
      }

      console.debug('[DatasetService] Step 2: Deleting messages...');
      await supabase
        .from('messages')
        .delete()
        .in('conversation_id', ownedIds);

      console.debug('[DatasetService] Step 3: Deleting conversations...');
      const { error: deleteError } = await supabase
        .from('conversations')
        .delete()
        .in('id', ownedIds);

      if (deleteError) throw deleteError;

      console.debug(`[DatasetService] Successfully deleted ${ownedIds.length} conversations`);

      return { deleted_count: ownedIds.length };
    } catch (error) {
      console.error('[DatasetService] Error in deleteConversations:', error);
      throw new Error(
        `Failed to delete conversations: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async mergeConversations(
    userId: string,
    sourceConversationIds: string[],
    targetConversationId: string
  ): Promise<{ merged_count: number; messages_moved: number }> {
    console.debug(
      `[DatasetService] Merge requested: ${sourceConversationIds.length} conversations into ${targetConversationId}`
    );

    try {
      // Verify ownership of all conversations
      const allIds = [...sourceConversationIds, targetConversationId];
      const { data: conversations, error: verifyError } = await supabase
        .from('conversations')
        .select('id, title')
        .eq('user_id', userId)
        .in('id', allIds);

      if (verifyError) throw verifyError;

      const ownedIds = conversations?.map(c => c.id) || [];
      const unauthorizedIds = allIds.filter(id => !ownedIds.includes(id));

      if (unauthorizedIds.length > 0) {
        throw new Error(
          `[DatasetService] Unauthorized: User does not own conversations: ${unauthorizedIds.join(', ')}`
        );
      }

      if (!ownedIds.includes(targetConversationId)) {
        throw new Error(
          `[DatasetService] Target conversation ${targetConversationId} not found or not owned by user`
        );
      }

      // Move messages from source to target
      console.debug('[DatasetService] Moving messages to target conversation...');
      const { data: messages, error: fetchError } = await supabase
        .from('messages')
        .select('id')
        .in('conversation_id', sourceConversationIds);

      if (fetchError) throw fetchError;

      const messageIds = messages?.map(m => m.id) || [];

      if (messageIds.length > 0) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({ conversation_id: targetConversationId })
          .in('id', messageIds);

        if (updateError) throw updateError;
      }

      // Delete source conversations
      console.debug('[DatasetService] Deleting source conversations...');
      const { error: deleteError } = await supabase
        .from('conversations')
        .delete()
        .in('id', sourceConversationIds);

      if (deleteError) throw deleteError;

      console.debug(
        `[DatasetService] Successfully merged ${sourceConversationIds.length} conversations, moved ${messageIds.length} messages`
      );

      return {
        merged_count: sourceConversationIds.length,
        messages_moved: messageIds.length,
      };
    } catch (error) {
      console.error('[DatasetService] Error in mergeConversations:', error);
      throw new Error(
        `Failed to merge conversations: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}

const datasetService = new DatasetService();
export default datasetService;
