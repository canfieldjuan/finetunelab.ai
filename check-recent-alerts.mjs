/**
 * Check Recent Alerts (last 7 days)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRecentAlerts() {
  const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  console.log('🔍 Checking alerts since:', sevenDaysAgo.toLocaleString(), '\n');

  const { data, error, count } = await supabase
    .from('alert_history')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Total alerts in last 7 days: ${count || 0}\n`);

  if (!data || data.length === 0) {
    console.log('✅ No alerts found in last 7 days');
    console.log('   This means either:');
    console.log('   1. No failures occurred');
    console.log('   2. Alerts are not being triggered');
    return;
  }

  console.log('Recent alerts:');
  console.log('='.repeat(80));

  // Group by alert type
  const byType = data.reduce((acc, alert) => {
    if (!acc[alert.alert_type]) {
      acc[alert.alert_type] = [];
    }
    acc[alert.alert_type].push(alert);
    return acc;
  }, {});

  Object.entries(byType).forEach(([type, alerts]) => {
    console.log(`\n${type} (${alerts.length} alerts):`);
    alerts.slice(0, 3).forEach(alert => {
      console.log(`  - ${new Date(alert.created_at).toLocaleString()}`);
      console.log(`    Title: ${alert.title}`);
      console.log(`    Email Sent: ${alert.email_sent ? '✅' : '❌'}`);
      if (alert.email_error) {
        console.log(`    Error: ${alert.email_error}`);
      }
    });
    if (alerts.length > 3) {
      console.log(`  ... and ${alerts.length - 3} more`);
    }
  });

  console.log('\n' + '='.repeat(80));
}

checkRecentAlerts().catch(console.error);
