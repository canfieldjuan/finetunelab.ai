/**
 * Core Voice Commands Registry
 * 
 * Defines default voice commands for common actions:
 * - Navigation: chat, models, settings, etc.
 * - Control: send, clear, stop, etc.
 * - Chat: new conversation
 * - Search: search functionality (future)
 * - Settings: voice/accessibility settings
 */

import { VoiceCommand } from './types';
import { VoiceCommandRegistry } from './voiceCommandRegistry';

/**
 * Navigation Commands
 * Navigate to different pages in the application
 */
const navigationCommands: VoiceCommand[] = [
  {
    id: 'nav-chat',
    patterns: [/^(go to |open |show )?(chat|conversations?)$/i],
    category: 'navigation',
    action: 'navigate-chat',
    description: 'Navigate to chat page',
    handler: () => {
      console.log('[VoiceCmd] Navigating to chat');
      window.location.href = '/chat';
    }
  },
  {
    id: 'nav-models',
    patterns: [/^(go to |open |show )?(models?|ai models?)$/i],
    category: 'navigation',
    action: 'navigate-models',
    description: 'Navigate to models page',
    handler: () => {
      console.log('[VoiceCmd] Navigating to models');
      window.location.href = '/models';
    }
  },
  {
    id: 'nav-settings',
    patterns: [/^(go to |open |show )?settings?$/i],
    category: 'navigation',
    action: 'navigate-settings',
    description: 'Navigate to settings page',
    handler: () => {
      console.log('[VoiceCmd] Navigating to settings');
      window.location.href = '/settings';
    }
  },
  {
    id: 'nav-training',
    patterns: [/^(go to |open |show )?training$/i],
    category: 'navigation',
    action: 'navigate-training',
    description: 'Navigate to training page',
    handler: () => {
      console.log('[VoiceCmd] Navigating to training');
      window.location.href = '/training';
    }
  },
  {
    id: 'nav-analytics',
    patterns: [/^(go to |open |show )?analytics?$/i],
    category: 'navigation',
    action: 'navigate-analytics',
    description: 'Navigate to analytics page',
    handler: () => {
      console.log('[VoiceCmd] Navigating to analytics');
      window.location.href = '/analytics';
    }
  }
];

/**
 * Control Commands
 * Control chat functionality (send, clear, stop)
 */
const controlCommands: VoiceCommand[] = [
  {
    id: 'control-send',
    patterns: [/^send( message)?$/i],
    category: 'control',
    action: 'send-message',
    description: 'Send the current message',
    handler: (_params, context) => {
      console.log('[VoiceCmd] Send message command');
      // Handler will be set by Chat component with actual handleSend function
      if (context?.handleSend) {
        context.handleSend();
      } else {
        console.warn('[VoiceCmd] handleSend not available in context');
      }
    }
  },
  {
    id: 'control-clear',
    patterns: [/^clear( input| text| message)?$/i],
    category: 'control',
    action: 'clear-input',
    description: 'Clear the input field',
    handler: (_params, context) => {
      console.log('[VoiceCmd] Clear input command');
      // Handler will be set by Chat component with actual setInput function
      if (context?.setInput) {
        context.setInput('');
      } else {
        console.warn('[VoiceCmd] setInput not available in context');
      }
    }
  },
  {
    id: 'control-stop',
    patterns: [/^stop( generation| response)?$/i],
    category: 'control',
    action: 'stop-generation',
    description: 'Stop the current AI response',
    handler: (_params, context) => {
      console.log('[VoiceCmd] Stop generation command');
      // Handler will be set by Chat component with actual handleStop function
      if (context?.handleStop) {
        context.handleStop();
      } else {
        console.warn('[VoiceCmd] handleStop not available in context');
      }
    }
  }
];

/**
 * Chat Commands
 * Manage conversations
 */
const chatCommands: VoiceCommand[] = [
  {
    id: 'chat-new',
    patterns: [/^new (chat|conversation)$/i],
    category: 'chat',
    action: 'new-chat',
    description: 'Start a new conversation',
    handler: () => {
      console.log('[VoiceCmd] Creating new chat');
      window.location.href = '/chat';
    }
  },
  {
    id: 'chat-logout',
    patterns: [/^(log ?out|sign ?out)$/i],
    category: 'chat',
    action: 'logout',
    description: 'Sign out of the application',
    handler: (_params, context) => {
      console.log('[VoiceCmd] Logging out');
      // Handler will be set by Chat component with actual signOut function
      if (context?.signOut) {
        context.signOut();
      } else {
        console.warn('[VoiceCmd] signOut not available in context');
      }
    }
  }
];

/**
 * Search Commands (placeholder for future implementation)
 */
const searchCommands: VoiceCommand[] = [
  {
    id: 'search-messages',
    patterns: [/^search (for )?(.+)$/i],
    category: 'search',
    action: 'search',
    description: 'Search messages',
    parameters: {
      query: { type: 'string', description: 'Search query' }
    },
    handler: (params) => {
      console.log('[VoiceCmd] Search command', { query: params?.query });
      console.warn('[VoiceCmd] Search functionality not yet implemented');
    }
  }
];

/**
 * Settings Commands
 * Voice and accessibility settings
 */
const settingsCommands: VoiceCommand[] = [
  {
    id: 'settings-voice-on',
    patterns: [/^(turn on|enable) voice$/i],
    category: 'settings',
    action: 'enable-voice',
    description: 'Enable voice recognition',
    handler: (_params, context) => {
      console.log('[VoiceCmd] Enable voice');
      if (context?.enableVoice) {
        context.enableVoice();
      } else {
        console.warn('[VoiceCmd] enableVoice not available in context');
      }
    }
  },
  {
    id: 'settings-voice-off',
    patterns: [/^(turn off|disable) voice$/i],
    category: 'settings',
    action: 'disable-voice',
    description: 'Disable voice recognition',
    handler: (_params, context) => {
      console.log('[VoiceCmd] Disable voice');
      if (context?.disableVoice) {
        context.disableVoice();
      } else {
        console.warn('[VoiceCmd] disableVoice not available in context');
      }
    }
  }
];

/**
 * Register all core commands on module load
 */
export function registerCoreCommands(): void {
  console.log('[VoiceCmd] Registering core voice commands...');
  
  const registry = VoiceCommandRegistry.getInstance();
  const allCommands = [
    ...navigationCommands,
    ...controlCommands,
    ...chatCommands,
    ...searchCommands,
    ...settingsCommands
  ];

  allCommands.forEach(cmd => registry.register(cmd));
  
  console.log(`[VoiceCmd] Registered ${allCommands.length} core commands`, {
    navigation: navigationCommands.length,
    control: controlCommands.length,
    chat: chatCommands.length,
    search: searchCommands.length,
    settings: settingsCommands.length
  });
}

/**
 * Export command arrays for testing/documentation
 */
export {
  navigationCommands,
  controlCommands,
  chatCommands,
  searchCommands,
  settingsCommands
};
