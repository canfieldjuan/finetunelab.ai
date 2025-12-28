/**
 * Activate a schedule and set next run time
 */

import { config } from 'dotenv';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function activateSchedule(scheduleId: string, minutesFromNow: number = 2) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Calculate next run time
  const nextRunAt = new Date();
  nextRunAt.setMinutes(nextRunAt.getMinutes() + minutesFromNow);

  console.log(`[Activate] Activating schedule: ${scheduleId}`);
  console.log(`[Activate] Setting next_run_at to: ${nextRunAt.toISOString()}`);
  console.log(`[Activate] That's ${minutesFromNow} minutes from now`);

  const { data, error } = await supabase
    .from('scheduled_evaluations')
    .update({
      is_active: true,
      next_run_at: nextRunAt.toISOString(),
      consecutive_failures: 0,
    })
    .eq('id', scheduleId)
    .select();

  if (error) {
    console.error('[Activate] Error:', error);
    process.exit(1);
  }

  console.log('[Activate] Success! Schedule activated:');
  console.log(JSON.stringify(data, null, 2));
}

// Get schedule ID from command line or use default
const scheduleId = process.argv[2] || 'ee12330b-c984-46be-9b54-fcb6ecd91126';
const minutesFromNow = parseInt(process.argv[3] || '2', 10);

activateSchedule(scheduleId, minutesFromNow).catch(console.error);
