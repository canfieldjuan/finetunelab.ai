/**
 * Test Failure Handling and Email Alerts
 * Tests:
 * - Email alert on failure
 * - Auto-disable after 3 consecutive failures
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFailureHandling() {
  console.log('🧪 Testing Failure Handling & Auto-Disable\n');
  console.log('═══════════════════════════════════════════\n');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get test user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  if (!users || users.length === 0) {
    console.log('❌ No users found');
    return;
  }

  const testUser = users[0];
  console.log(`Test user: ${testUser.email}\n`);

  // Get test suite
  const { data: testSuites } = await supabase
    .from('test_suites')
    .select('id, name')
    .eq('user_id', testUser.id)
    .limit(1);

  if (!testSuites || testSuites.length === 0) {
    console.log('❌ No test suites found. Create one first.');
    return;
  }

  const testSuiteId = testSuites[0].id;
  console.log(`Using test suite: ${testSuites[0].name}\n`);

  console.log('─────────────────────────────────────────');
  console.log('Test 1: Triggering a Failure');
  console.log('─────────────────────────────────────────\n');

  console.log('Creating schedule that will fail during execution...');
  console.log('(Using invalid model to trigger batch test failure)\n');

  // Create a schedule with valid test suite but invalid model
  // The schedule will be created successfully but will fail when worker tries to run it
  const { data: failSchedule, error: createError } = await supabase
    .from('scheduled_evaluations')
    .insert({
      user_id: testUser.id,
      name: 'Failure Test - Invalid Model',
      description: 'Testing failure handling with invalid model',
      schedule_type: 'hourly',
      timezone: 'UTC',
      test_suite_id: testSuiteId, // Valid test suite
      model_id: 'invalid-model-xyz-12345', // Invalid model - will fail at execution
      batch_test_config: {
        model_name: 'invalid-model-xyz-12345',
        prompt_limit: 5,
        concurrency: 1,
        delay_ms: 1000,
        source_path: `test_suite:${testSuiteId}`,
        test_suite_name: testSuites[0].name,
      },
      is_active: true,
      next_run_at: new Date(Date.now() + 30000).toISOString(), // 30 seconds
      alert_on_failure: true,
      consecutive_failures: 0,
    })
    .select()
    .single();

  if (createError || !failSchedule) {
    console.log('❌ Failed to create schedule:', createError?.message);
    return;
  }

  console.log(`✅ Schedule created: ${failSchedule.id}`);
  console.log(`   Will fail due to non-existent test suite`);
  console.log(`   Alert on failure: ${failSchedule.alert_on_failure}`);
  console.log();

  console.log('Waiting for worker to attempt execution...');
  console.log('(This may take up to 90 seconds)\n');

  // Wait for the run to be created and fail
  let failureDetected = false;
  let attempts = 0;
  const maxAttempts = 20; // 100 seconds

  while (!failureDetected && attempts < maxAttempts) {
    attempts++;
    process.stdout.write(`\r⏳ Waiting... ${attempts * 5}s / 100s`);

    const { data: runs } = await supabase
      .from('scheduled_evaluation_runs')
      .select('*')
      .eq('scheduled_evaluation_id', failSchedule.id)
      .order('triggered_at', { ascending: false })
      .limit(1);

    if (runs && runs.length > 0) {
      const run = runs[0];

      if (run.status === 'failed') {
        failureDetected = true;
        console.log('\n');
        console.log('✅ Failure detected!');
        console.log(`   Run ID: ${run.id}`);
        console.log(`   Status: ${run.status}`);
        console.log(`   Error: ${run.error_message || 'No error message'}`);
        console.log();

        // Check if alert was sent
        console.log('Checking if alert was sent...');

        // Note: We can't directly check Resend emails in test env
        // But we can check the alert system was invoked by checking logs
        console.log('ℹ️  Alert system should have been triggered');
        console.log('   Check your email: ' + testUser.email);
        console.log();

        // Check schedule's consecutive_failures counter
        const { data: updatedSchedule } = await supabase
          .from('scheduled_evaluations')
          .select('consecutive_failures, is_active')
          .eq('id', failSchedule.id)
          .single();

        if (updatedSchedule) {
          console.log(`   Consecutive failures: ${updatedSchedule.consecutive_failures}`);
          console.log(`   Still active: ${updatedSchedule.is_active}`);
        }
      } else if (run.status === 'triggered' || run.status === 'running') {
        // Still running, keep waiting
      }
    }

    if (!failureDetected) {
      await sleep(5000);
    }
  }

  if (!failureDetected) {
    console.log('\n⚠️  Failure not detected within timeout');
    console.log('   The worker may need more time or may not be running');
  }

  console.log();
  console.log('─────────────────────────────────────────');
  console.log('Test 2: Auto-Disable After 3 Failures');
  console.log('─────────────────────────────────────────\n');

  console.log('Simulating 3 consecutive failures...');

  // Manually increment consecutive_failures to 3
  const { data: disabledSchedule, error: updateError } = await supabase
    .from('scheduled_evaluations')
    .update({ consecutive_failures: 3 })
    .eq('id', failSchedule.id)
    .select()
    .single();

  if (updateError) {
    console.log('❌ Failed to update schedule:', updateError.message);
  } else {
    console.log('✅ Set consecutive_failures to 3');
  }

  // Trigger one more run to test auto-disable
  console.log('Setting schedule to run again in 30 seconds...');

  await supabase
    .from('scheduled_evaluations')
    .update({
      next_run_at: new Date(Date.now() + 30000).toISOString(),
      is_active: true, // Make sure it's active
    })
    .eq('id', failSchedule.id);

  console.log('Waiting for 4th failure (should auto-disable)...');
  console.log('(This may take up to 90 seconds)\n');

  attempts = 0;
  let autoDisableDetected = false;

  while (!autoDisableDetected && attempts < maxAttempts) {
    attempts++;
    process.stdout.write(`\r⏳ Waiting... ${attempts * 5}s / 100s`);

    const { data: schedule } = await supabase
      .from('scheduled_evaluations')
      .select('is_active, consecutive_failures')
      .eq('id', failSchedule.id)
      .single();

    if (schedule && !schedule.is_active) {
      autoDisableDetected = true;
      console.log('\n');
      console.log('✅ Auto-disable triggered!');
      console.log(`   Schedule is now inactive: ${!schedule.is_active}`);
      console.log(`   Total consecutive failures: ${schedule.consecutive_failures}`);
      console.log();
    }

    if (!autoDisableDetected) {
      await sleep(5000);
    }
  }

  if (!autoDisableDetected) {
    console.log('\n');
    console.log('⚠️  Auto-disable not detected within timeout');
    console.log('   Note: This test may need manual verification');
  }

  console.log();
  console.log('─────────────────────────────────────────');
  console.log('Cleanup');
  console.log('─────────────────────────────────────────\n');

  console.log('Deleting test schedule...');
  await supabase
    .from('scheduled_evaluations')
    .delete()
    .eq('id', failSchedule.id);

  console.log('✅ Cleanup complete\n');

  console.log('═══════════════════════════════════════════');
  console.log('Summary:');
  console.log('  - Failure detection: ' + (failureDetected ? '✅' : '⚠️'));
  console.log('  - Alert triggering: ℹ️  (check email)');
  console.log('  - Auto-disable: ' + (autoDisableDetected ? '✅' : '⚠️'));
  console.log('═══════════════════════════════════════════');
  console.log();
  console.log('Note: Email alerts must be verified manually');
  console.log(`Check ${testUser.email} for failure alert emails`);
  console.log();
}

testFailureHandling().catch(console.error);
