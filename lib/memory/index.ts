// Memory Service - Main Export
// Phase 1.2e: Unified exports for memory system
// Date: October 10, 2025

// Type exports
export type { UserPreference, ConversationMemory } from './userPreferences';

// User preference functions
export { saveUserPreference } from './userPreferences';
export { getUserPreference, getAllUserPreferences } from './getUserPreferences';

// Conversation memory functions
export { 
  saveConversationMemory, 
  getConversationMemory 
} from './conversationMemory';

// Bulk operations
export { 
  getAllConversationMemory, 
  deleteUserPreference 
} from './bulkOperations';
