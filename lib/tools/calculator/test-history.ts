// Test Phase 3 Step 2: History Analysis with Real Supabase
// NO MOCKS - uses actual Supabase data

import { CalculatorService } from './calculator.service';

console.log('=== PHASE 3 STEP 2: HISTORY ANALYSIS TEST ===\n');

let passCount = 0;
let failCount = 0;

async function test(name: string, testFn: () => Promise<void>): Promise<boolean> {
  try {
    await testFn();
    console.log(`PASS: ${name}\n`);
    passCount++;
    return true;
  } catch (error) {
    console.log(`FAIL: ${name}`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}\n`);
    failCount++;
    return false;
  }
}

async function runTests() {
  console.log('Initializing calculator service with real Supabase...\n');
  const calculator = new CalculatorService();
  
  // Get a test user ID - use a default or first available
  const TEST_USER_ID = 'test-user-123';
  
  console.log(`Using test user ID: ${TEST_USER_ID}\n`);

  // Test 1: Get history for user
  await test('Get user history', async () => {
    console.log('  Fetching history from Supabase...');
    const history = await calculator.getHistory(TEST_USER_ID, 100);
    
    console.log(`  Found ${history.length} calculations`);
    
    if (!Array.isArray(history)) {
      throw new Error('getHistory should return an array');
    }
    
    // Verify all entries belong to this user
    if (history.length > 0) {
      const allSameUser = history.every(entry => entry.user_id === TEST_USER_ID);
      if (!allSameUser) {
        throw new Error('Not all history entries belong to the specified user');
      }
      console.log('  ✓ All entries belong to the correct user');
    } else {
      console.log('  No history data yet for this user');
    }
  });

  // Test 2: Get basic history stats
  await test('Get history statistics', async () => {
    console.log('  Fetching history stats from Supabase...');
    const stats = await calculator.getHistoryStats(TEST_USER_ID);
    
    console.log('  Total calculations:', stats.totalCalculations);
    console.log('  Unique expressions:', stats.uniqueExpressions);
    console.log('  Most common operations:', stats.mostCommonOperations.slice(0, 5));
    console.log('  Date range:', stats.dateRange);
    console.log('  Error rate:', stats.errorRate);
    
    if (typeof stats.totalCalculations !== 'number') {
      throw new Error('totalCalculations should be a number');
    }
    if (typeof stats.uniqueExpressions !== 'number') {
      throw new Error('uniqueExpressions should be a number');
    }
    if (!Array.isArray(stats.mostCommonOperations)) {
      throw new Error('mostCommonOperations should be an array');
    }
    if (typeof stats.errorRate !== 'number') {
      throw new Error('errorRate should be a number');
    }
  });

  // Test 3: Verify stats calculation accuracy
  await test('Verify stats calculation accuracy', async () => {
    console.log('  Getting raw history from Supabase...');
    const history = await calculator.getHistory(TEST_USER_ID, 1000);
    
    console.log('  Calculating stats...');
    const stats = await calculator.getHistoryStats(TEST_USER_ID);
    
    // Verify total matches actual count
    if (stats.totalCalculations !== history.length) {
      throw new Error(`Total mismatch: stats=${stats.totalCalculations}, actual=${history.length}`);
    }
    console.log(`  ✓ Total calculations match: ${history.length}`);
    
    // Count unique expressions manually
    const uniqueExprs = new Set(history.map(h => h.expression));
    if (stats.uniqueExpressions !== uniqueExprs.size) {
      throw new Error(`Unique expressions mismatch: stats=${stats.uniqueExpressions}, actual=${uniqueExprs.size}`);
    }
    console.log(`  ✓ Unique expressions match: ${uniqueExprs.size}`);
  });

  // Test 4: Check most common operations
  await test('Verify most common operations', async () => {
    console.log('  Getting stats from Supabase...');
    const stats = await calculator.getHistoryStats(TEST_USER_ID);
    
    console.log('  Most common operations:');
    for (const op of stats.mostCommonOperations.slice(0, 5)) {
      console.log(`    ${op.operation}: ${op.count}`);
    }
    
    if (!Array.isArray(stats.mostCommonOperations)) {
      throw new Error('mostCommonOperations should be an array');
    }
    
    // Verify operations are sorted by count (descending)
    if (stats.mostCommonOperations.length > 1) {
      const counts = stats.mostCommonOperations.map(op => op.count);
      const isSorted = counts.every((count, i) => i === 0 || count <= counts[i - 1]);
      if (!isSorted) {
        throw new Error('mostCommonOperations is not sorted by count');
      }
      console.log('  ✓ Operations are sorted by frequency');
    } else {
      console.log('  Not enough operations to verify sorting');
    }
  });

  // Test 5: Check date range
  await test('Check date range', async () => {
    console.log('  Getting stats from Supabase...');
    const stats = await calculator.getHistoryStats(TEST_USER_ID);
    
    console.log('  Date range:');
    console.log('    Earliest:', stats.dateRange.earliest);
    console.log('    Latest:', stats.dateRange.latest);
    
    if (typeof stats.dateRange.earliest !== 'string') {
      throw new Error('dateRange.earliest should be a string');
    }
    if (typeof stats.dateRange.latest !== 'string') {
      throw new Error('dateRange.latest should be a string');
    }
    
    // If we have data, verify earliest is before latest
    if (stats.totalCalculations > 1 && stats.dateRange.earliest && stats.dateRange.latest) {
      const earliest = new Date(stats.dateRange.earliest);
      const latest = new Date(stats.dateRange.latest);
      if (earliest > latest) {
        throw new Error('Earliest date should be before latest date');
      }
      console.log('  ✓ Date range is valid');
    }
  });

  // Test 6: Check error rate
  await test('Check error rate', async () => {
    console.log('  Getting stats from Supabase...');
    const stats = await calculator.getHistoryStats(TEST_USER_ID);
    
    console.log('  Error rate:', stats.errorRate);
    
    if (typeof stats.errorRate !== 'number') {
      throw new Error('errorRate should be a number');
    }
    
    if (stats.errorRate < 0 || stats.errorRate > 1) {
      throw new Error('Error rate should be between 0 and 1');
    }
    
    console.log(`  ✓ Error rate is valid: ${(stats.errorRate * 100).toFixed(1)}%`);
  });

  console.log('=== TEST SUMMARY ===');
  console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);

  if (failCount === 0) {
    console.log('\nSUCCESS: History analysis works correctly with real Supabase data!');
    process.exit(0);
  } else {
    console.log(`\nFAILED: ${failCount} tests failed`);
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
