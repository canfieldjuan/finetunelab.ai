// Memory Service - User Preferences Retrieval
// Phase 1.2b: Get user preference functions
// Date: October 10, 2025

import { supabase } from '../supabaseClient';
import { UserPreference } from './userPreferences';

/**
 * Get a single user preference by key
 */
export async function getUserPreference(
  userId: string,
  key: string
): Promise<{ data: unknown; error: string | null }> {
  console.log('[MemoryService] Getting user preference:', key);
  
  const { data, error } = await supabase
    .from('user_preferences')
    .select('preference_value')
    .eq('user_id', userId)
    .eq('preference_key', key)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[MemoryService] Error getting preference:', error);
    return { data: null, error: error.message };
  }
  
  return { 
    data: data?.preference_value || null, 
    error: null 
  };
}

/**
 * Get all user preferences
 */
export async function getAllUserPreferences(
  userId: string,
  persistentOnly: boolean = false
): Promise<{ data: UserPreference[]; error: string | null }> {
  console.log('[MemoryService] Getting all preferences, persistent only:', persistentOnly);
  
  let query = supabase
    .from('user_preferences')
    .select('preference_key, preference_value, is_persistent')
    .eq('user_id', userId);
  
  if (persistentOnly) {
    query = query.eq('is_persistent', true);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[MemoryService] Error getting preferences:', error);
    return { data: [], error: error.message };
  }
  
  const preferences = data?.map(p => ({
    key: p.preference_key,
    value: p.preference_value,
    isPersistent: p.is_persistent,
  })) || [];
  
  return { data: preferences, error: null };
}
