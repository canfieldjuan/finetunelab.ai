
import { useState, useMemo } from 'react';
import type { SidebarConversation } from '../chat/types';

export function useConversationSearch(conversations: SidebarConversation[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const handleToggleSelection = (convId: string) => {
    setSelectedConvIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(convId)) {
        newSet.delete(convId);
      } else {
        newSet.add(convId);
      }
      return newSet;
    });
  };

  return {
    searchQuery,
    setSearchQuery,
    searchExpanded,
    setSearchExpanded,
    selectMode,
    setSelectMode,
    selectedConvIds,
    setSelectedConvIds,
    filteredConversations,
    handleToggleSelection,
  };
}
