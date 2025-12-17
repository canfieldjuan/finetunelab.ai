/**
 * Check Latest Scheduled Run
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkLatestRun() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: runs, error } = await supabase
    .from('scheduled_evaluation_runs')
    .select('*')
    .order('triggered_at', { ascending: false })
    .limit(3);

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('\n📊 Latest Scheduled Runs:\n');
  console.log('═══════════════════════════════════════════\n');

  for (const run of runs || []) {
    console.log(`Run ID: ${run.id}`);
    console.log(`Status: ${run.status}`);
    console.log(`Triggered: ${run.triggered_at}`);
    console.log(`Completed: ${run.completed_at || 'Still running...'}`);

    if (run.error_message) {
      console.log(`Error: ${run.error_message}`);
    }

    if (run.batch_test_run_id) {
      console.log(`Batch Test Run: ${run.batch_test_run_id}`);

      // Get batch test run details
      const { data: batchRun } = await supabase
        .from('batch_test_runs')
        .select('*')
        .eq('id', run.batch_test_run_id)
        .single();

      if (batchRun) {
        console.log(`  - Status: ${batchRun.status}`);
        console.log(`  - Started: ${batchRun.started_at}`);
        console.log(`  - Completed: ${batchRun.completed_at || 'Running...'}`);
        console.log(`  - Total: ${batchRun.total_prompts || 0}`);
        console.log(`  - Completed: ${batchRun.completed_prompts || 0}`);
        console.log(`  - Failed: ${batchRun.failed_prompts || 0}`);
      }
    }

    console.log('─────────────────────────────────────────\n');
  }
}

checkLatestRun().catch(console.error);
