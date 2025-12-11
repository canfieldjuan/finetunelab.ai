/**
 * Voice Command System
 * 
 * Entry point for voice command functionality
 */

export * from './types';
export * from './voiceCommandRegistry';
export * from './coreCommands';
export * from './wakeWordDetector';
export { VoiceCommandRegistry, getVoiceCommandRegistry } from './voiceCommandRegistry';
export { registerCoreCommands } from './coreCommands';
export { WakeWordDetector, getWakeWordDetector, resetWakeWordDetector, DEFAULT_WAKE_WORD_CONFIG } from './wakeWordDetector';

// Phase 3: Conversation Loop types
export type { ConversationState, VoiceConversationConfig } from '../../hooks/useVoiceConversation';
