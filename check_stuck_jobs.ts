/**
 * Verify Database State - Check for Stuck Jobs
 * Temporary script to validate investigation findings
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Check] Missing environment variables!');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStuckJobs() {
  console.log('[Check] Querying for stuck jobs in running/pending status...\n');

  const { data: jobs, error } = await supabase
    .from('local_training_jobs')
    .select('id, status, started_at, updated_at, model_name')
    .in('status', ['running', 'pending'])
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Check] Error querying database:', error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('[Check] ✅ No stuck jobs found! All jobs are in terminal states.');
    process.exit(0);
  }

  console.log(`[Check] ⚠️  Found ${jobs.length} job(s) in running/pending status:\n`);

  const now = new Date();
  jobs.forEach((job, idx) => {
    const updatedAt = new Date(job.updated_at);
    const staleDuration = Math.floor((now.getTime() - updatedAt.getTime()) / 1000);
    const staleMinutes = Math.floor(staleDuration / 60);
    const staleHours = Math.floor(staleMinutes / 60);
    const staleDays = Math.floor(staleHours / 24);

    let staleDurationStr = '';
    if (staleDays > 0) {
      staleDurationStr = `${staleDays}d ${staleHours % 24}h`;
    } else if (staleHours > 0) {
      staleDurationStr = `${staleHours}h ${staleMinutes % 60}m`;
    } else {
      staleDurationStr = `${staleMinutes}m`;
    }

    const isVeryStale = staleDuration > 600; // > 10 minutes
    const marker = isVeryStale ? '❌' : '⏳';

    console.log(`${idx + 1}. ${marker} Job: ${job.id.substring(0, 8)}...`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Model: ${job.model_name || 'unknown'}`);
    console.log(`   Updated: ${staleDurationStr} ago`);
    console.log(`   Last update: ${job.updated_at}`);
    if (isVeryStale) {
      console.log(`   🔴 STUCK: No updates for > 10 minutes - likely dead process`);
    }
    console.log('');
  });

  const stuckCount = jobs.filter(job => {
    const updatedAt = new Date(job.updated_at);
    const staleDuration = (now.getTime() - updatedAt.getTime()) / 1000;
    return staleDuration > 600;
  }).length;

  console.log(`\n[Check] Summary:`);
  console.log(`  Total running/pending: ${jobs.length}`);
  console.log(`  Stuck (>10 min): ${stuckCount}`);
  console.log(`  Active (<10 min): ${jobs.length - stuckCount}`);

  if (stuckCount > 0) {
    console.log(`\n[Check] ⚠️  ${stuckCount} job(s) need to be marked as failed!`);
  }
}

checkStuckJobs().catch(err => {
  console.error('[Check] Fatal error:', err);
  process.exit(1);
});
