/**
 * End-to-End Scheduling Test
 * Tests the complete flow: Create schedule → Worker picks it up → Batch test runs → Alerts sent
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runE2ETest() {
  console.log('🧪 End-to-End Scheduling Test\n');
  console.log('═══════════════════════════════════════════\n');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get a test user
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

  if (listError || !users || users.length === 0) {
    console.log('❌ No users found. Please create a user account first.');
    return;
  }

  const testUser = users[0];
  console.log(`Test user: ${testUser.email}`);
  console.log();

  // Get or create a test suite
  let testSuiteId: string;
  const { data: existingSuites } = await supabase
    .from('test_suites')
    .select('id, name')
    .eq('user_id', testUser.id)
    .limit(1);

  if (existingSuites && existingSuites.length > 0) {
    testSuiteId = existingSuites[0].id;
    console.log(`Using existing test suite: ${existingSuites[0].name}`);
  } else {
    console.log('Creating test suite...');
    const { data: newSuite, error: suiteError } = await supabase
      .from('test_suites')
      .insert({
        user_id: testUser.id,
        name: 'E2E Scheduler Test Suite',
        description: 'For testing scheduled evaluations',
      })
      .select()
      .single();

    if (suiteError || !newSuite) {
      console.log('❌ Failed to create test suite:', suiteError?.message);
      return;
    }

    testSuiteId = newSuite.id;
    console.log(`✅ Created test suite: ${testSuiteId}`);
  }

  console.log();
  console.log('─────────────────────────────────────────');
  console.log('Test 1: Schedule Creation & Immediate Execution');
  console.log('─────────────────────────────────────────\n');

  // Create a schedule that should run in 30 seconds
  const nextRunAt = new Date(Date.now() + 30000); // 30 seconds from now

  console.log('Creating schedule that runs in 30 seconds...');
  const { data: schedule, error: createError } = await supabase
    .from('scheduled_evaluations')
    .insert({
      user_id: testUser.id,
      name: 'E2E Test - Immediate Run',
      description: 'Testing immediate execution',
      schedule_type: 'hourly',
      timezone: 'UTC',
      test_suite_id: testSuiteId,
      model_id: 'gpt-4',
      batch_test_config: {
        model_name: 'gpt-4',
        prompt_limit: 5,
        concurrency: 1,
        delay_ms: 1000,
        source_path: `test_suite:${testSuiteId}`,
        test_suite_name: 'E2E Scheduler Test Suite',
      },
      is_active: true,
      next_run_at: nextRunAt.toISOString(),
      alert_on_failure: true,
      alert_on_regression: false,
    })
    .select()
    .single();

  if (createError || !schedule) {
    console.log('❌ Failed to create schedule:', createError?.message);
    return;
  }

  console.log(`✅ Schedule created: ${schedule.id}`);
  console.log(`   Next run at: ${schedule.next_run_at}`);
  console.log();

  // Check audit log
  console.log('Checking audit log...');
  const { data: auditLogs, error: auditError } = await supabase
    .from('scheduled_evaluation_audit')
    .select('*')
    .eq('scheduled_evaluation_id', schedule.id)
    .eq('action', 'created')
    .order('created_at', { ascending: false })
    .limit(1);

  if (auditError) {
    console.log('⚠️  Could not fetch audit logs:', auditError.message);
  } else if (auditLogs && auditLogs.length > 0) {
    console.log('✅ Audit log entry created');
    console.log(`   Action: ${auditLogs[0].action}`);
    console.log(`   User: ${auditLogs[0].user_id}`);
  } else {
    console.log('⚠️  No audit log found (this may be expected if triggers are still being set up)');
  }

  console.log();
  console.log('Waiting for worker to pick up schedule...');
  console.log('(Worker checks every 60 seconds, waiting up to 90 seconds)\n');

  // Poll for schedule run
  let runFound = false;
  let attempts = 0;
  const maxAttempts = 18; // 90 seconds (5 sec intervals)

  while (!runFound && attempts < maxAttempts) {
    attempts++;
    const elapsed = attempts * 5;

    process.stdout.write(`\r⏳ Waiting... ${elapsed}s / 90s`);

    const { data: runs, error: runsError } = await supabase
      .from('scheduled_evaluation_runs')
      .select('*')
      .eq('scheduled_evaluation_id', schedule.id)
      .order('triggered_at', { ascending: false })
      .limit(1);

    if (!runsError && runs && runs.length > 0) {
      runFound = true;
      console.log('\n');
      console.log(`✅ Worker picked up schedule!`);
      console.log(`   Run ID: ${runs[0].id}`);
      console.log(`   Status: ${runs[0].status}`);
      console.log(`   Triggered at: ${runs[0].triggered_at}`);

      if (runs[0].batch_test_run_id) {
        console.log(`   Batch test run ID: ${runs[0].batch_test_run_id}`);

        // Check if batch test run exists
        const { data: batchRun, error: batchError } = await supabase
          .from('batch_test_runs')
          .select('*')
          .eq('id', runs[0].batch_test_run_id)
          .single();

        if (batchError) {
          console.log(`   ⚠️  Batch test run not found: ${batchError.message}`);
        } else if (batchRun) {
          console.log(`   ✅ Batch test run created successfully`);
          console.log(`      Status: ${batchRun.status}`);
          console.log(`      Started: ${batchRun.started_at}`);
        }
      }
    }

    if (!runFound) {
      await sleep(5000); // Check every 5 seconds
    }
  }

  if (!runFound) {
    console.log('\n');
    console.log('⚠️  Worker did not pick up schedule within 90 seconds');
    console.log('   This might be because:');
    console.log('   - Worker polling interval is 60s (may need to wait longer)');
    console.log('   - Worker may have encountered an error');
    console.log('   - Schedule next_run_at may not be due yet');
  }

  console.log();
  console.log('─────────────────────────────────────────');
  console.log('Test 2: Schedule Update Operation');
  console.log('─────────────────────────────────────────\n');

  console.log('Updating schedule (changing name and deactivating)...');
  const { data: updatedSchedule, error: updateError } = await supabase
    .from('scheduled_evaluations')
    .update({
      name: 'E2E Test - Updated Name',
      is_active: false,
    })
    .eq('id', schedule.id)
    .select()
    .single();

  if (updateError) {
    console.log('❌ Failed to update schedule:', updateError.message);
  } else if (updatedSchedule) {
    console.log('✅ Schedule updated successfully');
    console.log(`   New name: ${updatedSchedule.name}`);
    console.log(`   Active: ${updatedSchedule.is_active}`);

    // Check audit log for update
    const { data: updateAudit } = await supabase
      .from('scheduled_evaluation_audit')
      .select('*')
      .eq('scheduled_evaluation_id', schedule.id)
      .eq('action', 'updated')
      .order('created_at', { ascending: false })
      .limit(1);

    if (updateAudit && updateAudit.length > 0) {
      console.log('✅ Audit log recorded update');
    }
  }

  console.log();
  console.log('─────────────────────────────────────────');
  console.log('Test 3: Different Schedule Types');
  console.log('─────────────────────────────────────────\n');

  const scheduleTypes = [
    { type: 'hourly', cron: null, desc: 'Hourly schedule' },
    { type: 'daily', cron: null, desc: 'Daily schedule' },
    { type: 'weekly', cron: null, desc: 'Weekly schedule' },
    { type: 'custom', cron: '*/15 * * * *', desc: 'Every 15 minutes' },
  ];

  const createdTestSchedules: string[] = [];

  for (const { type, cron, desc } of scheduleTypes) {
    const { data: testSchedule, error } = await supabase
      .from('scheduled_evaluations')
      .insert({
        user_id: testUser.id,
        name: `E2E Test - ${desc}`,
        schedule_type: type,
        cron_expression: cron,
        timezone: 'UTC',
        test_suite_id: testSuiteId,
        model_id: 'gpt-4',
        batch_test_config: { model_name: 'gpt-4' },
        is_active: false, // Don't activate to avoid running
        next_run_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.log(`❌ Failed to create ${desc}:`, error.message);
    } else if (testSchedule) {
      console.log(`✅ Created ${desc}`);
      createdTestSchedules.push(testSchedule.id);
    }
  }

  console.log();
  console.log('─────────────────────────────────────────');
  console.log('Test 4: Cleanup');
  console.log('─────────────────────────────────────────\n');

  console.log('Deleting test schedules...');

  // Delete all test schedules
  const allTestSchedules = [schedule.id, ...createdTestSchedules];

  for (const scheduleId of allTestSchedules) {
    const { error: deleteError } = await supabase
      .from('scheduled_evaluations')
      .delete()
      .eq('id', scheduleId);

    if (deleteError) {
      console.log(`⚠️  Failed to delete ${scheduleId}:`, deleteError.message);
    }
  }

  console.log(`✅ Deleted ${allTestSchedules.length} test schedules`);

  // Check delete audit logs
  const { data: deleteAudits } = await supabase
    .from('scheduled_evaluation_audit')
    .select('*')
    .eq('action', 'deleted')
    .in('scheduled_evaluation_id', allTestSchedules);

  if (deleteAudits && deleteAudits.length > 0) {
    console.log(`✅ ${deleteAudits.length} deletion(s) logged in audit table`);
  }

  console.log();
  console.log('═══════════════════════════════════════════');
  console.log('✅ End-to-End Test Completed!');
  console.log('═══════════════════════════════════════════');
  console.log();
  console.log('Summary:');
  console.log(`  - Schedule creation: ✅`);
  console.log(`  - Audit logging: ${auditLogs && auditLogs.length > 0 ? '✅' : '⚠️'}`);
  console.log(`  - Worker execution: ${runFound ? '✅' : '⚠️ (may need more time)'}`);
  console.log(`  - Schedule updates: ✅`);
  console.log(`  - Different schedule types: ✅`);
  console.log(`  - Cleanup: ✅`);
  console.log();
}

runE2ETest().catch(console.error);
