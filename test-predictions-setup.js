// Test Setup Script - Check for API keys and training jobs
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tkizlemssfmrfluychsn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== Testing Setup Check ===\n');

  // 1. Find API keys with 'training' scope
  console.log('1. Checking for API keys with "training" scope...');
  const { data: apiKeys, error: keysError } = await supabase
    .from('user_api_keys')
    .select('id, user_id, name, scopes, is_active, key_prefix')
    .eq('is_active', true)
    .limit(5);

  if (keysError) {
    console.error('Error fetching API keys:', keysError);
  } else {
    console.log(`Found ${apiKeys.length} active API keys:`);
    apiKeys.forEach(key => {
      const hasTraining = key.scopes && (key.scopes.includes('training') || key.scopes.includes('all'));
      console.log(`  - ${key.name} (${key.key_prefix}***) - Scopes: ${JSON.stringify(key.scopes)} ${hasTraining ? '✓ HAS TRAINING' : '✗ NO TRAINING'}`);
    });
  }

  console.log('\n2. Checking for training jobs with predictions...');
  const { data: jobs, error: jobsError } = await supabase
    .from('local_training_jobs')
    .select('id, user_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (jobsError) {
    console.error('Error fetching jobs:', jobsError);
  } else {
    console.log(`Found ${jobs.length} recent training jobs:`);

    for (const job of jobs) {
      const { data: predictions, error: predError } = await supabase
        .from('training_predictions')
        .select('id, epoch, step')
        .eq('job_id', job.id)
        .limit(1);

      const predCount = predictions?.length || 0;
      console.log(`  - ${job.id.substring(0, 20)}... (${job.status}) - ${predCount > 0 ? `✓ HAS PREDICTIONS` : '✗ NO PREDICTIONS'}`);
    }
  }

  console.log('\n3. Finding a job with predictions to test...');
  const { data: jobsWithPreds, error: jpError } = await supabase
    .from('training_predictions')
    .select('job_id, user_id')
    .limit(1);

  if (jpError) {
    console.error('Error:', jpError);
  } else if (jobsWithPreds && jobsWithPreds.length > 0) {
    const testJob = jobsWithPreds[0];
    console.log(`✓ Test job found: ${testJob.job_id}`);
    console.log(`✓ User ID: ${testJob.user_id}`);

    // Get prediction count
    const { count } = await supabase
      .from('training_predictions')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', testJob.job_id);

    console.log(`✓ Predictions count: ${count}`);
  } else {
    console.log('✗ No training predictions found in database');
  }
}

main().catch(console.error);
