// Quick database state check
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkDatabaseState() {
  console.log('\n=== Database State Check ===\n');
  
  console.log('Supabase URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
  console.log('Service Key:', supabaseServiceKey ? '✓ Set' : '✗ Missing');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('\n❌ Missing environment variables!');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Check training jobs
  console.log('\n--- Checking local_training_jobs table ---');
  const { data: jobs, error: jobsError } = await supabase
    .from('local_training_jobs')
    .select('id, model_name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError.message);
  } else {
    console.log(`✓ Found ${jobs.length} training job(s)`);
    if (jobs.length > 0) {
      jobs.forEach(job => {
        console.log(`  - ${job.id}: ${job.model_name} (${job.status})`);
      });
    } else {
      console.log('  (No training jobs in database)');
    }
  }
  
  // Check metrics
  console.log('\n--- Checking local_training_metrics table ---');
  const { data: metrics, error: metricsError } = await supabase
    .from('local_training_metrics')
    .select('job_id, step, train_loss, eval_loss')
    .order('timestamp', { ascending: false })
    .limit(5);
  
  if (metricsError) {
    console.error('❌ Error fetching metrics:', metricsError.message);
  } else {
    console.log(`✓ Found ${metrics.length} metric point(s)`);
    if (metrics.length > 0) {
      metrics.forEach(m => {
        console.log(`  - Job ${m.job_id}, Step ${m.step}: train=${m.train_loss}, eval=${m.eval_loss}`);
      });
    } else {
      console.log('  (No metrics in database)');
    }
  }
  
  console.log('\n=== End Check ===\n');
}

async function checkUserIds() {
  console.log('\n=== User ID Analysis ===\n');
  
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Check what user_id is in the completed job
  console.log('--- Checking user_id in training jobs ---');
  const { data: job } = await supabase
    .from('local_training_jobs')
    .select('id, user_id, model_name, status')
    .eq('id', '8d8535c7-10a7-4eca-89b3-7e921a20beb4')
    .single();
  
  if (job) {
    console.log('Completed job user_id:', job.user_id);
    console.log('Type:', typeof job.user_id);
    console.log('Is null?', job.user_id === null);
    console.log('Full job data:', JSON.stringify(job, null, 2));
  }
  
  // Check local_inference_servers table schema
  console.log('\n--- Checking inference servers table ---');
  const { data: servers, error } = await supabase
    .from('local_inference_servers')
    .select('*')
    .limit(3);
  
  if (error) {
    console.log('Error (might be empty table):', error.message);
  } else {
    console.log(`Found ${servers.length} servers`);
    if (servers.length > 0) {
      console.log('Sample server:', JSON.stringify(servers[0], null, 2));
    }
  }
  
  console.log('\n=== End Analysis ===\n');
}

checkDatabaseState()
  .then(() => checkUserIds())
  .catch(console.error);
