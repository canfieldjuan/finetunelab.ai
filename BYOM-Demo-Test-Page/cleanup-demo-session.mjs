/**
 * Cleanup Single Demo Session
 * Usage: node cleanup-demo-session.mjs <session_id>
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const sessionId = process.argv[2];

if (!sessionId) {
  console.error('❌ Usage: node cleanup-demo-session.mjs <session_id>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupSession(sessionId) {
  console.log(`🧹 Cleaning up demo session: ${sessionId}\n`);

  // Get session details first
  const { data: session, error: sessionError } = await supabase
    .from('demo_model_configs')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (sessionError) {
    console.error('❌ Session not found:', sessionError.message);
    return;
  }

  console.log('Session found:');
  console.log(`  Model: ${session.model_name || session.model_id}`);
  console.log(`  IP: ${session.ip_address}`);
  console.log(`  Created: ${new Date(session.created_at).toLocaleString()}`);
  console.log(`  Expires: ${new Date(session.expires_at).toLocaleString()}\n`);

  // Delete batch test results
  const { error: resultsError, count: resultsCount } = await supabase
    .from('demo_batch_test_results')
    .delete()
    .eq('demo_session_id', sessionId);

  if (resultsError) {
    console.error('⚠️  Error deleting test results:', resultsError.message);
  } else {
    console.log(`✅ Deleted ${resultsCount || 0} batch test results`);
  }

  // Delete batch test runs
  const { error: runsError, count: runsCount } = await supabase
    .from('demo_batch_test_runs')
    .delete()
    .eq('demo_session_id', sessionId);

  if (runsError) {
    console.error('⚠️  Error deleting test runs:', runsError.message);
  } else {
    console.log(`✅ Deleted ${runsCount || 0} batch test runs`);
  }

  // Delete model config
  const { error: configError } = await supabase
    .from('demo_model_configs')
    .delete()
    .eq('session_id', sessionId);

  if (configError) {
    console.error('❌ Error deleting session:', configError.message);
  } else {
    console.log(`✅ Deleted session config\n`);
    console.log('🎉 Session cleaned up successfully!');
  }
}

cleanupSession(sessionId).catch(console.error);
