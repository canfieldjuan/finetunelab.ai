import { useState, useMemo } from 'react';
import type { SidebarConversation } from '../chat/types';

/**
 * Hook for managing conversation search state.
 * Includes search query, expanded state, and filtered conversations.
 */
export function useSearchState(conversations: SidebarConversation[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    searchExpanded,
    setSearchExpanded,
    filteredConversations,
  };
}
