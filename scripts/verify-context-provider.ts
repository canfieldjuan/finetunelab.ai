#!/usr/bin/env npx tsx
/**
 * Verify Context Provider Implementation
 * Date: 2025-10-24
 * Tests that context detector and provider functions work correctly
 */

import { detectNeededContext, estimateContextTokens } from '../lib/context/context-detector';

console.log('[Verify] Starting Context Provider Verification...\n');

// ============================================================================
// Test 1: Context Detector - Coding Message
// ============================================================================
console.log('[Test 1] Testing context detector with coding message...');
const codingMessage = 'Can you help me fix this bug in my code?';
const codingDetection = detectNeededContext(codingMessage);

console.log('  Message:', codingMessage);
console.log('  Detection result:', codingDetection);
console.log('  Expected: needsActivity = true');
console.log('  Actual: needsActivity =', codingDetection.needsActivity);

if (codingDetection.needsActivity) {
  console.log('  ✓ PASS: Coding message detected correctly\n');
} else {
  console.error('  ✗ FAIL: Coding message not detected\n');
  process.exit(1);
}

// ============================================================================
// Test 2: Context Detector - Memory Message
// ============================================================================
console.log('[Test 2] Testing context detector with memory message...');
const memoryMessage = 'Do you remember what we discussed earlier?';
const memoryDetection = detectNeededContext(memoryMessage);

console.log('  Message:', memoryMessage);
console.log('  Detection result:', memoryDetection);
console.log('  Expected: needsGraphRAG = true');
console.log('  Actual: needsGraphRAG =', memoryDetection.needsGraphRAG);

if (memoryDetection.needsGraphRAG) {
  console.log('  ✓ PASS: Memory message detected correctly\n');
} else {
  console.error('  ✗ FAIL: Memory message not detected\n');
  process.exit(1);
}

// ============================================================================
// Test 3: Context Detector - Generic Message
// ============================================================================
console.log('[Test 3] Testing context detector with generic message...');
const genericMessage = 'Hello, how are you?';
const genericDetection = detectNeededContext(genericMessage);

console.log('  Message:', genericMessage);
console.log('  Detection result:', genericDetection);
console.log('  Expected: needsActivity = false, needsGraphRAG = false');
console.log('  Actual: needsActivity =', genericDetection.needsActivity);
console.log('  Actual: needsGraphRAG =', genericDetection.needsGraphRAG);

if (!genericDetection.needsActivity && !genericDetection.needsGraphRAG) {
  console.log('  ✓ PASS: Generic message detected correctly\n');
} else {
  console.error('  ✗ FAIL: Generic message detected incorrectly\n');
  process.exit(1);
}

// ============================================================================
// Test 4: Token Estimation
// ============================================================================
console.log('[Test 4] Testing token estimation...');
const minimalDetection = {
  needsProfile: true,
  needsFeatures: true,
  needsActivity: false,
  needsGraphRAG: false,
  reason: 'minimal',
};
const minimalTokens = estimateContextTokens(minimalDetection);

console.log('  Detection:', minimalDetection);
console.log('  Estimated tokens:', minimalTokens);
console.log('  Expected: 65 tokens (25 + 40)');

if (minimalTokens === 65) {
  console.log('  ✓ PASS: Minimal token estimation correct\n');
} else {
  console.error('  ✗ FAIL: Expected 65 tokens, got', minimalTokens, '\n');
  process.exit(1);
}

// ============================================================================
// Test 5: Token Estimation with Activity
// ============================================================================
console.log('[Test 5] Testing token estimation with activity...');
const fullDetection = {
  needsProfile: true,
  needsFeatures: true,
  needsActivity: true,
  needsGraphRAG: false,
  reason: 'full',
};
const fullTokens = estimateContextTokens(fullDetection);

console.log('  Detection:', fullDetection);
console.log('  Estimated tokens:', fullTokens);
console.log('  Expected: 145 tokens (25 + 40 + 80)');

if (fullTokens === 145) {
  console.log('  ✓ PASS: Full token estimation correct\n');
} else {
  console.error('  ✗ FAIL: Expected 145 tokens, got', fullTokens, '\n');
  process.exit(1);
}

// ============================================================================
// Summary
// ============================================================================
console.log('='.repeat(60));
console.log('[Verify] ✓ All Context Detector Tests Passed!');
console.log('[Verify] Context detector is working correctly');
console.log('='.repeat(60));
