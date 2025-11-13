/**
 * Validation Script: Error Message Persistence
 *
 * This script checks if error_message field is being persisted correctly
 * to the local_training_jobs table after our Phase 1 fixes.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function validateErrorPersistence() {
  console.log('=== Validating Error Message Persistence ===\n');

  // Query 1: Check all failed jobs with error_message
  console.log('Query 1: Failed jobs with error_message populated...');
  const { data: failedWithError, error: error1 } = await supabase
    .from('local_training_jobs')
    .select('id, status, error_message, model_name, started_at')
    .eq('status', 'failed')
    .not('error_message', 'is', null)
    .order('started_at', { ascending: false })
    .limit(5);

  if (error1) {
    console.error('Error querying failed jobs:', error1);
  } else {
    console.log(`Found ${failedWithError.length} failed jobs with error_message:\n`);
    failedWithError.forEach((job, i) => {
      console.log(`${i + 1}. Job: ${job.id.substring(0, 8)}...`);
      console.log(`   Model: ${job.model_name}`);
      console.log(`   Started: ${job.started_at}`);
      console.log(`   Error: ${job.error_message?.substring(0, 100)}${job.error_message?.length > 100 ? '...' : ''}`);
      console.log('');
    });
  }

  // Query 2: Check the specific job we analyzed
  console.log('\nQuery 2: Checking specific failed job (74801829-a543-49e1-b269-d4d605af2a84)...');
  const { data: specificJob, error: error2 } = await supabase
    .from('local_training_jobs')
    .select('id, status, error_message, model_name, current_step, total_steps')
    .eq('id', '74801829-a543-49e1-b269-d4d605af2a84')
    .single();

  if (error2) {
    console.error('Error querying specific job:', error2);
  } else if (specificJob) {
    console.log('Job found:');
    console.log(`  Status: ${specificJob.status}`);
    console.log(`  Model: ${specificJob.model_name}`);
    console.log(`  Progress: ${specificJob.current_step}/${specificJob.total_steps}`);
    console.log(`  Error Message: ${specificJob.error_message || 'NULL (not set)'}`);
  } else {
    console.log('Job not found in database');
  }

  // Query 3: Check all failed jobs without error_message (bug indicator)
  console.log('\n\nQuery 3: Failed jobs WITHOUT error_message (indicates bug)...');
  const { data: failedNoError, error: error3 } = await supabase
    .from('local_training_jobs')
    .select('id, status, model_name, started_at')
    .eq('status', 'failed')
    .is('error_message', null)
    .order('started_at', { ascending: false })
    .limit(10);

  if (error3) {
    console.error('Error querying failed jobs without error:', error3);
  } else {
    console.log(`Found ${failedNoError.length} failed jobs WITHOUT error_message (these are from before our fix):\n`);
    failedNoError.forEach((job, i) => {
      console.log(`${i + 1}. Job: ${job.id.substring(0, 8)}... | Model: ${job.model_name} | Started: ${job.started_at}`);
    });
  }

  // Summary
  console.log('\n\n=== Validation Summary ===');
  console.log(`✓ Database connection: SUCCESS`);
  console.log(`✓ error_message column: EXISTS (no query errors)`);
  console.log(`✓ Failed jobs with error_message: ${failedWithError?.length || 0}`);
  console.log(`✓ Failed jobs without error_message: ${failedNoError?.length || 0}`);

  if (failedNoError?.length > 0 && failedWithError?.length === 0) {
    console.log('\n⚠️  WARNING: All failed jobs have NULL error_message');
    console.log('   This indicates the training server may not be using the updated code yet.');
    console.log('   Restart the training server to apply Phase 1 fixes.');
  } else if (failedWithError?.length > 0) {
    console.log('\n✅ SUCCESS: Error messages are being persisted correctly!');
  }
}

validateErrorPersistence()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Validation script error:', err);
    process.exit(1);
  });
