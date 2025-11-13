/**
 * Context Detector
 * Date: 2025-10-24
 * Purpose: Smart detection of which context to inject based on message content
 */

import type { ContextDetectionResult } from './types';

/**
 * Detect what context types are needed for a message
 */
export function detectNeededContext(message: string): ContextDetectionResult {
  const lowerMessage = message.toLowerCase();

  // ALWAYS inject profile and features (cheap, high value)
  const result: ContextDetectionResult = {
    needsProfile: true,
    needsFeatures: true,
    needsActivity: false,
    needsGraphRAG: false,
    reason: 'Essential context',
  };

  // Check if message is about coding/files
  const codingKeywords = [
    'file', 'code', 'function', 'component', 'bug', 'error',
    'implement', 'fix', 'edit', 'create', 'update', 'class',
    'variable', 'import', 'export', 'debug'
  ];

  if (codingKeywords.some(kw => lowerMessage.includes(kw))) {
    result.needsActivity = true;
    result.reason = 'Coding question - added recent files';
  }

  // Check if message references past conversations
  const memoryKeywords = [
    'remember', 'earlier', 'before', 'previous', 'we discussed',
    'last time', 'you said', 'you mentioned', 'recall', 'forget'
  ];

  if (memoryKeywords.some(kw => lowerMessage.includes(kw))) {
    result.needsGraphRAG = true;
    result.reason = 'Memory question - added GraphRAG context';
  }

  // Check if message is about recent work
  const recentWorkKeywords = [
    'recent', 'latest', 'current', 'working on', 'project',
    'that file', 'this file', 'the file we', 'open'
  ];

  if (recentWorkKeywords.some(kw => lowerMessage.includes(kw))) {
    result.needsActivity = true;
    result.reason = 'Recent work question - added activity';
  }

  return result;
}

/**
 * Estimate token count for context
 */
export function estimateContextTokens(detection: ContextDetectionResult): number {
  let tokens = 0;

  if (detection.needsProfile) tokens += 25; // Name, timezone, etc.
  if (detection.needsFeatures) tokens += 40; // Features, plan, limits
  if (detection.needsActivity) tokens += 80; // Recent files, conversations
  if (detection.needsGraphRAG) tokens += 300; // GraphRAG context (average)

  return tokens;
}
