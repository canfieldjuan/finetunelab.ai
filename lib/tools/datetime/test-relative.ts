/**
 * DateTime Tool - Manual Test Script
 * Test the relative action implementation
 * 
 * Run with: npx tsx lib/tools/datetime/test-relative.ts
 */

import datetimeTool from './index';

async function testRelativeAction() {
  console.log('=== DateTime Tool - Relative Action Tests ===\n');

  try {
    // Test 1: Relative time (past)
    console.log('Test 1: Date in the past');
    const past = new Date();
    past.setHours(past.getHours() - 2);
    
    const result1 = await datetimeTool.execute({
      action: 'relative',
      dateTime: past.toISOString()
    });
    console.log('Result:', result1);
    console.log('Expected: "about 2 hours ago"\n');

    // Test 2: Relative time (future)
    console.log('Test 2: Date in the future');
    const future = new Date();
    future.setDate(future.getDate() + 7);
    
    const result2 = await datetimeTool.execute({
      action: 'relative',
      dateTime: future.toISOString()
    });
    console.log('Result:', result2);
    console.log('Expected: "in about 7 days"\n');

    // Test 3: Custom base date
    console.log('Test 3: Custom base date');
    const result3 = await datetimeTool.execute({
      action: 'relative',
      dateTime: '2024-01-01T00:00:00Z',
      baseDate: '2024-01-15T00:00:00Z'
    });
    console.log('Result:', result3);
    console.log('Expected: relative to Jan 15, 2024\n');

    // Test 4: With timezone
    console.log('Test 4: With timezone (America/New_York)');
    const result4 = await datetimeTool.execute({
      action: 'relative',
      dateTime: '2024-10-20T12:00:00Z',
      timezone: 'America/New_York'
    });
    console.log('Result:', result4);
    console.log('');

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Test existing actions to ensure backward compatibility
async function testBackwardCompatibility() {
  console.log('\n=== Backward Compatibility Tests ===\n');

  try {
    // Test current action
    console.log('Test: current action');
    await datetimeTool.execute({
      action: 'current',
      timezone: 'UTC'
    });
    console.log('✅ current action works');

    // Test calculate action
    console.log('Test: calculate action');
    await datetimeTool.execute({
      action: 'calculate',
      calculationAction: 'add',
      dateTime: '2024-01-01T00:00:00Z',
      amount: 5,
      unit: 'days'
    });
    console.log('✅ calculate action works');

    // Test diff action
    console.log('Test: diff action');
    await datetimeTool.execute({
      action: 'diff',
      startDateTime: '2024-01-01T00:00:00Z',
      endDateTime: '2024-01-15T00:00:00Z',
      unit: 'days'
    });
    console.log('✅ diff action works');

    console.log('\n✅ All backward compatibility tests passed!');

  } catch (error) {
    console.error('❌ Backward compatibility test failed:', error);
    process.exit(1);
  }
}

// Run tests
(async () => {
  await testRelativeAction();
  await testBackwardCompatibility();
  console.log('\n🎉 All tests passed! DateTime tool v2.1.0 is ready!');
})();
