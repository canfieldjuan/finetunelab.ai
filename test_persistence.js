// Quick test script to verify persistence
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function checkPersistence() {
  const jobId = '0214ab16-1906-4dc4-a289-b3a132c957e1';

  console.log('\n=== Checking Training Metrics Persistence ===\n');
  console.log(`Job ID: ${jobId}\n`);

  try {
    // Check job in database
    const jobResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/local_training_jobs?id=eq.${jobId}`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    const jobs = await jobResponse.json();

    if (jobs && jobs.length > 0) {
      console.log('✅ Job found in database!');
      console.log(`   Model: ${jobs[0].model_name}`);
      console.log(`   Status: ${jobs[0].status}`);
      console.log(`   Created: ${jobs[0].created_at}`);
      console.log(`   Completed: ${jobs[0].completed_at}`);
    } else {
      console.log('❌ Job NOT found in database');
    }

    // Check metrics
    const metricsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/local_training_metrics?job_id=eq.${jobId}&select=count`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'count=exact'
        }
      }
    );

    const metricsCount = metricsResponse.headers.get('content-range');

    if (metricsCount) {
      const count = metricsCount.split('/')[1];
      console.log(`\n✅ Metrics found: ${count} data points`);
    } else {
      console.log('\n❌ No metrics found in database');
    }

  } catch (error) {
    console.error('Error checking persistence:', error.message);
  }
}

checkPersistence();
