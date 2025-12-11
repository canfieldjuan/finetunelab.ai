
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import type { SidebarConversation } from '../chat/types';


/**
 * A hook for managing the conversation state.
 * @param userId - The ID of the current user.
 * @param isWidgetMode - Whether the chat is in widget mode.
 * @param workspaceId - Optional workspace ID to filter conversations.
 * @param workspaceType - Optional workspace type (e.g. 'personal'|'team'). When set to 'personal'
 *                        we include conversations with NULL workspace_id so legacy chats remain visible.
 * @returns The conversation state.
 */
export function useConversationState(
  userId: string | null, 
  isWidgetMode: boolean,
  workspaceId?: string | null,
  workspaceType?: string | null,
) {
  const [conversations, setConversations] = useState<SidebarConversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const fetchConversations = useCallback(async (): Promise<SidebarConversation[]> => {
    if (!userId || isWidgetMode) {
      setConversations([]);
      setActiveId('');
      return [];
    }

    try {
      log.debug('useConversationState', 'Fetching conversations for user', { userId, workspaceId });
      
      // Build query with optional workspace filter
      let query = supabase
        .from('conversations')
        .select('*, messages(count)')
        .eq('user_id', userId)
        .eq('archived', false);

      // Add workspace filter if provided
      if (workspaceId !== undefined && workspaceId !== null) {
        // If workspace is a personal workspace, include legacy conversations with NULL workspace_id
        if (workspaceType === 'personal') {
          // Build an OR filter: workspace_id = <id> OR workspace_id IS NULL
          query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
        } else {
          query = query.eq('workspace_id', workspaceId);
        }
      }

      const { data, error: convoError } = await query.order('created_at', { ascending: false });

      if (convoError) {
        throw convoError;
      }

      const list = (data ?? []).map(conv => ({
        ...conv,
        message_count: Array.isArray(conv.messages) ? conv.messages[0]?.count || 0 : 0,
      }));
      
      setConversations(list);
      setActiveId((prev) => (prev && list.some((conv) => conv.id === prev) ? prev : list[0]?.id || ''));

      if (list.length === 0) {
        setDebugInfo(`No conversations found. User ID: ${userId}, Workspace: ${workspaceId || 'all'}`);
      } else {
        setDebugInfo('');
      }

      return list;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error('useConversationState', 'Error fetching conversations', { error: err });
      setError(`Failed to load conversations: ${errorMessage}`);
      setConversations([]);
      setActiveId('');
      return [];
    }
  }, [userId, isWidgetMode, workspaceId, workspaceType]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    setConversations,
    activeId,
    setActiveId,
    error,
    setError,
    debugInfo,
    setDebugInfo,
    fetchConversations,
  };
}
