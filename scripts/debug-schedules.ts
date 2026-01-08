/**
 * Debug script to check scheduled evaluations in database
 */

import { config } from 'dotenv';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function debugSchedules() {
  console.log('[Debug] Checking scheduled evaluations...');
  console.log('[Debug] Supabase URL:', supabaseUrl);
  console.log('[Debug] Service key exists:', !!supabaseServiceKey);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();

  // Get all schedules (regardless of active status)
  const { data: allSchedules, error: allError } = await supabase
    .from('scheduled_evaluations')
    .select('*')
    .order('created_at', { ascending: false });

  if (allError) {
    console.error('[Debug] Error querying all schedules:', allError);
    return;
  }

  console.log(`\n[Debug] Total schedules in DB: ${allSchedules?.length || 0}`);

  if (allSchedules && allSchedules.length > 0) {
    console.log('\n[Debug] Schedule details:');
    allSchedules.forEach((schedule, i) => {
      console.log(`\n${i + 1}. ${schedule.name} (${schedule.id})`);
      console.log(`   Active: ${schedule.is_active}`);
      console.log(`   Schedule Type: ${schedule.schedule_type}`);
      console.log(`   Next Run: ${schedule.next_run_at}`);
      console.log(`   Last Run: ${schedule.last_run_at}`);
      console.log(`   Cron: ${schedule.cron_expression || 'N/A'}`);
      console.log(`   Timezone: ${schedule.timezone}`);
      console.log(`   Created: ${schedule.created_at}`);
    });

    // Check which are due
    const now = new Date();
    const dueSchedules = allSchedules.filter(s =>
      s.is_active && new Date(s.next_run_at) <= now
    );

    console.log(`\n[Debug] Due schedules (active + next_run_at <= now): ${dueSchedules.length}`);
    if (dueSchedules.length > 0) {
      dueSchedules.forEach(s => {
        console.log(`  - ${s.name}: next_run_at = ${s.next_run_at}`);
      });
    }

    // Check active schedules
    const activeSchedules = allSchedules.filter(s => s.is_active);
    console.log(`\n[Debug] Active schedules: ${activeSchedules.length}`);
    if (activeSchedules.length > 0) {
      activeSchedules.forEach(s => {
        console.log(`  - ${s.name}: next_run_at = ${s.next_run_at}`);
      });
    }
  } else {
    console.log('\n[Debug] No schedules found in database!');
    console.log('[Debug] You need to create scheduled evaluations first.');
  }

  console.log('\n[Debug] Current time:', now.toISOString());
}

debugSchedules().catch(console.error);
