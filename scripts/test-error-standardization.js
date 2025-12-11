#!/usr/bin/env node
/**
 * Test Error Message Standardization
 * Verifies all tools throw errors in the standard format
 */

import { executeToolFromRegistry } from '../lib/tools/registry.js';

console.log('🧪 Testing Error Message Standardization\n');

const tests = [
  {
    name: 'Calculator - Empty Expression',
    tool: 'calculator',
    params: { expression: '' },
    expectedPattern: /^\[Calculator\] ValidationError:/,
  },
  {
    name: 'Calculator - Invalid Expression',
    tool: 'calculator',
    params: { expression: 'invalid!!!###' },
    expectedPattern: /^\[Calculator\] ExecutionError:/,
  },
  {
    name: 'DateTime - Missing Action',
    tool: 'datetime',
    params: {},
    expectedPattern: /^\[DateTime\] ValidationError: Action parameter is required/,
  },
  {
    name: 'DateTime - Unknown Action',
    tool: 'datetime',
    params: { action: 'invalid_action' },
    expectedPattern: /^\[DateTime\] ValidationError: Unknown action/,
  },
  {
    name: 'WebSearch - Missing Query',
    tool: 'web-search',
    params: {},
    expectedPattern: /^\[WebSearch\] ValidationError: Query parameter is required/,
  },
  {
    name: 'WebSearch - Short Query',
    tool: 'web-search',
    params: { query: 'a' },
    expectedPattern: /^\[WebSearch\] ValidationError: Query must be at least/,
  },
];

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await executeToolFromRegistry(test.tool, test.params);
      
      if (result.success === false && result.error) {
        if (test.expectedPattern.test(result.error)) {
          console.log(`✅ ${test.name}`);
          console.log(`   Error: ${result.error}\n`);
          passed++;
        } else {
          console.log(`❌ ${test.name}`);
          console.log(`   Expected pattern: ${test.expectedPattern}`);
          console.log(`   Got: ${result.error}\n`);
          failed++;
        }
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Expected error, got success\n`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}`);
      console.log(`   Unexpected exception: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 All error messages follow the standard format!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some error messages need fixing\n');
    process.exit(1);
  }
}

runTests().catch(console.error);
