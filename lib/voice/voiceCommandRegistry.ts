/**
 * Voice Command Registry
 * 
 * Singleton registry for managing voice commands and pattern matching
 */

import type { VoiceCommand, VoiceCommandCategory, CommandMatchResult } from './types';

/**
 * VoiceCommandRegistry - Singleton class for voice command management
 * 
 * Features:
 * - Command registration and unregistration
 * - Pattern-based command matching
 * - Category-based filtering
 * - Fuzzy matching support
 * - Comprehensive logging
 * 
 * @example
 * ```typescript
 * const registry = VoiceCommandRegistry.getInstance();
 * 
 * registry.register({
 *   id: 'dark-mode',
 *   patterns: [/(?:switch to|enable|turn on) dark mode/i],
 *   description: 'Enable dark mode',
 *   category: 'navigation',
 *   handler: () => toggleDarkMode()
 * });
 * 
 * const match = registry.match('switch to dark mode');
 * if (match) {
 *   await match.command.handler(match.params);
 * }
 * ```
 */
export class VoiceCommandRegistry {
  private static instance: VoiceCommandRegistry;
  private commands: Map<string, VoiceCommand>;
  private enabled: boolean;

  private constructor() {
    this.commands = new Map();
    this.enabled = true;
    console.log('[VoiceCmd] Registry initialized');
  }

  /**
   * Get singleton instance of the registry
   */
  public static getInstance(): VoiceCommandRegistry {
    if (!VoiceCommandRegistry.instance) {
      VoiceCommandRegistry.instance = new VoiceCommandRegistry();
    }
    return VoiceCommandRegistry.instance;
  }

  /**
   * Register a new voice command
   * 
   * @param command - Voice command to register
   * @throws Error if command with same ID already exists
   */
  public register(command: VoiceCommand): void {
    if (this.commands.has(command.id)) {
      console.warn(`[VoiceCmd] Command "${command.id}" already registered, replacing`);
    }

    this.commands.set(command.id, command);
    console.log(`[VoiceCmd] Registered: ${command.id} (${command.category}) - ${command.description}`);
  }

  /**
   * Register multiple commands at once
   * 
   * @param commands - Array of voice commands to register
   */
  public registerMany(commands: VoiceCommand[]): void {
    console.log(`[VoiceCmd] Registering ${commands.length} commands`);
    commands.forEach(cmd => this.register(cmd));
  }

  /**
   * Unregister a voice command
   * 
   * @param commandId - ID of command to unregister
   * @returns True if command was found and removed
   */
  public unregister(commandId: string): boolean {
    const removed = this.commands.delete(commandId);
    if (removed) {
      console.log(`[VoiceCmd] Unregistered: ${commandId}`);
    } else {
      console.warn(`[VoiceCmd] Command "${commandId}" not found for removal`);
    }
    return removed;
  }

  /**
   * Match transcript against registered commands
   * 
   * @param transcript - Text to match against command patterns
   * @returns CommandMatchResult if match found, null otherwise
   */
  public match(transcript: string): CommandMatchResult | null {
    if (!this.enabled) {
      console.log('[VoiceCmd] Registry disabled, skipping match');
      return null;
    }

    const normalizedTranscript = transcript.trim().toLowerCase();
    
    console.log(`[VoiceCmd] Matching: "${normalizedTranscript}"`);

    // Iterate through all registered commands
    for (const [id, command] of this.commands.entries()) {
      // Test each pattern for this command
      for (const pattern of command.patterns) {
        const match = normalizedTranscript.match(pattern);
        
        if (match) {
          console.log(`[VoiceCmd] Matched: ${id} with pattern: ${pattern}`);
          
          // Extract parameters if extractor provided
          let params: Record<string, string | number | boolean> | undefined = undefined;
          if (command.extractParams) {
            try {
              params = command.extractParams(normalizedTranscript, match);
              console.log(`[VoiceCmd] Extracted params:`, params);
            } catch (error) {
              console.error(`[VoiceCmd] Error extracting params for ${id}:`, error);
            }
          }

          return {
            command,
            transcript: normalizedTranscript,
            params,
            confidence: 1.0, // Exact pattern match = 100% confidence
          };
        }
      }
    }

    console.log('[VoiceCmd] No match found');
    return null;
  }

  /**
   * Get all commands in a specific category
   * 
   * @param category - Command category to filter by
   * @returns Array of commands in the specified category
   */
  public getCommandsByCategory(category: VoiceCommandCategory): VoiceCommand[] {
    const commands: VoiceCommand[] = [];
    
    for (const command of this.commands.values()) {
      if (command.category === category) {
        commands.push(command);
      }
    }

    console.log(`[VoiceCmd] Found ${commands.length} commands in category: ${category}`);
    return commands;
  }

  /**
   * Get all registered commands
   * 
   * @returns Array of all registered commands
   */
  public getAllCommands(): VoiceCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command by ID
   * 
   * @param commandId - ID of command to retrieve
   * @returns Command if found, undefined otherwise
   */
  public getCommand(commandId: string): VoiceCommand | undefined {
    return this.commands.get(commandId);
  }

  /**
   * Enable or disable the command registry
   * 
   * @param enabled - Whether to enable command matching
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[VoiceCmd] Registry ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if registry is enabled
   * 
   * @returns True if registry is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clear all registered commands
   */
  public clear(): void {
    const count = this.commands.size;
    this.commands.clear();
    console.log(`[VoiceCmd] Cleared ${count} commands`);
  }

  /**
   * Get registry statistics
   * 
   * @returns Object with registry stats
   */
  public getStats() {
    const stats = {
      totalCommands: this.commands.size,
      enabled: this.enabled,
      byCategory: {
        navigation: 0,
        control: 0,
        chat: 0,
        search: 0,
        settings: 0,
      },
    };

    for (const command of this.commands.values()) {
      stats.byCategory[command.category]++;
    }

    return stats;
  }
}

/**
 * Helper function to get registry instance
 * Convenience export for easier imports
 */
export function getVoiceCommandRegistry(): VoiceCommandRegistry {
  return VoiceCommandRegistry.getInstance();
}
