/**
 * Direct Cron Validation Test
 * Tests the validation functions directly without API calls
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { isValidCronExpression, describeCronExpression } from '../lib/evaluation/schedule-calculator';

console.log('🧪 Testing Cron Expression Validation\n');
console.log('═══════════════════════════════════════════\n');

const testCases = [
  // Valid expressions
  { expr: '0 * * * *', shouldBeValid: true, desc: 'Hourly' },
  { expr: '0 2 * * *', shouldBeValid: true, desc: 'Daily at 2 AM' },
  { expr: '0 14 * * *', shouldBeValid: true, desc: 'Daily at 2 PM' },
  { expr: '0 2 * * 1', shouldBeValid: true, desc: 'Weekly on Monday' },
  { expr: '0 9 * * 5', shouldBeValid: true, desc: 'Weekly on Friday' },
  { expr: '*/15 * * * *', shouldBeValid: true, desc: 'Every 15 minutes' },
  { expr: '*/5 * * * *', shouldBeValid: true, desc: 'Every 5 minutes' },

  // Invalid expressions
  { expr: 'invalid * * * *', shouldBeValid: false, desc: 'Invalid minute' },
  { expr: '0 25 * * *', shouldBeValid: false, desc: 'Hour > 23' },
  { expr: '0 -1 * * *', shouldBeValid: false, desc: 'Negative hour' },
  { expr: '0 * * * 7', shouldBeValid: false, desc: 'Weekday > 6' },
  { expr: '0 * *', shouldBeValid: false, desc: 'Too few parts' },
  { expr: '0 * * * * *', shouldBeValid: false, desc: 'Too many parts' },
  { expr: '*/0 * * * *', shouldBeValid: false, desc: 'Zero interval' },
  { expr: '*/60 * * * *', shouldBeValid: false, desc: 'Interval > 59' },
  { expr: '', shouldBeValid: false, desc: 'Empty string' },
  { expr: '   ', shouldBeValid: false, desc: 'Whitespace only' },
  { expr: '* * * * *', shouldBeValid: false, desc: 'Unsupported pattern' },
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const isValid = isValidCronExpression(testCase.expr);
  const description = isValid ? describeCronExpression(testCase.expr) : 'Invalid';

  const expected = testCase.shouldBeValid ? 'VALID' : 'INVALID';
  const actual = isValid ? 'VALID' : 'INVALID';
  const status = (isValid === testCase.shouldBeValid) ? '✅' : '❌';

  if (isValid === testCase.shouldBeValid) {
    passed++;
  } else {
    failed++;
  }

  console.log(`${status} "${testCase.expr}"`);
  console.log(`   Expected: ${expected} (${testCase.desc})`);
  console.log(`   Got: ${actual} - ${description}`);
  console.log();
}

console.log('═══════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
console.log('═══════════════════════════════════════════');

if (failed === 0) {
  console.log('✅ All cron validation tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed!');
  process.exit(1);
}
