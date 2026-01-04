#!/usr/bin/env node

/**
 * Fix scheduled evaluation to use existing model
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
  const scheduleId = '784f156f-27f3-432f-a958-81afb0e7e082';
  const newModelId = '3105f421-bde2-4c96-9d61-85d79209f090'; // "test model"

  console.log('Updating scheduled evaluation...');
  console.log('Schedule ID:', scheduleId);
  console.log('New Model ID:', newModelId);

  // Update both model_id column and model_name in batch_test_config
  const { data, error } = await supabase
    .from('scheduled_evaluations')
    .update({
      model_id: newModelId,
      batch_test_config: {
        delay_ms: 1000,
        model_name: newModelId,
        concurrency: 1,
        source_path: 'test_suite:bfb8496e-dd11-40b8-a181-0e2aa365882f',
        prompt_limit: 1,
        test_suite_name: 'Debug Logging Test'
      }
    })
    .eq('id', scheduleId)
    .select();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('✓ Updated successfully');
  console.log('Model ID now set to:', newModelId);
}

main();
