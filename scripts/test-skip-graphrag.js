#!/usr/bin/env node
/**
 * DEPRECATED: Test shouldSkipGraphRAG function
 * 
 * NOTE: This test is OBSOLETE as of October 12, 2025
 * The shouldSkipGraphRAG() function has been REMOVED from route.ts
 * 
 * GraphRAG now runs for ALL queries and returns contextUsed: false
 * if no relevant documents are found. This allows GraphRAG and tools
 * to work together for hybrid use cases.
 * 
 * This file is kept for historical reference only.
 */

console.log('='.repeat(70));
console.log('⚠️  DEPRECATED TEST SCRIPT');
console.log('='.repeat(70));
console.log('\nThis test is obsolete. The shouldSkipGraphRAG() function has been removed.');
console.log('GraphRAG now runs for all queries.');
console.log('\nSee: /docs/REMOVE_SKIP_LOGIC_PLAN.md for details.');
console.log('='.repeat(70));
process.exit(0);

// Original function preserved for reference
function shouldSkipGraphRAG(message) {
  if (!message || typeof message !== 'string') return true;

  const msg = message.toLowerCase().trim();

  // Skip very short messages (likely greetings)
  if (msg.length < 15) return true;

  // Skip greetings
  if (/^(hi|hey|hello|sup|yo)\b/i.test(msg)) return true;
  if (/^how are you/i.test(msg)) return true;

  // Skip ONLY direct time/date queries (not questions that mention time)
  if (/^(what time|what's the time|current time|what.*the date)/i.test(msg)) return true;

  // Skip weather queries
  if (/(weather|temperature|forecast)/i.test(msg)) return true;

  // Skip math/calculations - improved detection
  // Matches: "calculate X", "what is 5+5", "50 * 2", "23% of 456", etc.
  if (/^(calculate|convert|what is \d|how much is \d)/i.test(msg)) return true;
  // Detect mathematical expressions: numbers with operators
  if (/\d+\s*[\+\-\*\/\%]\s*\d+/.test(msg)) return true;
  // Detect percentage calculations: "X% of Y"
  if (/\d+\s*%\s*of\s*\d+/i.test(msg)) return true;

  return false;
}

console.log('='.repeat(70));
console.log('Testing shouldSkipGraphRAG Function');
console.log('='.repeat(70));

const testCases = [
  // Should skip (math)
  { input: 'test tools: what is 50 * 2?', expected: true, reason: 'Contains math: 50 * 2' },
  { input: '23% of 456', expected: true, reason: 'Percentage calculation' },
  { input: 'calculate 50 + 30', expected: true, reason: 'Starts with calculate' },
  { input: 'what is 5 + 5', expected: true, reason: 'what is [digit]' },
  { input: '100 / 4', expected: true, reason: 'Division operator' },
  { input: '5 - 3', expected: true, reason: 'Subtraction operator' },
  
  // Should NOT skip (normal questions)
  { input: 'tell me about machine learning', expected: false, reason: 'Normal question' },
  { input: 'what is the capital of France?', expected: false, reason: 'Not math (what is + non-digit)' },
  { input: 'how do I learn programming?', expected: false, reason: 'Long enough, not a skip pattern' },
  
  // Edge cases
  { input: 'hi', expected: true, reason: 'Greeting (too short)' },
  { input: 'hello there', expected: true, reason: 'Greeting' },
  { input: 'what time is it?', expected: true, reason: 'Time query' },
];

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected, reason }, idx) => {
  const result = shouldSkipGraphRAG(input);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  
  if (result === expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`\n${idx + 1}. ${status}`);
  console.log(`   Input: "${input}"`);
  console.log(`   Expected: ${expected ? 'SKIP' : 'USE'} GraphRAG (${reason})`);
  console.log(`   Got:      ${result ? 'SKIP' : 'USE'} GraphRAG`);
});

console.log('\n' + '='.repeat(70));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(70));

if (failed === 0) {
  console.log('✅ All tests passed! GraphRAG will be skipped for math queries.');
  console.log('\nKEY IMPROVEMENTS:');
  console.log('1. "test tools: what is 50 * 2?" → SKIP GraphRAG (detects "50 * 2")');
  console.log('2. "23% of 456" → SKIP GraphRAG (detects percentage)');
  console.log('3. Any math operator (+-*/%) → SKIP GraphRAG');
  console.log('\nRECOMMENDATION:');
  console.log('- Test again with "23% of 456" or "test tools: what is 50 * 2?"');
  console.log('- Check terminal logs for "[API] Skipping GraphRAG for query type"');
  console.log('- Calculator tool should be used instead of GraphRAG context');
} else {
  console.log('❌ Some tests failed. Review the regex patterns.');
}
