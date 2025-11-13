// Memory Service - Get All Conversation Memories
// Phase 1.2d: Bulk retrieval functions
// Date: October 10, 2025

import { supabase } from '../supabaseClient';
import { ConversationMemory } from './userPreferences';

/**
 * Get all memories for a conversation
 */
export async function getAllConversationMemory(
  conversationId: string
): Promise<{ data: ConversationMemory[]; error: string | null }> {
  console.log('[MemoryService] Getting all conversation memory:', conversationId);
  
  const { data, error } = await supabase
    .from('conversation_memory')
    .select('memory_key, memory_value')
    .eq('conversation_id', conversationId);
  
  if (error) {
    console.error('[MemoryService] Error getting memories:', error);
    return { data: [], error: error.message };
  }
  
  const memories = data?.map(m => ({
    key: m.memory_key,
    value: m.memory_value,
  })) || [];
  
  return { data: memories, error: null };
}

/**
 * Delete a user preference
 */
export async function deleteUserPreference(
  userId: string,
  key: string
): Promise<{ error: string | null }> {
  console.log('[MemoryService] Deleting user preference:', key);
  
  const { error } = await supabase
    .from('user_preferences')
    .delete()
    .eq('user_id', userId)
    .eq('preference_key', key);
  
  if (error) {
    console.error('[MemoryService] Error deleting preference:', error);
    return { error: error.message };
  }
  
  return { error: null };
}
