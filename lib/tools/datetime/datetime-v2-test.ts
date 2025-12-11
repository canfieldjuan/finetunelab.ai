/**
 * DateTime Tool v2.0 - Test Script
 * Tests the new calculate and diff actions
 * 
 * Run with: npx tsx lib/tools/datetime/datetime-v2-test.ts
 */

import datetimeTool from './index';

async function testDateTimeV2() {
  console.log('='.repeat(60));
  console.log('DateTime Tool v2.0 - Test Suite');
  console.log('='.repeat(60));
  console.log();

  // Test 1: Current action (existing functionality)
  console.log('Test 1: Current Date/Time');
  console.log('-'.repeat(40));
  try {
    const result = await datetimeTool.execute({
      action: 'current',
      timezone: 'America/New_York',
    });
    console.log('✅ SUCCESS:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ FAILED:', error);
  }
  console.log();

  // Test 2: Calculate - Add days
  console.log('Test 2: Calculate - Add 7 days to current date');
  console.log('-'.repeat(40));
  try {
    const now = new Date().toISOString();
    const result = await datetimeTool.execute({
      action: 'calculate',
      calculationAction: 'add',
      dateTime: now,
      amount: 7,
      unit: 'days',
      timezone: 'UTC',
    });
    console.log('✅ SUCCESS:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ FAILED:', error);
  }
  console.log();

  // Test 3: Calculate - Subtract hours
  console.log('Test 3: Calculate - Subtract 3 hours from current time');
  console.log('-'.repeat(40));
  try {
    const now = new Date().toISOString();
    const result = await datetimeTool.execute({
      action: 'calculate',
      calculationAction: 'subtract',
      dateTime: now,
      amount: 3,
      unit: 'hours',
      timezone: 'America/Los_Angeles',
    });
    console.log('✅ SUCCESS:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ FAILED:', error);
  }
  console.log();

  // Test 4: Diff - Days between two dates
  console.log('Test 4: Diff - Days between two dates');
  console.log('-'.repeat(40));
  try {
    const start = '2025-10-01T00:00:00Z';
    const end = '2025-10-21T00:00:00Z';
    const result = await datetimeTool.execute({
      action: 'diff',
      startDateTime: start,
      endDateTime: end,
      unit: 'days',
      timezone: 'UTC',
    });
    console.log('✅ SUCCESS:', JSON.stringify(result, null, 2));
    console.log(`   Expected: 20 days, Got: ${(result as { diff: number }).diff} days`);
  } catch (error) {
    console.error('❌ FAILED:', error);
  }
  console.log();

  // Test 5: Diff - Hours between times
  console.log('Test 5: Diff - Hours between two times');
  console.log('-'.repeat(40));
  try {
    const start = '2025-10-21T08:00:00Z';
    const end = '2025-10-21T17:30:00Z';
    const result = await datetimeTool.execute({
      action: 'diff',
      startDateTime: start,
      endDateTime: end,
      unit: 'hours',
      timezone: 'UTC',
    });
    console.log('✅ SUCCESS:', JSON.stringify(result, null, 2));
    console.log(`   Expected: 9 hours, Got: ${(result as { diff: number }).diff} hours`);
  } catch (error) {
    console.error('❌ FAILED:', error);
  }
  console.log();

  // Test 6: Error handling - Missing parameters
  console.log('Test 6: Error Handling - Missing parameters');
  console.log('-'.repeat(40));
  try {
    await datetimeTool.execute({
      action: 'calculate',
      // Missing required parameters
    });
    console.error('❌ FAILED: Should have thrown an error');
  } catch (error) {
    if (error instanceof Error) {
      console.log('✅ SUCCESS: Correctly caught error:', error.message);
    }
  }
  console.log();

  // Test 7: Error handling - Invalid date
  console.log('Test 7: Error Handling - Invalid date string');
  console.log('-'.repeat(40));
  try {
    await datetimeTool.execute({
      action: 'calculate',
      calculationAction: 'add',
      dateTime: 'not-a-valid-date',
      amount: 1,
      unit: 'days',
    });
    console.error('❌ FAILED: Should have thrown an error');
  } catch (error) {
    if (error instanceof Error) {
      console.log('✅ SUCCESS: Correctly caught error:', error.message);
    }
  }
  console.log();

  console.log('='.repeat(60));
  console.log('Test Suite Complete!');
  console.log('='.repeat(60));
}

// Run tests
testDateTimeV2().catch(console.error);
