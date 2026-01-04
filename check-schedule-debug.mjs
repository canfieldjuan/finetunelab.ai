/**
 * Debug Scheduled Evaluation Configuration
 * Shows exactly what's stored for a schedule
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugSchedule() {
  console.log('🔍 Fetching scheduled evaluations...\n');

  const { data: schedules, error } = await supabase
    .from('scheduled_evaluations')
    .select('id, name, model_id, test_suite_id, batch_test_config, is_active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!schedules || schedules.length === 0) {
    console.log('No schedules found');
    return;
  }

  schedules.forEach((schedule, idx) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Schedule ${idx + 1}: ${schedule.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`ID: ${schedule.id}`);
    console.log(`Active: ${schedule.is_active}`);
    console.log(`\nModel ID (from column):`);
    console.log(`  Value: "${schedule.model_id}"`);
    console.log(`  Type: ${typeof schedule.model_id}`);
    console.log(`  Length: ${schedule.model_id?.length || 0}`);
    console.log(`  Is Empty: ${!schedule.model_id || schedule.model_id === ''}`);

    console.log(`\nTest Suite ID:`);
    console.log(`  Value: "${schedule.test_suite_id}"`);

    console.log(`\nBatch Test Config:`);
    console.log(JSON.stringify(schedule.batch_test_config, null, 2));

    // Check if batch_test_config has model_id
    if (schedule.batch_test_config?.model_id) {
      console.log(`\n⚠️  WARNING: batch_test_config also has model_id!`);
      console.log(`  Config model_id: "${schedule.batch_test_config.model_id}"`);
    }

    // Show what will be sent to API
    const finalConfig = {
      ...schedule.batch_test_config,
      model_id: schedule.model_id,
      test_suite_id: schedule.test_suite_id,
    };

    console.log(`\n📤 Final Config (what scheduler sends):`);
    console.log(JSON.stringify(finalConfig, null, 2));

    console.log(`\n✅ model_id in final config: ${!!finalConfig.model_id}`);
  });
}

debugSchedule().catch(console.error);
