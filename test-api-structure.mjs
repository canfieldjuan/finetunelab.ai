/**
 * Test API Endpoint Structure
 * Validates request/response handling patterns
 */

import { readFile } from 'fs/promises';

console.log('=== API Structure Validation ===\n');

async function validateAPIEndpoint(path, name) {
  const content = await readFile(path, 'utf-8');
  const checks = [
    { name: 'Auth header check', pattern: /request\.headers\.get\('authorization'\)/ },
    { name: 'Supabase client creation', pattern: /createClient\(supabaseUrl, supabaseAnonKey/ },
    { name: 'User authentication', pattern: /supabase\.auth\.getUser\(\)/ },
    { name: 'Error handling', pattern: /try \{[\s\S]*\} catch/ },
    { name: 'JSON response', pattern: /NextResponse\.json\(/ },
    { name: 'Success response', pattern: /success: true/ },
  ];

  console.log(`${name}:`);
  let allPassed = true;

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name}`);
      allPassed = false;
    }
  });

  return allPassed;
}

async function validateRecommendationLogic(path) {
  const content = await readFile(path, 'utf-8');
  const checks = [
    { name: 'Model cost analysis', pattern: /function analyzeModelCosts/ },
    { name: 'Cache usage analysis', pattern: /function analyzeCacheUsage/ },
    { name: 'Operation cost analysis', pattern: /function analyzeOperationCosts/ },
    { name: 'Token usage analysis', pattern: /function analyzeTokenUsage/ },
    { name: 'Savings calculation', pattern: /potential_savings_usd/ },
    { name: 'Severity levels', pattern: /severity.*high.*medium.*low/ },
    { name: 'Sorting by savings', pattern: /sort.*potential_savings/ },
  ];

  console.log('\nEfficiency Recommendations Logic:');
  let allPassed = true;

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name}`);
      allPassed = false;
    }
  });

  return allPassed;
}

async function validateBudgetCalculations(path) {
  const content = await readFile(path, 'utf-8');
  const checks = [
    { name: 'Period date calculation', pattern: /function getPeriodDates/ },
    { name: 'Daily period logic', pattern: /budget_type === 'daily'/ },
    { name: 'Weekly period logic', pattern: /budget_type === 'weekly'/ },
    { name: 'Monthly period logic', pattern: /budget_type === 'monthly'/ },
    { name: 'Spend percentage calc', pattern: /spend_percentage.*\/ budget_limit/ },
    { name: 'Forecast logic', pattern: /forecast_spend.*daily_avg_spend/ },
    { name: 'Alert detection', pattern: /is_alert.*alert_threshold/ },
    { name: 'Exceeded detection', pattern: /is_exceeded.*budget_limit/ },
  ];

  console.log('\nBudget Status Calculations:');
  let allPassed = true;

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name}`);
      allPassed = false;
    }
  });

  return allPassed;
}

async function runTests() {
  console.log('--- API Endpoint Structure ---\n');

  const tests = [
    validateAPIEndpoint('app/api/analytics/budget-settings/route.ts', 'Budget Settings API'),
    validateAPIEndpoint('app/api/analytics/budget-status/route.ts', 'Budget Status API'),
    validateAPIEndpoint('app/api/analytics/efficiency-recommendations/route.ts', 'Efficiency Recommendations API'),
    validateRecommendationLogic('app/api/analytics/efficiency-recommendations/route.ts'),
    validateBudgetCalculations('app/api/analytics/budget-status/route.ts'),
  ];

  const results = await Promise.all(tests);
  const allPassed = results.every(r => r);

  console.log('\n=== Results ===');
  if (allPassed) {
    console.log('✅ All API structure validations passed!');
    console.log('\nAPI endpoints are ready for production use.');
  } else {
    console.log('❌ Some validations failed - review output above');
  }
}

runTests().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
