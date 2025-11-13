/**
 * Voice Command System Types
 * 
 * Defines interfaces for voice command infrastructure
 */

/**
 * Voice command categories for organization and filtering
 */
export type VoiceCommandCategory = 
  | 'navigation'   // UI navigation commands (dark mode, new chat, etc.)
  | 'control'      // Playback/voice control (stop, repeat, etc.)
  | 'chat'         // Chat-specific actions (send, clear, etc.)
  | 'search'       // Search and query commands
  | 'settings';    // Settings and preferences

/**
 * Parameters extracted from voice command
 */
export interface VoiceCommandParams {
  [key: string]: string | number | boolean;
}

/**
 * Voice command context with UI handlers
 * Passed to command handlers that need to interact with UI
 */
export interface VoiceCommandContext {
  handleSend?: () => void;
  setInput?: (value: string) => void;
  handleStop?: () => void;
  signOut?: () => void;
  enableVoice?: () => void;
  disableVoice?: () => void;
  [key: string]: unknown;
}

/**
 * Voice command definition
 */
export interface VoiceCommand {
  /** Unique identifier for the command */
  id: string;
  
  /** Regular expression patterns that match this command */
  patterns: RegExp[];
  
  /** Human-readable description of what the command does */
  description: string;
  
  /** Category for organization */
  category: VoiceCommandCategory;
  
  /** Action identifier for command */
  action: string;
  
  /** Handler function executed when command is detected */
  handler: (params?: VoiceCommandParams, context?: VoiceCommandContext) => void | Promise<void>;
  
  /** Optional permissions required to execute (future use) */
  requiredPermissions?: string[];
  
  /** Optional parameter extractor function */
  extractParams?: (transcript: string, match: RegExpMatchArray) => VoiceCommandParams;
  
  /** Optional parameter definitions for documentation */
  parameters?: Record<string, { type: string; description: string }>;
}

/**
 * Result of command matching
 */
export interface CommandMatchResult {
  /** The matched command */
  command: VoiceCommand;
  
  /** The original transcript that triggered the match */
  transcript: string;
  
  /** Extracted parameters from the command */
  params?: VoiceCommandParams;
  
  /** Confidence score (0-1, if applicable) */
  confidence?: number;
}
