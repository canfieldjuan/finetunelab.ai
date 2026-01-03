/**
 * Cleanup ALL Demo Sessions (Active and Expired)
 * WARNING: This will delete ALL demo sessions
 * Usage: node cleanup-all-demo-sessions.mjs
 */

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function cleanupAllSessions() {
  console.log('⚠️  WARNING: This will delete ALL demo sessions!\n');

  // Count sessions
  const { data: sessions, error: countError } = await supabase
    .from('demo_model_configs')
    .select('session_id, model_name, ip_address, created_at, expires_at');

  if (countError) {
    console.error('❌ Error querying sessions:', countError.message);
    return;
  }

  if (!sessions || sessions.length === 0) {
    console.log('✅ No sessions to clean up!');
    return;
  }

  console.log(`Found ${sessions.length} session(s) to delete:\n`);

  sessions.forEach((session, idx) => {
    const isActive = new Date(session.expires_at) > new Date();
    const status = isActive ? '🟢 ACTIVE' : '🔴 EXPIRED';
    console.log(`${idx + 1}. ${status} - ${session.session_id}`);
    console.log(`   Model: ${session.model_name}`);
    console.log(`   IP: ${session.ip_address}`);
    console.log(`   Expires: ${new Date(session.expires_at).toLocaleString()}\n`);
  });

  const answer = await askQuestion('Are you sure you want to delete ALL sessions? (yes/no): ');

  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled.');
    return;
  }

  console.log('\n🧹 Deleting all sessions...\n');

  // Delete all batch test results
  const { error: resultsError } = await supabase
    .from('demo_batch_test_results')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (resultsError) {
    console.error('⚠️  Error deleting test results:', resultsError.message);
  } else {
    console.log('✅ Deleted all batch test results');
  }

  // Delete all batch test runs
  const { error: runsError } = await supabase
    .from('demo_batch_test_runs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (runsError) {
    console.error('⚠️  Error deleting test runs:', runsError.message);
  } else {
    console.log('✅ Deleted all batch test runs');
  }

  // Delete all model configs
  const { error: configError } = await supabase
    .from('demo_model_configs')
    .delete()
    .neq('session_id', 'impossible-id'); // Delete all

  if (configError) {
    console.error('❌ Error deleting sessions:', configError.message);
  } else {
    console.log('✅ Deleted all session configs\n');
    console.log(`🎉 Successfully deleted ${sessions.length} session(s)!`);
  }
}

cleanupAllSessions().catch(console.error);
