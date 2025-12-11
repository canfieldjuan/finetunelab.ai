// Memory Service - Conversation Memory Management
// Phase 1.2c: Conversation-level memory functions
// Date: October 10, 2025

import { supabase } from '../supabaseClient';

/**
 * Save or update conversation memory
 */
export async function saveConversationMemory(
  conversationId: string,
  key: string,
  value: unknown
): Promise<{ error: string | null }> {
  console.log('[MemoryService] Saving conversation memory:', conversationId, key);
  
  const { error } = await supabase
    .from('conversation_memory')
    .upsert({
      conversation_id: conversationId,
      memory_key: key,
      memory_value: value,
      updated_at: new Date().toISOString(),
    });
  
  if (error) {
    console.error('[MemoryService] Error saving memory:', error);
    return { error: error.message };
  }
  
  return { error: null };
}

/**
 * Get a single conversation memory by key
 */
export async function getConversationMemory(
  conversationId: string,
  key: string
): Promise<{ data: unknown; error: string | null }> {
  console.log('[MemoryService] Getting conversation memory:', conversationId, key);
  
  const { data, error } = await supabase
    .from('conversation_memory')
    .select('memory_value')
    .eq('conversation_id', conversationId)
    .eq('memory_key', key)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[MemoryService] Error getting memory:', error);
    return { data: null, error: error.message };
  }
  
  return { 
    data: data?.memory_value || null, 
    error: null 
  };
}
