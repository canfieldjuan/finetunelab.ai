/**
 * Check Active Demo Sessions
 * Helps diagnose "You already have an active demo session" error
 * Usage: node check-demo-sessions.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkActiveSessions() {
  console.log('🔍 Checking for active demo sessions...\n');

  // Query active sessions (not expired)
  const { data: activeSessions, error: activeError } = await supabase
    .from('demo_model_configs')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (activeError) {
    console.error('❌ Error querying active sessions:', activeError);
    return;
  }

  // Query recently expired sessions (last 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: expiredSessions, error: expiredError } = await supabase
    .from('demo_model_configs')
    .select('*')
    .lt('expires_at', new Date().toISOString())
    .gt('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });

  if (expiredError) {
    console.error('❌ Error querying expired sessions:', expiredError);
    return;
  }

  // Display results
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    ACTIVE SESSIONS                         ');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (activeSessions.length === 0) {
    console.log('✅ No active sessions found!\n');
  } else {
    console.log(`⚠️  Found ${activeSessions.length} active session(s):\n`);

    activeSessions.forEach((session, idx) => {
      const expiresAt = new Date(session.expires_at);
      const minutesLeft = Math.round((expiresAt - new Date()) / 60000);

      console.log(`${idx + 1}. Session ID: ${session.session_id}`);
      console.log(`   Model: ${session.model_name || session.model_id}`);
      console.log(`   IP Address: ${session.ip_address}`);
      console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);
      console.log(`   Expires: ${expiresAt.toLocaleString()} (${minutesLeft} min left)`);
      console.log(`   Endpoint: ${session.endpoint_url}`);
      console.log('');
    });

    console.log('───────────────────────────────────────────────────────────');
    console.log('💡 To clean up a session, use:');
    console.log('   node cleanup-demo-session.mjs <session_id>');
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('                  RECENTLY EXPIRED SESSIONS                 ');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (expiredSessions.length === 0) {
    console.log('No expired sessions in last 2 hours.\n');
  } else {
    console.log(`Found ${expiredSessions.length} expired session(s) (last 2 hours):\n`);

    expiredSessions.forEach((session, idx) => {
      const expiredAt = new Date(session.expires_at);
      const minutesAgo = Math.round((new Date() - expiredAt) / 60000);

      console.log(`${idx + 1}. Session ID: ${session.session_id}`);
      console.log(`   Model: ${session.model_name || session.model_id}`);
      console.log(`   IP Address: ${session.ip_address}`);
      console.log(`   Expired: ${expiredAt.toLocaleString()} (${minutesAgo} min ago)`);
      console.log('');
    });
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  // Summary
  console.log('📊 SUMMARY:');
  console.log(`   Active sessions: ${activeSessions.length}`);
  console.log(`   Expired sessions (2h): ${expiredSessions.length}`);
  console.log('');

  if (activeSessions.length > 0) {
    console.log('⚠️  ACTION REQUIRED:');
    console.log('   You have active sessions blocking new demo starts.');
    console.log('   Options:');
    console.log('   1. Wait for expiration (shown above)');
    console.log('   2. Clean up manually: node cleanup-demo-session.mjs <session_id>');
    console.log('   3. Clean up ALL: node cleanup-all-demo-sessions.mjs');
    console.log('');
  }
}

checkActiveSessions().catch(console.error);
