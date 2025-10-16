// Memory Hook - React integration for memory system
// Phase 1.3: Custom hook for user preferences and conversation memory
// Date: October 10, 2025

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  saveUserPreference,
  getUserPreference,
  getAllUserPreferences,
  saveConversationMemory,
  getConversationMemory,
  getAllConversationMemory,
  deleteUserPreference,
  UserPreference,
  ConversationMemory,
} from '@/lib/memory';

export function useMemory(currentConversationId?: string) {
  const { user } = useAuth();
  const [userPreferences, setUserPreferences] = useState<UserPreference[]>([]);
  const [conversationMemories, setConversationMemories] = useState<ConversationMemory[]>([]);
  const [loading, setLoading] = useState(false);

  // ============================================
  // AUTO-LOAD USER PREFERENCES ON USER CHANGE
  // ============================================
  useEffect(() => {
    async function loadUserPreferences() {
      if (!user?.id) {
        setUserPreferences([]);
        return;
      }

      console.log('[useMemory] Loading user preferences for:', user.id);
      setLoading(true);
      const { data, error } = await getAllUserPreferences(user.id);
      setLoading(false);

      if (error) {
        console.error('[useMemory] Error loading preferences:', error);
        return;
      }

      setUserPreferences(data);
      console.log('[useMemory] Loaded', data.length, 'user preferences');
    }

    loadUserPreferences();
  }, [user?.id]);

  // ============================================
  // AUTO-LOAD CONVERSATION MEMORY ON CONVERSATION CHANGE
  // ============================================
  useEffect(() => {
    async function loadConversationMemory() {
      if (!currentConversationId) {
        setConversationMemories([]);
        return;
      }

      console.log('[useMemory] Loading conversation memory for:', currentConversationId);
      setLoading(true);
      const { data, error } = await getAllConversationMemory(currentConversationId);
      setLoading(false);

      if (error) {
        console.error('[useMemory] Error loading memories:', error);
        return;
      }

      setConversationMemories(data);
      console.log('[useMemory] Loaded', data.length, 'conversation memories');
    }

    loadConversationMemory();
  }, [currentConversationId]);

  // ============================================
  // USER PREFERENCE METHODS
  // ============================================
  const setPreference = useCallback(
    async (key: string, value: unknown, isPersistent: boolean = false) => {
      if (!user?.id) {
        console.warn('[useMemory] Cannot set preference: no user');
        return { error: 'No user logged in' };
      }

      const result = await saveUserPreference(user.id, key, value, isPersistent);
      
      if (!result.error) {
        // Update local state
        setUserPreferences((prev) => {
          const existing = prev.findIndex((p) => p.key === key);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { key, value, isPersistent };
            return updated;
          }
          return [...prev, { key, value, isPersistent }];
        });
      }

      return result;
    },
    [user?.id]
  );

  const getPreference = useCallback(
    async (key: string) => {
      if (!user?.id) {
        return { data: null, error: 'No user logged in' };
      }
      return getUserPreference(user.id, key);
    },
    [user?.id]
  );

  const removePreference = useCallback(
    async (key: string) => {
      if (!user?.id) {
        return { error: 'No user logged in' };
      }

      const result = await deleteUserPreference(user.id, key);
      
      if (!result.error) {
        setUserPreferences((prev) => prev.filter((p) => p.key !== key));
      }

      return result;
    },
    [user?.id]
  );

  // ============================================
  // CONVERSATION MEMORY METHODS
  // ============================================
  const setMemory = useCallback(
    async (key: string, value: unknown) => {
      if (!currentConversationId) {
        console.warn('[useMemory] Cannot set memory: no conversation');
        return { error: 'No active conversation' };
      }

      const result = await saveConversationMemory(currentConversationId, key, value);
      
      if (!result.error) {
        // Update local state
        setConversationMemories((prev) => {
          const existing = prev.findIndex((m) => m.key === key);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { key, value };
            return updated;
          }
          return [...prev, { key, value }];
        });
      }

      return result;
    },
    [currentConversationId]
  );

  const getMemory = useCallback(
    async (key: string) => {
      if (!currentConversationId) {
        return { data: null, error: 'No active conversation' };
      }
      return getConversationMemory(currentConversationId, key);
    },
    [currentConversationId]
  );

  return {
    // State
    userPreferences,
    conversationMemories,
    loading,
    
    // User preference methods
    setPreference,
    getPreference,
    removePreference,
    
    // Conversation memory methods
    setMemory,
    getMemory,
  };
}
