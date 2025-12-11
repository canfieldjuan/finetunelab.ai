// Test Format Detector Fix
// Tests the ShareGPT array format detection

import { detectDatasetFormat } from './format-detector';

console.log('=== Testing Format Detector ===\n');

// Test 1: ShareGPT array format (like finetuning_expert_augmented.json)
const test1 = JSON.stringify([
  {
    "conversations": [
      { "from": "system", "value": "You are a helpful assistant." },
      { "from": "user", "value": "Hello" },
      { "from": "assistant", "value": "Hi there!" }
    ]
  },
  {
    "conversations": [
      { "from": "user", "value": "How are you?" },
      { "from": "assistant", "value": "I'm doing well!" }
    ]
  }
]);

console.log('Test 1: ShareGPT array format (no separate system field)');
const result1 = detectDatasetFormat(test1);
console.log('Result:', result1);
console.log('Expected: format=sharegpt, confidence=high, hasConversationsField=true');
console.log('PASS:', result1.format === 'sharegpt' && result1.confidence === 'high' ? '✓' : '✗');
console.log('');

// Test 2: ShareGPT array format WITH separate system field
const test2 = JSON.stringify([
  {
    "system": "You are a helpful assistant.",
    "conversations": [
      { "from": "user", "value": "Hello" },
      { "from": "assistant", "value": "Hi there!" }
    ]
  }
]);

console.log('Test 2: ShareGPT array format (with separate system field)');
const result2 = detectDatasetFormat(test2);
console.log('Result:', result2);
console.log('Expected: format=sharegpt, confidence=high, hasSystemField=true');
console.log('PASS:', result2.format === 'sharegpt' && result2.confidence === 'high' && result2.details.hasSystemField ? '✓' : '✗');
console.log('');

// Test 3: ShareGPT wrapped format (like tier1_factual_base_38k.json)
const test3 = JSON.stringify({
  "metadata": { "tier": 1 },
  "examples": [
    {
      "system": "You are a PC hardware expert.",
      "conversations": [
        { "from": "user", "value": "What is a CPU?" },
        { "from": "assistant", "value": "A CPU is a processor." }
      ]
    }
  ]
});

console.log('Test 3: ShareGPT wrapped format (with examples array)');
const result3 = detectDatasetFormat(test3);
console.log('Result:', result3);
console.log('Expected: format=sharegpt-examples, confidence=high, hasExamplesArray=true');
console.log('PASS:', result3.format === 'sharegpt-examples' && result3.confidence === 'high' && result3.details.hasExamplesArray ? '✓' : '✗');
console.log('');

// Test 4: ChatML array format
const test4 = JSON.stringify([
  { "role": "system", "content": "You are helpful." },
  { "role": "user", "content": "Hello" },
  { "role": "assistant", "content": "Hi!" }
]);

console.log('Test 4: ChatML array format');
const result4 = detectDatasetFormat(test4);
console.log('Result:', result4);
console.log('Expected: format=chatml, confidence=high');
console.log('PASS:', result4.format === 'chatml' && result4.confidence === 'high' ? '✓' : '✗');
console.log('');

// Test 5: JSONL ShareGPT format
const test5 = `{"conversations": [{"from": "user", "value": "Hi"}, {"from": "assistant", "value": "Hello"}]}
{"conversations": [{"from": "user", "value": "Bye"}, {"from": "assistant", "value": "Goodbye"}]}`;

console.log('Test 5: JSONL ShareGPT format');
const result5 = detectDatasetFormat(test5);
console.log('Result:', result5);
console.log('Expected: format=sharegpt, confidence=high, isMultiLine=true');
console.log('PASS:', result5.format === 'sharegpt' && result5.confidence === 'high' && result5.details.isMultiLine ? '✓' : '✗');
console.log('');

console.log('=== Test Summary ===');
const tests = [result1, result2, result3, result4, result5];
const passed = tests.filter((r, i) => {
  if (i === 0) return r.format === 'sharegpt' && r.confidence === 'high';
  if (i === 1) return r.format === 'sharegpt' && r.confidence === 'high' && r.details.hasSystemField;
  if (i === 2) return r.format === 'sharegpt-examples' && r.confidence === 'high' && r.details.hasExamplesArray;
  if (i === 3) return r.format === 'chatml' && r.confidence === 'high';
  if (i === 4) return r.format === 'sharegpt' && r.confidence === 'high' && r.details.isMultiLine;
  return false;
}).length;

console.log(`Passed: ${passed}/5 tests`);
console.log(passed === 5 ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');
