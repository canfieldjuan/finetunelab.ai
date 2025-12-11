/**
 * Voice Command Test Script
 * 
 * Run this in browser console to test voice command detection
 * 
 * Usage:
 * 1. Import in a component or run in console
 * 2. Call testVoiceCommands() to see all registered commands
 * 3. Call testCommandMatch('send message') to test pattern matching
 */

import { VoiceCommandRegistry, registerCoreCommands } from './index';

/**
 * Test command registration
 */
export function testVoiceCommands(): void {
  console.log('=== Voice Command System Test ===\n');
  
  // Register core commands
  registerCoreCommands();
  
  const registry = VoiceCommandRegistry.getInstance();
  const stats = registry.getStats();
  
  console.log('Registry Statistics:', stats);
  console.log('\n--- Commands by Category ---\n');
  
  const categories = ['navigation', 'control', 'chat', 'search', 'settings'] as const;
  
  categories.forEach(category => {
    const commands = registry.getCommandsByCategory(category);
    console.log(`${category.toUpperCase()} (${commands.length}):`);
    commands.forEach(cmd => {
      console.log(`  - ${cmd.id}: ${cmd.description}`);
      console.log(`    Patterns: ${cmd.patterns.map(p => p.source).join(', ')}`);
    });
    console.log('');
  });
}

/**
 * Test command matching with a transcript
 */
export function testCommandMatch(transcript: string): void {
  const registry = VoiceCommandRegistry.getInstance();
  const match = registry.match(transcript);
  
  console.log(`\nTesting transcript: "${transcript}"`);
  
  if (match) {
    console.log('✅ COMMAND MATCHED!');
    console.log('  Command ID:', match.command.id);
    console.log('  Description:', match.command.description);
    console.log('  Category:', match.command.category);
    console.log('  Action:', match.command.action);
    console.log('  Parameters:', match.params);
    console.log('  Confidence:', match.confidence);
  } else {
    console.log('❌ No command matched');
    console.log('  This would be treated as dictation text');
  }
}

/**
 * Test multiple transcripts
 */
export function testMultipleCommands(): void {
  console.log('\n=== Testing Multiple Commands ===\n');
  
  const testCases = [
    'send message',
    'send',
    'clear input',
    'clear',
    'go to chat',
    'open models',
    'show settings',
    'new chat',
    'log out',
    'turn on voice',
    'disable voice',
    'this is just normal text',
    'hello world'
  ];
  
  testCases.forEach(testCommandMatch);
}

/**
 * Browser console helper
 * Copy-paste this into browser console to test
 */
export const browserTest = `
// Voice Command Browser Test
// ===========================

// 1. Test command registration and list all commands
testVoiceCommands();

// 2. Test specific command matching
testCommandMatch('send message');
testCommandMatch('clear input');
testCommandMatch('go to chat');
testCommandMatch('new chat');

// 3. Test all commands
testMultipleCommands();
`;

// Extend Window interface for TypeScript
interface WindowWithVoiceTest extends Window {
  testVoiceCommands?: () => void;
  testCommandMatch?: (transcript: string) => void;
  testMultipleCommands?: () => void;
}

declare const window: WindowWithVoiceTest;

// Export for direct browser testing
if (typeof window !== 'undefined') {
  window.testVoiceCommands = testVoiceCommands;
  window.testCommandMatch = testCommandMatch;
  window.testMultipleCommands = testMultipleCommands;
  
  console.log('[VoiceCmd] Test functions registered globally:');
  console.log('  - testVoiceCommands()');
  console.log('  - testCommandMatch(transcript)');
  console.log('  - testMultipleCommands()');
}
