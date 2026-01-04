#!/usr/bin/env node

/**
 * Check batch_test_config for scheduled evaluations
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
  const { data: schedules, error } = await supabase
    .from('scheduled_evaluations')
    .select('id, name, model_id, batch_test_config')
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Scheduled Evaluations batch_test_config:\n');

  for (const schedule of schedules) {
    console.log(`\nSchedule: ${schedule.name} (${schedule.id})`);
    console.log(`Model ID (column): ${schedule.model_id}`);
    console.log(`batch_test_config:`, JSON.stringify(schedule.batch_test_config, null, 2));
  }
}

main();
