// Memory Service - User Preferences Management
// Phase 1.2a: User-level preference functions
// Date: October 10, 2025

import { supabase } from '../supabaseClient';

export interface UserPreference {
  key: string;
  value: unknown;
  isPersistent: boolean;
}

export interface ConversationMemory {
  key: string;
  value: unknown;
}

// ============================================
// USER PREFERENCE FUNCTIONS
// ============================================

/**
 * Save or update a user preference
 */
export async function saveUserPreference(
  userId: string,
  key: string,
  value: unknown,
  isPersistent: boolean = false
): Promise<{ error: string | null }> {
  console.log('[MemoryService] Saving user preference:', key, 'persistent:', isPersistent);
  
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      preference_key: key,
      preference_value: value,
      is_persistent: isPersistent,
      updated_at: new Date().toISOString(),
    });
  
  if (error) {
    console.error('[MemoryService] Error saving preference:', error);
    return { error: error.message };
  }
  
  return { error: null };
}
