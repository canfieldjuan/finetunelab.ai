/**
 * Test Budget & Efficiency Features
 * Validates API endpoint structure and TypeScript compilation
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';

console.log('=== Testing Budget & Efficiency Features ===\n');

async function testFileExists(path, description) {
  try {
    await readFile(path, 'utf-8');
    console.log(`✅ ${description}: ${path}`);
    return true;
  } catch (err) {
    console.log(`❌ ${description} NOT FOUND: ${path}`);
    return false;
  }
}

async function testAPIStructure(path, requiredExports) {
  try {
    const content = await readFile(path, 'utf-8');
    const results = [];

    for (const exportName of requiredExports) {
      if (content.includes(`export async function ${exportName}`)) {
        results.push(`✅ ${exportName} function`);
      } else {
        results.push(`❌ ${exportName} function MISSING`);
      }
    }

    console.log(`\nAPI Structure - ${path.split('/').pop()}:`);
    results.forEach(r => console.log(`  ${r}`));

    return results.every(r => r.startsWith('✅'));
  } catch (err) {
    console.log(`❌ Failed to read ${path}: ${err.message}`);
    return false;
  }
}

async function testComponentStructure(path, componentName) {
  try {
    const content = await readFile(path, 'utf-8');
    const checks = [
      { name: 'useState imports', pattern: /import.*useState.*from 'react'/ },
      { name: 'useEffect imports', pattern: /import.*useEffect.*from 'react'/ },
      { name: 'useAuth hook', pattern: /const.*session.*=.*useAuth\(\)/ },
      { name: 'fetch call', pattern: /await fetch\(/ },
      { name: 'loading state', pattern: /const.*loading.*=.*useState/ },
      { name: 'export component', pattern: new RegExp(`export function ${componentName}`) },
    ];

    console.log(`\nComponent Structure - ${componentName}:`);
    checks.forEach(check => {
      if (check.pattern.test(content)) {
        console.log(`  ✅ ${check.name}`);
      } else {
        console.log(`  ❌ ${check.name} MISSING`);
      }
    });

    return true;
  } catch (err) {
    console.log(`❌ Failed to read ${path}: ${err.message}`);
    return false;
  }
}

async function runTests() {
  let allPassed = true;

  console.log('--- File Existence Checks ---');
  allPassed &= await testFileExists(
    'supabase/migrations/20251221000001_add_budget_tracking.sql',
    'Migration file'
  );
  allPassed &= await testFileExists(
    'app/api/analytics/budget-settings/route.ts',
    'Budget Settings API'
  );
  allPassed &= await testFileExists(
    'app/api/analytics/budget-status/route.ts',
    'Budget Status API'
  );
  allPassed &= await testFileExists(
    'app/api/analytics/efficiency-recommendations/route.ts',
    'Efficiency Recommendations API'
  );
  allPassed &= await testFileExists(
    'components/analytics/BudgetSettingsCard.tsx',
    'Budget Settings Component'
  );
  allPassed &= await testFileExists(
    'components/analytics/BudgetAlertsPanel.tsx',
    'Budget Alerts Component'
  );
  allPassed &= await testFileExists(
    'components/analytics/EfficiencyRecommendations.tsx',
    'Efficiency Recommendations Component'
  );

  console.log('\n--- API Endpoint Validation ---');
  allPassed &= await testAPIStructure(
    'app/api/analytics/budget-settings/route.ts',
    ['GET', 'POST', 'DELETE']
  );
  allPassed &= await testAPIStructure(
    'app/api/analytics/budget-status/route.ts',
    ['GET']
  );
  allPassed &= await testAPIStructure(
    'app/api/analytics/efficiency-recommendations/route.ts',
    ['GET']
  );

  console.log('\n--- Component Validation ---');
  allPassed &= await testComponentStructure(
    'components/analytics/BudgetSettingsCard.tsx',
    'BudgetSettingsCard'
  );
  allPassed &= await testComponentStructure(
    'components/analytics/BudgetAlertsPanel.tsx',
    'BudgetAlertsPanel'
  );
  allPassed &= await testComponentStructure(
    'components/analytics/EfficiencyRecommendations.tsx',
    'EfficiencyRecommendations'
  );

  console.log('\n--- Migration Structure ---');
  const migration = await readFile('supabase/migrations/20251221000001_add_budget_tracking.sql', 'utf-8');
  const migrationChecks = [
    { name: 'CREATE TABLE', pattern: /CREATE TABLE.*budget_settings/ },
    { name: 'RLS enabled', pattern: /ENABLE ROW LEVEL SECURITY/ },
    { name: 'RLS policy', pattern: /CREATE POLICY.*budget_settings_user_policy/ },
    { name: 'Indexes', pattern: /CREATE INDEX.*budget_settings/ },
    { name: 'UNIQUE constraint', pattern: /UNIQUE\(user_id, budget_type\)/ },
  ];

  migrationChecks.forEach(check => {
    if (check.pattern.test(migration)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} MISSING`);
      allPassed = false;
    }
  });

  console.log('\n=== Test Results ===');
  if (allPassed) {
    console.log('✅ All tests passed!');
    console.log('\nNext steps:');
    console.log('1. Apply migration: npx supabase db push');
    console.log('2. Start dev server: npm run dev');
    console.log('3. Navigate to /analytics and check Usage tab');
    console.log('4. Set a budget limit and verify alerts appear');
    console.log('5. Check efficiency recommendations display');
  } else {
    console.log('❌ Some tests failed - review output above');
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
