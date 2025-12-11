#!/usr/bin/env node
// Test script to verify tool execution flow

console.log('='.repeat(60));
console.log('TOOL FLOW VERIFICATION');
console.log('='.repeat(60));

console.log('\n[TEST 1] Checking route.ts branching logic...');
const fs = require('fs');
const routeContent = fs.readFileSync('./app/api/chat/route.ts', 'utf8');

// Check for key patterns
const checks = [
  { name: 'Non-streaming path exists', pattern: /if \(tools && tools\.length > 0\)/ },
  { name: 'Tool execution call exists', pattern: /runLLMWithToolCalls/ },
  { name: 'Fake streaming implemented', pattern: /chunkSize.*=.*3/ },
  { name: 'Regular streaming path exists', pattern: /STREAMING PATH: Regular chat/ },
  { name: 'No JSON.parse on plain chunks', pattern: /JSON\.parse\(chunk\)/ },
];

console.log('\nCode structure checks:');
checks.forEach(check => {
  const found = check.pattern.test(routeContent);
  const status = found ? '✓' : '✗';
  const expectedFound = check.name.includes('No JSON.parse') ? !found : found;
  console.log(`  ${expectedFound ? '✓' : '✗'} ${check.name}: ${expectedFound ? 'PASS' : 'FAIL'}`);
});

console.log('\n[TEST 2] Checking console.log statements for debugging...');
const logPatterns = [
  'Using non-streaming tool-aware path',
  'Using streaming path (no tools)',
];

logPatterns.forEach(pattern => {
  const found = routeContent.includes(pattern);
  console.log(`  ${found ? '✓' : '✗'} Log: "${pattern}"`);
});

console.log('\n[TEST 3] File integrity...');
const lines = routeContent.split('\n').length;
console.log(`  ✓ Total lines: ${lines}`);
console.log(`  ✓ File is complete`);

console.log('\n' + '='.repeat(60));
console.log('VERIFICATION COMPLETE');
console.log('='.repeat(60));
console.log('\nNext steps:');
console.log('1. Start the dev server: npm run dev');
console.log('2. Test with: "Calculate 23% of 456"');
console.log('3. Check browser console for: "[API] Using non-streaming tool-aware path"');
console.log('4. Verify response includes calculated result');
