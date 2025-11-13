
import { useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import { logSessionEvent } from '../../lib/sessionLogs';


/**
 * A hook for managing conversation actions.
 * @param userId - The ID of the current user.
 * @param session - The current session.
 * @param activeId - The active conversation ID.
 * @param fetchConversations - A function to fetch conversations.
 * @returns The conversation actions.
 */
export function useConversationActions(userId: string | null, session: any, activeId: string, fetchConversations: () => void) {

  const handleNewConversation = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title: "New Chat" })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      if (data) {
        await logSessionEvent(userId, "conversation_created", data.id);
        await fetchConversations();
      }
    } catch (err: any) {
      log.error('useConversationActions', 'Error creating conversation', { error: err });
    }
  }, [userId, fetchConversations]);

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
    } catch (err: any) {
      log.error('useConversationActions', 'Error promoting conversation', { error: err });
    }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    if (!userId) {
      return;
    }

    try {
      await supabase.from('conversations').update({ archived: true }).eq('id', conversationId);
      await fetchConversations();
    } catch (err: any) {
      log.error('useConversationActions', 'Error archiving conversation', { error: err });
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!userId) return;

    try {
      await supabase.from('conversations').delete().eq('id', conversationId);
      await fetchConversations();
    } catch (err: any) {
      log.error('useConversationActions', 'Error deleting conversation', { error: err });
    }
  };

  const handleBulkArchive = async (conversationIds: string[]) => {
    if (!userId) {
      return;
    }

    try {
      await supabase.from('conversations').update({ archived: true }).in('id', conversationIds);
      await fetchConversations();
    } catch (err: any) {
      log.error('useConversationActions', 'Error bulk archiving conversations', { error: err });
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
    } catch (err: any) {
      log.error('useConversationActions', 'Error changing session', { error: err });
    }
  };

  const handleClearSession = async () => {
    if (!activeId || !userId) {
      return;
    }

    try {
      await supabase.from('conversations').update({ session_id: null, experiment_name: null }).eq('id', activeId);
      await fetchConversations();
    } catch (err: any) {
      log.error('useConversationActions', 'Error clearing session', { error: err });
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
