
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import type { SidebarConversation } from '../chat/types';


/**
 * A hook for managing the conversation state.
 * @param userId - The ID of the current user.
 * @param isWidgetMode - Whether the chat is in widget mode.
 * @returns The conversation state.
 */
export function useConversationState(userId: string | null, isWidgetMode: boolean) {
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
      log.debug('useConversationState', 'Fetching conversations for user', { userId });
      const { data, error: convoError } = await supabase
        .from('conversations')
        .select('*, messages(count)')
        .eq('user_id', userId)
        .eq('archived', false)
        .order('created_at', { ascending: false });

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
        setDebugInfo(`No conversations found. User ID: ${userId}`);
      } else {
        setDebugInfo('');
      }

      return list;
    } catch (err: any) {
      log.error('useConversationState', 'Error fetching conversations', { error: err });
      setError(`Failed to load conversations: ${err.message}`);
      setConversations([]);
      setActiveId('');
      return [];
    }
  }, [userId, isWidgetMode]);

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
