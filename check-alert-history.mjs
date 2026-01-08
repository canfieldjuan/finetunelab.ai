/**
 * Check Alert History
 * Shows recent alerts and delivery status
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkHistory() {
  const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

  console.log('🔍 Checking alert history for user:', userId, '\n');

  const { data, error } = await supabase
    .from('alert_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No alert history found');
    return;
  }

  console.log(`Found ${data.length} recent alerts:\n`);
  console.log('='.repeat(80));

  data.forEach((alert, idx) => {
    console.log(`\n${idx + 1}. ${alert.alert_type}`);
    console.log(`   Title: ${alert.title}`);
    console.log(`   Created: ${new Date(alert.created_at).toLocaleString()}`);
    console.log(`   Email Sent: ${alert.email_sent ? '✅ YES' : '❌ NO'}`);

    if (alert.email_sent) {
      console.log(`   Email Sent At: ${new Date(alert.email_sent_at).toLocaleString()}`);
      console.log(`   Email Message ID: ${alert.email_message_id}`);
    }

    if (alert.email_error) {
      console.log(`   ⚠️  Email Error: ${alert.email_error}`);
    }

    console.log(`   Webhook Sent: ${alert.webhook_sent ? '✅ YES' : '❌ NO'}`);

    if (alert.webhook_error) {
      console.log(`   ⚠️  Webhook Error: ${alert.webhook_error}`);
    }
  });

  console.log('\n' + '='.repeat(80));

  // Count by alert type
  const typeCounts = data.reduce((acc, alert) => {
    acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1;
    return acc;
  }, {});

  console.log('\nAlert Type Summary:');
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Email success rate
  const emailsSent = data.filter(a => a.email_sent).length;
  const emailsFailed = data.filter(a => !a.email_sent && a.email_error).length;
  const emailsSkipped = data.filter(a => !a.email_sent && !a.email_error).length;

  console.log('\nEmail Delivery Summary:');
  console.log(`  Sent: ${emailsSent}`);
  console.log(`  Failed: ${emailsFailed}`);
  console.log(`  Skipped: ${emailsSkipped}`);
}

checkHistory().catch(console.error);
