/**
 * Test Script - Security Fixes for Scheduled Evaluations
 * Tests: Rate limiting, cron validation, health checks
 *
 * Usage: npx tsx scripts/test-security-fixes.ts
 */

// Load environment variables first
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function runTests() {
  console.log('🧪 Testing Scheduled Evaluations Security Fixes\n');

  // Test 1: Health Check (no auth needed)
  console.log('Test 1: Health Check Endpoint');
  console.log('─────────────────────────────────');
  try {
    const healthResponse = await fetch('http://localhost:3000/api/health/scheduler');
    const healthData = await healthResponse.json();
    console.log('✅ Status:', healthData.status);
    console.log('   Active Schedules:', healthData.active_schedules);
    console.log('   Database:', healthData.database);
    console.log('   Warnings:', healthData.warnings.length > 0 ? healthData.warnings : 'None');
  } catch (error) {
    console.log('❌ Health check failed:', error);
  }
  console.log();

  // Get user session for authenticated tests
  console.log('Authenticating user...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    console.log('❌ No active session. Please log in first.');
    console.log('   Run: npm run dev');
    console.log('   Then login at: http://localhost:3000/login');
    return;
  }

  const authToken = session.access_token;
  console.log('✅ Authenticated as:', session.user.email);
  console.log();

  // Test 2: Cron Validation
  console.log('Test 2: Cron Expression Validation');
  console.log('────────────────────────────────────');

  // Get a test suite to use
  const { data: testSuites } = await supabase
    .from('test_suites')
    .select('id, name')
    .limit(1);

  if (!testSuites || testSuites.length === 0) {
    console.log('⚠️  No test suites found. Creating a dummy one...');
    const { data: newSuite } = await supabase
      .from('test_suites')
      .insert({ name: 'Security Test Suite', description: 'For testing purposes' })
      .select()
      .single();

    if (newSuite) {
      testSuites = [newSuite];
    }
  }

  const testSuiteId = testSuites?.[0]?.id;

  if (!testSuiteId) {
    console.log('❌ Could not find or create test suite');
    return;
  }

  // Test invalid cron expressions
  const invalidCrons = [
    { expr: 'invalid * * * *', desc: 'Invalid minute part' },
    { expr: '0 25 * * *', desc: 'Invalid hour (> 23)' },
    { expr: '0 * * * 7', desc: 'Invalid weekday (> 6)' },
    { expr: '0 * *', desc: 'Too few parts' },
    { expr: '*/0 * * * *', desc: 'Zero interval' },
  ];

  for (const { expr, desc } of invalidCrons) {
    try {
      const response = await fetch('http://localhost:3000/api/scheduled-evaluations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Invalid Cron Test',
          schedule_type: 'custom',
          cron_expression: expr,
          test_suite_id: testSuiteId,
          model_id: 'gpt-4',
        }),
      });

      const data = await response.json();

      if (response.status === 400 && data.error) {
        console.log(`✅ Rejected: "${expr}" (${desc})`);
        console.log(`   Error: ${data.error}`);
      } else {
        console.log(`❌ FAILED: "${expr}" should have been rejected but got status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Request failed for "${expr}":`, error);
    }
  }

  // Test valid cron expression
  console.log('\nTesting valid cron expression...');
  try {
    const response = await fetch('http://localhost:3000/api/scheduled-evaluations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Valid Cron Test',
        schedule_type: 'custom',
        cron_expression: '0 2 * * 1', // Every Monday at 2 AM
        test_suite_id: testSuiteId,
        model_id: 'gpt-4',
      }),
    });

    const data = await response.json();

    if (response.status === 201 && data.success) {
      console.log('✅ Accepted: "0 2 * * 1" (Every Monday at 2 AM)');
      console.log(`   Created schedule ID: ${data.data.id}`);

      // Clean up - delete the test schedule
      await supabase
        .from('scheduled_evaluations')
        .delete()
        .eq('id', data.data.id);
      console.log('   Cleaned up test schedule');
    } else {
      console.log(`❌ Valid cron rejected with status ${response.status}: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.log('❌ Valid cron test failed:', error);
  }

  console.log();

  // Test 3: Rate Limiting
  console.log('Test 3: Rate Limiting (50 schedule max)');
  console.log('──────────────────────────────────────────');

  // Check current schedule count
  const { count: currentCount } = await supabase
    .from('scheduled_evaluations')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  console.log(`Current active schedules: ${currentCount || 0} / 50`);

  if ((currentCount || 0) >= 50) {
    console.log('⚠️  Already at limit. Testing rejection...');

    try {
      const response = await fetch('http://localhost:3000/api/scheduled-evaluations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Rate Limit Test',
          schedule_type: 'daily',
          test_suite_id: testSuiteId,
          model_id: 'gpt-4',
        }),
      });

      const data = await response.json();

      if (response.status === 429) {
        console.log('✅ Rate limiting works! Got 429 status');
        console.log(`   Error: ${data.error}`);
        console.log(`   Message: ${data.message}`);
      } else {
        console.log(`❌ FAILED: Should have gotten 429, got ${response.status}`);
      }
    } catch (error) {
      console.log('❌ Rate limit test failed:', error);
    }
  } else {
    console.log(`✅ Room for ${50 - (currentCount || 0)} more schedules`);
    console.log('   Rate limiting will activate at 50 active schedules');
    console.log('   (Not testing to avoid creating 50 dummy schedules)');
  }

  console.log();
  console.log('═══════════════════════════════════════════');
  console.log('✅ All security tests completed!');
  console.log('═══════════════════════════════════════════');
}

runTests().catch(console.error);
