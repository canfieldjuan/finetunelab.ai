
import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { log } from '../../lib/utils/logger';
import type { SidebarConversation } from '../chat/types';

export function useConversations(userId: string | null, isWidgetMode: boolean) {
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
      log.debug('useConversations', 'Fetching conversations for user', { userId });
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
    } catch (err: unknown) {
      log.error('useConversations', 'Error fetching conversations', { error: err });
      if (err instanceof Error) {
        setError(`Failed to load conversations: ${err.message}`);
      } else {
        setError('An unknown error occurred while fetching conversations.');
      }
      setConversations([]);
      setActiveId('');
      return [];
    }
  }, [userId, isWidgetMode]);

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
