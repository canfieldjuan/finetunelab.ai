/**
 * Archive Service - Conversation Archiving
 *
 * Service for archiving and restoring conversations. Implements soft-delete
 * pattern with ability to restore archived conversations.
 *
 * @module lib/export/archiveService
 */

import { createClient } from '@supabase/supabase-js';
import {
  ArchiveOptions,
  ArchiveResult,
  RestoreOptions,
  RestoreResult,
  ConversationData,
  ArchivedConversationRow,
} from './types';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Archive Service
 */
export class ArchiveService {
  /**
   * Archive conversations (soft delete)
   * @param userId - User ID
   * @param options - Archive options
   * @returns Archive result with counts
   */
  async archive(userId: string, options: ArchiveOptions): Promise<ArchiveResult> {
    const { conversationIds } = options;

    if (conversationIds.length === 0) {
      return {
        archivedCount: 0,
        archivedIds: [],
        errors: [],
      };
    }

    try {
      // Use database function for bulk archive
      const { data, error } = await supabase.rpc('archive_conversations', {
        p_user_id: userId,
        p_conversation_ids: conversationIds,
      });

      if (error) {
        throw new Error(`Archive failed: ${error.message}`);
      }

      const archivedCount = data as number;

      // If permanent delete is requested, schedule for deletion
      if (options.permanentDelete) {
        // Note: Actual permanent deletion should be handled by a background job
        // Here we just mark for deletion
        await supabase
          .from('conversations')
          .update({
            metadata: {
              scheduled_for_deletion: true,
              deletion_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            }
          })
          .in('id', conversationIds)
          .eq('user_id', userId);
      }

      return {
        archivedCount,
        archivedIds: conversationIds.slice(0, archivedCount),
        errors: [],
      };
    } catch (error) {
      return {
        archivedCount: 0,
        archivedIds: [],
        errors: conversationIds.map((id) => ({
          conversationId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
      };
    }
  }

  /**
   * Restore archived conversations
   * @param userId - User ID
   * @param options - Restore options
   * @returns Restore result with counts
   */
  async restore(userId: string, options: RestoreOptions): Promise<RestoreResult> {
    const { conversationIds } = options;

    if (conversationIds.length === 0) {
      return {
        restoredCount: 0,
        restoredIds: [],
        errors: [],
      };
    }

    try {
      // Use database function for bulk restore
      const { data, error } = await supabase.rpc('restore_conversations', {
        p_user_id: userId,
        p_conversation_ids: conversationIds,
      });

      if (error) {
        throw new Error(`Restore failed: ${error.message}`);
      }

      const restoredCount = data as number;

      // Clear any scheduled deletion
      await supabase
        .from('conversations')
        .update({
          metadata: {
            scheduled_for_deletion: null,
            deletion_date: null
          }
        })
        .in('id', conversationIds)
        .eq('user_id', userId);

      return {
        restoredCount,
        restoredIds: conversationIds.slice(0, restoredCount),
        errors: [],
      };
    } catch (error) {
      return {
        restoredCount: 0,
        restoredIds: [],
        errors: conversationIds.map((id) => ({
          conversationId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
      };
    }
  }

// Note: ArchivedConversation type was used in an earlier version of this service
// where queries were made directly against archived_conversations. The current
// implementation relies on Supabase RPCs and returns ConversationData instead,
// so this interface is no longer needed.

  /**
   * Get archived conversations for a user
   * @param userId - User ID
   * @returns Array of archived conversations
   */
  async getArchived(userId: string): Promise<ConversationData[]> {
    // Use database function to get archived conversations with message counts
    const { data, error } = await supabase.rpc('get_archived_conversations', {
      p_user_id: userId,
    });

    if (error) {
      throw new Error(`Failed to get archived conversations: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Transform to ConversationData format
    return data.map((conv: ArchivedConversationRow) => ({
      id: conv.id,
      title: conv.title,
      created_at: new Date(conv.created_at),
      updated_at: new Date(conv.archived_at),
      messages: [], // Don't load full messages for archive list
      metadata: {
        archived_at: conv.archived_at,
        message_count: conv.message_count,
      },
    }));
  }

  /**
   * Permanently delete archived conversations
   * @param userId - User ID
   * @param conversationIds - Conversation IDs to delete
   * @returns Number of conversations deleted
   */
  async permanentDelete(
    userId: string,
    conversationIds: string[]
  ): Promise<number> {
    // Only allow deletion of archived conversations
    const { data, error } = await supabase
      .from('conversations')
      .delete()
      .eq('user_id', userId)
      .eq('archived', true)
      .in('id', conversationIds)
      .select('id');

    if (error) {
      throw new Error(`Permanent delete failed: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Get archive statistics for a user
   * @param userId - User ID
   * @returns Archive statistics
   */
  async getStatistics(userId: string): Promise<{
    totalArchived: number;
    totalMessages: number;
    oldestArchived: Date | null;
    newestArchived: Date | null;
  }> {
    const { data, error } = await supabase
      .from('conversations')
      .select('archived_at, id')
      .eq('user_id', userId)
      .eq('archived', true);

    if (error || !data) {
      return {
        totalArchived: 0,
        totalMessages: 0,
        oldestArchived: null,
        newestArchived: null,
      };
    }

    const totalArchived = data.length;

    // Get message counts
    const { count: messageCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in(
        'conversation_id',
        data.map((c) => c.id)
      );

    // Find oldest and newest
    const archivedDates = data
      .map((c) => new Date(c.archived_at))
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      totalArchived,
      totalMessages: messageCount || 0,
      oldestArchived: archivedDates[0] || null,
      newestArchived: archivedDates[archivedDates.length - 1] || null,
    };
  }
}

// Export singleton instance
export const archiveService = new ArchiveService();
