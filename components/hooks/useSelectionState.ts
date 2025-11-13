import { useState, useCallback } from 'react';
import { log } from '../../lib/utils/logger';

/**
 * Hook for managing multi-select mode for conversations.
 * Used for bulk operations (archive, delete).
 */
export function useSelectionState() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((convId: string) => {
    log.debug('Chat', 'Toggling selection for conversation', { conversationId: convId });
    setSelectedConvIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(convId)) {
        log.debug('Chat', 'Removing from selection', { conversationId: convId });
        newSet.delete(convId);
      } else {
        log.debug('Chat', 'Adding to selection', { conversationId: convId });
        newSet.add(convId);
      }
      log.debug('Chat', 'Total selected', { count: newSet.size });
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    log.debug('Chat', 'Clearing selection');
    setSelectedConvIds(new Set());
    setSelectMode(false);
  }, []);

  return {
    selectMode,
    setSelectMode,
    selectedConvIds,
    setSelectedConvIds,
    toggleSelection,
    clearSelection,
  };
}
