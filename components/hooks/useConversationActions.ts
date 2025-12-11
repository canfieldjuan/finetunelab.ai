
import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import { logSessionEvent } from '../../lib/sessionLogs';
import type { Session } from '@supabase/supabase-js';


/**
 * A hook for managing conversation actions.
 * @param userId - The ID of the current user.
 * @param session - The current session.
 * @param activeId - The active conversation ID.
 * @param fetchConversations - A function to fetch conversations.
 * @param workspaceId - Optional workspace ID for new conversations.
 * @returns The conversation actions.
 */
export function useConversationActions(
  userId: string | null, 
  session: Session | null, 
  activeId: string, 
  fetchConversations: () => void,
  workspaceId?: string | null
) {

  const handleNewConversation = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const insertData: { user_id: string; title: string; workspace_id?: string } = {
        user_id: userId,
        title: "New Chat"
      };

      // Include workspace_id if provided
      if (workspaceId !== undefined && workspaceId !== null) {
        insertData.workspace_id = workspaceId;
      }

      const { data, error: insertError } = await supabase
        .from("conversations")
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      if (data) {
        await logSessionEvent(userId, "conversation_created", data.id);
        await fetchConversations();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error('useConversationActions', 'Error creating conversation', { error: errorMessage });
    }
  }, [userId, fetchConversations, workspaceId]);

  const handlePromoteConversation = async (conversationId: string) => {
    if (!userId) return;

    try {
      const authToken = session?.access_token;
      if (!authToken) {
        throw new Error("No auth token available");
      }

      const response = await fetch("/api/conversations/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ conversationId })
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || "Failed to promote");
      }

      await fetchConversations();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error('useConversationActions', 'Error promoting conversation', { error: errorMessage });
    }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    if (!userId) {
      return;
    }

    try {
      await supabase.from('conversations').update({ archived: true }).eq('id', conversationId);
      await fetchConversations();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error('useConversationActions', 'Error archiving conversation', { error: errorMessage });
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!userId) return;

    try {
      await supabase.from('conversations').delete().eq('id', conversationId);
      await fetchConversations();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error('useConversationActions', 'Error deleting conversation', { error: errorMessage });
    }
  };

  const handleBulkArchive = async (conversationIds: string[]) => {
    if (!userId) {
      return;
    }

    try {
      await supabase.from('conversations').update({ archived: true }).in('id', conversationIds);
      await fetchConversations();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error('useConversationActions', 'Error bulk archiving conversations', { error: errorMessage });
    }
  };

  const handleBulkDelete = async (conversationIds: string[]): Promise<{ successCount: number; errorCount: number; deletedIds: string[] }> => {
    if (!userId) {
      return { successCount: 0, errorCount: conversationIds.length, deletedIds: [] };
    }

    let successCount = 0;
    let errorCount = 0;
    const deletedIds: string[] = [];

    for (const convId of conversationIds) {
      try {
        log.debug('useConversationActions', 'Deleting conversation', { conversationId: convId });

        const { error: deleteError } = await supabase
          .from('conversations')
          .delete()
          .eq('id', convId)
          .eq('user_id', userId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        successCount++;
        deletedIds.push(convId);
        log.debug('useConversationActions', 'Successfully deleted conversation', { conversationId: convId });
        await logSessionEvent(userId, 'conversation_deleted', convId);
      } catch (err) {
        errorCount++;
        log.error('useConversationActions', 'Failed to delete conversation', { conversationId: convId, error: err });
      }
    }

    log.debug('useConversationActions', 'Bulk delete complete', { successCount, errorCount });

    await fetchConversations();

    return { successCount, errorCount, deletedIds };
  };

  const handleSessionChange = async (sessionId: string, experimentName: string) => {
    if (!activeId || !userId) {
      return;
    }

    try {
      await supabase.from('conversations').update({ session_id: sessionId, experiment_name: experimentName }).eq('id', activeId);
      await fetchConversations();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error('useConversationActions', 'Error changing session', { error: errorMessage });
    }
  };

  const handleClearSession = async () => {
    if (!activeId || !userId) {
      return;
    }

    try {
      await supabase.from('conversations').update({ session_id: null, experiment_name: null }).eq('id', activeId);
      await fetchConversations();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error('useConversationActions', 'Error clearing session', { error: errorMessage });
    }
  };

  return {
    handleNewConversation,
    handlePromoteConversation,
    handleArchiveConversation,
    handleDeleteConversation,
    handleBulkArchive,
    handleBulkDelete,
    handleSessionChange,
    handleClearSession,
  };
}
