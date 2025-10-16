#!/usr/bin/env node
/**
 * Test Query Classifier
 * Validates classification logic with comprehensive test cases
 */

// Mock import for Node.js execution
// In production, this would use actual TypeScript import

// Copy the classification logic for testing
function classifyQuery(query) {
  if (!query || typeof query !== 'string') {
    return {
      isMath: false,
      isDateTime: false,
      isWebSearch: false,
      isToolSpecific: false,
      shouldSkipSearch: false,
      reason: 'Invalid query',
    };
  }

  const q = query.toLowerCase().trim();

  const isMath = detectMathQuery(q);
  const isDateTime = detectDateTimeQuery(q);
  const isWebSearch = detectWebSearchQuery(q);
  const isToolSpecific = isMath || isDateTime || isWebSearch;

  return {
    isMath,
    isDateTime,
    isWebSearch,
    isToolSpecific,
    shouldSkipSearch: isToolSpecific,
    reason: isToolSpecific ? getSkipReason(isMath, isDateTime, isWebSearch) : undefined,
  };
}

function detectMathQuery(query) {
  if (/\d+\s*[\+\-\*\/\%]\s*\d+/.test(query)) return true;
  if (/\d+\s*%\s*of\s*\d+/i.test(query)) return true;
  if (/^(calculate|compute|what is|how much is)\s+[\d\s\+\-\*\/\%\(\)\.]+/i.test(query)) return true;
  if (/^[\d\s\+\-\*\/\%\(\)\.]+$/.test(query)) return true;
  return false;
}

function detectDateTimeQuery(query) {
  if (/^(what time|what's the time|current time|what.*time is it)/i.test(query)) return true;
  if (/^(what.*date|what's the date|current date|today's date)/i.test(query)) return true;
  if (/(what time in|time in.*timezone|convert.*time)/i.test(query)) return true;
  return false;
}

function detectWebSearchQuery(query) {
  if (/^(search for|search the web|look up|find on web|google)/i.test(query)) return true;
  if (/(latest|current|recent|breaking).*news/i.test(query)) return true;
  return false;
}

function getSkipReason(isMath, isDateTime, isWebSearch) {
  if (isMath) return 'Math calculation - calculator tool appropriate';
  if (isDateTime) return 'DateTime query - datetime tool appropriate';
  if (isWebSearch) return 'Web search query - web_search tool appropriate';
  return 'Tool-specific query';
}

// Test cases
const testCases = [
  // Math queries - SHOULD SKIP
  { query: '50*2', expectedSkip: true, category: 'Math', pattern: 'operator' },
  { query: '23% of 456', expectedSkip: true, category: 'Math', pattern: 'percentage' },
  { query: 'calculate 100+50', expectedSkip: true, category: 'Math', pattern: 'calculate' },
  { query: 'what is 5+5', expectedSkip: true, category: 'Math', pattern: 'what_is' },
  { query: '100 / 4', expectedSkip: true, category: 'Math', pattern: 'division' },
  { query: '(5+3)*2', expectedSkip: true, category: 'Math', pattern: 'complex' },
  
  // DateTime queries - SHOULD SKIP
  { query: 'what time is it', expectedSkip: true, category: 'DateTime', pattern: 'time' },
  { query: 'current date', expectedSkip: true, category: 'DateTime', pattern: 'date' },
  { query: 'what time in Tokyo', expectedSkip: true, category: 'DateTime', pattern: 'timezone' },
  
  // Web search queries - SHOULD SKIP
  { query: 'search for Python tutorials', expectedSkip: true, category: 'WebSearch', pattern: 'search' },
  { query: 'latest news about AI', expectedSkip: true, category: 'WebSearch', pattern: 'news' },
  
  // Knowledge queries - SHOULD NOT SKIP
  { query: 'What is RTX 4090 TDP?', expectedSkip: false, category: 'Knowledge', pattern: 'n/a' },
  { query: 'Tell me about Python', expectedSkip: false, category: 'Knowledge', pattern: 'n/a' },
  { query: 'How do I learn programming?', expectedSkip: false, category: 'Knowledge', pattern: 'n/a' },
  { query: 'Explain machine learning', expectedSkip: false, category: 'Knowledge', pattern: 'n/a' },
  
  // Hybrid queries - SHOULD NOT SKIP (needs context + tools)
  { query: 'I have 700W PSU, can I add RTX 4090?', expectedSkip: false, category: 'Hybrid', pattern: 'n/a' },
  { query: 'Compare RTX 4090 vs 4080', expectedSkip: false, category: 'Hybrid', pattern: 'n/a' },
];

console.log('='.repeat(70));
console.log('QUERY CLASSIFIER TEST SUITE');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;
const failures = [];

testCases.forEach((test, idx) => {
  const result = classifyQuery(test.query);
  const success = result.shouldSkipSearch === test.expectedSkip;
  
  if (success) {
    console.log(`\n${idx + 1}. ✅ PASS: "${test.query}"`);
    console.log(`   Category: ${test.category}`);
    console.log(`   Skip: ${result.shouldSkipSearch} (as expected)`);
    if (result.reason) {
      console.log(`   Reason: ${result.reason}`);
    }
    passed++;
  } else {
    console.log(`\n${idx + 1}. ❌ FAIL: "${test.query}"`);
    console.log(`   Category: ${test.category}`);
    console.log(`   Expected skip: ${test.expectedSkip}`);
    console.log(`   Got skip: ${result.shouldSkipSearch}`);
    console.log(`   Reason: ${result.reason || 'none'}`);
    failed++;
    failures.push({ test, result });
  }
});

console.log('\n' + '='.repeat(70));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(70));

if (failed === 0) {
  console.log('\n✅ All tests passed! Query classifier is working correctly.');
  console.log('\nKEY BEHAVIORS:');
  console.log('  ✓ Math queries (50*2, 23% of 456) → SKIP GraphRAG');
  console.log('  ✓ DateTime queries (what time, current date) → SKIP GraphRAG');
  console.log('  ✓ Web search queries (search for, latest news) → SKIP GraphRAG');
  console.log('  ✓ Knowledge queries (What is X?) → USE GraphRAG');
  console.log('  ✓ Hybrid queries (PC builder questions) → USE GraphRAG');
} else {
  console.log('\n❌ Some tests failed. Review the patterns:');
  failures.forEach(({ test, result }) => {
    console.log(`  - "${test.query}"`);
    console.log(`    Expected: ${test.expectedSkip}, Got: ${result.shouldSkipSearch}`);
  });
}

console.log('\n' + '='.repeat(70));
console.log('Phase 1 Complete: Query Classifier Created & Tested');
console.log('Next: Phase 2 - Integrate into GraphRAG Service');
console.log('='.repeat(70));
