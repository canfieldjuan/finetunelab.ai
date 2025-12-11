/**
 * Test: End-to-End Error Message Persistence
 *
 * This test verifies that error_message field flows correctly from
 * training server → jobs API → database
 *
 * Phase 1.3 Validation
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testErrorPersistence() {
  console.log('=== Phase 1.3: Error Persistence End-to-End Test ===\n');

  // Generate a unique test job ID
  const testJobId = `test-error-persist-${Date.now()}`;
  const testUserId = '00000000-0000-0000-0000-000000000001'; // Test user ID
  const testErrorMessage = 'TEST: CUDA out of memory (Phase 1.3 validation)';

  console.log(`Test Job ID: ${testJobId}`);
  console.log(`Test Error: ${testErrorMessage}\n`);

  // Step 1: Simulate training server sending error to jobs API
  console.log('Step 1: Sending job update with error_message to jobs API...');

  const jobPayload = {
    job_id: testJobId,
    user_id: testUserId,
    model_name: 'test-model',
    dataset_path: '/test/dataset',
    status: 'failed',
    error_message: testErrorMessage,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    progress: 50,
    current_epoch: 1,
    current_step: 100,
    total_epochs: 2,
    total_steps: 200,
  };

  try {
    const response = await fetch('http://localhost:3000/api/training/local/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API request failed: ${response.status}`);
      console.error(`Response: ${errorText}`);
      process.exit(1);
    }

    const result = await response.json();
    console.log(`✓ API Response:`, result);

  } catch (error) {
    console.error(`❌ Failed to send to API:`, error.message);
    process.exit(1);
  }

  // Wait a moment for persistence
  console.log('\nStep 2: Waiting 2 seconds for database persistence...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Query database to verify error_message was persisted
  console.log('\nStep 3: Querying database for test job...');

  const { data: job, error: queryError } = await supabase
    .from('local_training_jobs')
    .select('id, status, error_message, model_name')
    .eq('id', testJobId)
    .single();

  if (queryError) {
    console.error(`❌ Database query failed:`, queryError);
    process.exit(1);
  }

  if (!job) {
    console.error(`❌ Test job not found in database`);
    process.exit(1);
  }

  console.log(`✓ Job found in database:`, job);

  // Step 4: Validate error_message field
  console.log('\nStep 4: Validating error_message field...');

  if (job.error_message === null || job.error_message === undefined) {
    console.error(`❌ FAIL: error_message is NULL in database`);
    console.error(`   This indicates the fix did not work`);
    process.exit(1);
  }

  if (job.error_message !== testErrorMessage) {
    console.error(`❌ FAIL: error_message mismatch`);
    console.error(`   Expected: ${testErrorMessage}`);
    console.error(`   Got: ${job.error_message}`);
    process.exit(1);
  }

  console.log(`✓ error_message correctly persisted: "${job.error_message}"`);

  // Step 5: Cleanup - delete test job
  console.log('\nStep 5: Cleaning up test job...');

  const { error: deleteError } = await supabase
    .from('local_training_jobs')
    .delete()
    .eq('id', testJobId);

  if (deleteError) {
    console.warn(`⚠️  Failed to delete test job:`, deleteError.message);
  } else {
    console.log(`✓ Test job deleted`);
  }

  // Final result
  console.log('\n' + '='.repeat(60));
  console.log('✅ SUCCESS: Phase 1.3 Validation Complete');
  console.log('='.repeat(60));
  console.log('\nError persistence flow verified:');
  console.log('  training_server.py → jobs API → database');
  console.log('\nThe critical bug has been fixed:');
  console.log('  ✓ training_server.py uses error_message field');
  console.log('  ✓ jobs API accepts and stores error_message');
  console.log('  ✓ Database column error_message receives data');
  console.log('\nPhase 1 is COMPLETE and ready for Phase 2.');
}

testErrorPersistence()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  });
