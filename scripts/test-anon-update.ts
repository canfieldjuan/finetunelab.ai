#!/usr/bin/env npx tsx

/**
 * Test if anon role can update metrics with job_token
 * This simulates what the training pod does
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Using ANON key, not service role!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const jobId = '1c85d0c2-1269-44c0-af19-6f5ccc6cea11';
const jobToken = 'ZDyUtonqeuT6DFwBK5WERTHr-I22R81AZ6UOJcNfHKA';

async function testAnonUpdate() {
  console.log('🧪 Testing anon role UPDATE permission\n');
  console.log('Job ID:', jobId);
  console.log('Job Token:', jobToken);
  console.log('\n---\n');

  // Create client with ANON key (same as training pod uses)
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Check current values
  console.log('1️⃣ Fetching current job data...');
  const { data: before, error: selectError } = await supabase
    .from('local_training_jobs')
    .select('id, current_step, loss, progress, updated_at')
    .eq('id', jobId)
    .single();

  if (selectError) {
    console.error('❌ SELECT failed:', selectError.message);
    process.exit(1);
  }

  console.log('Current values:', {
    current_step: before?.current_step,
    loss: before?.loss,
    progress: before?.progress,
    updated_at: before?.updated_at
  });

  // Try update (exactly like the training pod does)
  console.log('\n2️⃣ Attempting UPDATE as anon role...');
  const testData = {
    current_step: 777,
    loss: 0.456,
    progress: 0.58,
    updated_at: new Date().toISOString()
  };

  console.log('Update payload:', testData);

  const { data: updateResult, error: updateError } = await supabase
    .from('local_training_jobs')
    .update(testData)
    .eq('id', jobId)
    .eq('job_token', jobToken)
    .select(); // Request to return updated data

  if (updateError) {
    console.error('\n❌ UPDATE FAILED:', updateError.message);
    console.error('Error code:', updateError.code);
    console.error('Error details:', updateError.details);
    console.error('Error hint:', updateError.hint);
    console.log('\n💡 This means the anon role does NOT have permission to update!');
    process.exit(1);
  }

  if (!updateResult || updateResult.length === 0) {
    console.log('\n⚠️ UPDATE returned 0 rows');
    console.log('This means the WHERE clause didn\'t match any rows');
    console.log('Possible causes:');
    console.log('  - job_token doesn\'t match');
    console.log('  - RLS policy is blocking the row from being selected');
    process.exit(1);
  }

  console.log('\n✅ UPDATE SUCCESSFUL!');
  console.log('Updated data:', {
    current_step: updateResult[0].current_step,
    loss: updateResult[0].loss,
    progress: updateResult[0].progress,
    updated_at: updateResult[0].updated_at
  });

  // Verify the update persisted
  console.log('\n3️⃣ Verifying update persisted...');
  const { data: after, error: verifyError } = await supabase
    .from('local_training_jobs')
    .select('id, current_step, loss, progress')
    .eq('id', jobId)
    .single();

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
    process.exit(1);
  }

  if (after?.current_step === testData.current_step && after?.loss === testData.loss) {
    console.log('✅ Update persisted in database!');
    console.log('Final values:', after);
  } else {
    console.log('⚠️ Update may not have persisted');
    console.log('Expected:', testData);
    console.log('Got:', after);
  }
}

testAnonUpdate();
