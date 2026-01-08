#!/usr/bin/env node

/**
 * Check recent batch_test_runs to see what model_id is actually being used
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // Get recent batch test runs
  const { data: runs, error } = await supabase
    .from('batch_test_runs')
    .select('id, model_name, config, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Recent Batch Test Runs:\n');

  for (const run of runs) {
    console.log(`\nRun ID: ${run.id}`);
    console.log(`Created: ${run.created_at}`);
    console.log(`Status: ${run.status}`);
    console.log(`Model Name (column): ${run.model_name}`);
    console.log(`Config:`, JSON.stringify(run.config, null, 2));
  }

  // Also check for conversations created with wrong model
  console.log('\n\n=== Checking Conversations ===\n');

  const { data: convos, error: convoError } = await supabase
    .from('conversations')
    .select('id, llm_model_id, batch_test_run_id, created_at')
    .not('batch_test_run_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (convoError) {
    console.error('Error:', convoError);
    process.exit(1);
  }

  for (const convo of convos) {
    console.log(`\nConversation ID: ${convo.id}`);
    console.log(`Batch Test Run ID: ${convo.batch_test_run_id}`);
    console.log(`LLM Model ID: ${convo.llm_model_id}`);
    console.log(`Created: ${convo.created_at}`);
  }
}

main();
