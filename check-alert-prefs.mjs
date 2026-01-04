/**
 * Check User Alert Preferences for Scheduled Evaluations
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPreferences() {
  const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

  console.log('🔍 Checking alert preferences for user:', userId, '\n');

  const { data, error } = await supabase
    .from('user_alert_preferences')
    .select('email_enabled, email_address, alert_scheduled_eval_failed, alert_scheduled_eval_disabled, alert_batch_test_failed')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    if (error.code === 'PGRST116') {
      console.log('\n⚠️  No alert preferences found - using defaults');
      console.log('   Default: alert_scheduled_eval_failed = true');
      console.log('   Default: alert_scheduled_eval_disabled = true');
    }
    return;
  }

  console.log('User Alert Preferences:');
  console.log('='.repeat(60));
  console.log('Email Enabled:', data.email_enabled);
  console.log('Email Address:', data.email_address);
  console.log('');
  console.log('Alert Settings:');
  console.log('  Scheduled Eval Failed:', data.alert_scheduled_eval_failed);
  console.log('  Scheduled Eval Disabled:', data.alert_scheduled_eval_disabled);
  console.log('  Batch Test Failed:', data.alert_batch_test_failed);
  console.log('='.repeat(60));
}

checkPreferences().catch(console.error);
