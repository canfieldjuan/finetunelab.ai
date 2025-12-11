// Test Phase 3 Step 2: History Analysis with Real Supabase
// This test uses actual Supabase data

console.log('=== PHASE 3 STEP 2: HISTORY ANALYSIS TEST ===\n');

// Import the calculator service
import { CalculatorService } from './calculator.service.ts';

let passCount = 0;
let failCount = 0;

async function test(name, testFn) {
  try {
    await testFn();
    console.log(`PASS: ${name}\n`);
    passCount++;
    return true;
  } catch (error) {
    console.log(`FAIL: ${name}`);
    console.log(`  Error: ${error.message}\n`);
    failCount++;
    return false;
  }
}

async function runTests() {
  console.log('Initializing calculator service...\n');
  const calculator = new CalculatorService();

  // Test 1: Get basic history stats
  await test('Get history statistics', async () => {
    console.log('  Fetching history analysis...');
    const stats = await calculator.getHistoryStats();
    
    console.log('  Total calculations:', stats.totalCalculations);
    console.log('  Unique users:', stats.uniqueUsers);
    console.log('  Operations breakdown:', JSON.stringify(stats.operationBreakdown, null, 2));
    console.log('  Most frequent operations:', stats.mostFrequentOperations.slice(0, 3));
    console.log('  Recent activity:', stats.recentActivity);
    
    if (typeof stats.totalCalculations !== 'number') {
      throw new Error('totalCalculations should be a number');
    }
    if (typeof stats.uniqueUsers !== 'number') {
      throw new Error('uniqueUsers should be a number');
    }
    if (!Array.isArray(stats.mostFrequentOperations)) {
      throw new Error('mostFrequentOperations should be an array');
    }
  });

  // Test 2: Get history for specific user (if data exists)
  await test('Get user-specific history', async () => {
    console.log('  Fetching all history first...');
    const allHistory = await calculator.getHistory();
    
    if (allHistory.length > 0) {
      const firstUserId = allHistory[0].userId;
      console.log(`  Getting history for user: ${firstUserId}`);
      
      const userHistory = await calculator.getHistory(firstUserId);
      console.log(`  Found ${userHistory.length} calculations for this user`);
      
      // Verify all entries belong to this user
      const allSameUser = userHistory.every(entry => entry.userId === firstUserId);
      if (!allSameUser) {
        throw new Error('Not all history entries belong to the specified user');
      }
    } else {
      console.log('  No history data available, skipping user-specific test');
    }
  });

  // Test 3: Verify stats calculation accuracy
  await test('Verify stats calculation accuracy', async () => {
    console.log('  Getting raw history...');
    const history = await calculator.getHistory();
    
    console.log('  Calculating stats...');
    const stats = await calculator.getHistoryStats();
    
    // Verify total matches actual count
    if (stats.totalCalculations !== history.length) {
      throw new Error(`Total mismatch: stats=${stats.totalCalculations}, actual=${history.length}`);
    }
    console.log(`  ✓ Total calculations match: ${history.length}`);
    
    // Count unique users manually
    const uniqueUserIds = new Set(history.map(h => h.userId));
    if (stats.uniqueUsers !== uniqueUserIds.size) {
      throw new Error(`Unique users mismatch: stats=${stats.uniqueUsers}, actual=${uniqueUserIds.size}`);
    }
    console.log(`  ✓ Unique users match: ${uniqueUserIds.size}`);
  });

  // Test 4: Check operation breakdown
  await test('Verify operation breakdown', async () => {
    console.log('  Getting stats...');
    const stats = await calculator.getHistoryStats();
    
    console.log('  Operation breakdown:');
    for (const [op, count] of Object.entries(stats.operationBreakdown)) {
      console.log(`    ${op}: ${count}`);
    }
    
    if (typeof stats.operationBreakdown !== 'object') {
      throw new Error('operationBreakdown should be an object');
    }
    
    // Verify counts sum to total (if there's data)
    if (stats.totalCalculations > 0) {
      const sum = Object.values(stats.operationBreakdown).reduce((a, b) => a + b, 0);
      if (sum !== stats.totalCalculations) {
        throw new Error(`Operation counts (${sum}) don't match total (${stats.totalCalculations})`);
      }
      console.log(`  ✓ Operation counts sum correctly: ${sum}`);
    }
  });

  // Test 5: Check recent activity
  await test('Check recent activity calculation', async () => {
    console.log('  Getting stats...');
    const stats = await calculator.getHistoryStats();
    
    console.log('  Recent activity (last 24h):', stats.recentActivity);
    
    if (typeof stats.recentActivity !== 'number') {
      throw new Error('recentActivity should be a number');
    }
    
    if (stats.recentActivity > stats.totalCalculations) {
      throw new Error('Recent activity cannot exceed total calculations');
    }
    
    console.log(`  ✓ Recent activity is valid: ${stats.recentActivity}/${stats.totalCalculations}`);
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
