import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('=== TESTING USER AUTH & SESSION ACCESS ===\n');

// Test 1: Try to get sessions WITHOUT authentication (anon client)
console.log('1. Testing WITHOUT authentication (anon client)...');
const { data: anonSessions, error: anonError } = await supabase
  .from('conversations')
  .select('id, session_id, experiment_name')
  .not('session_id', 'is', null)
  .not('experiment_name', 'is', null)
  .order('created_at', { ascending: false })
  .limit(5);

console.log('   Result:', {
  count: anonSessions?.length || 0,
  error: anonError?.message,
  sessions: anonSessions?.map(s => ({
    session_id: s.session_id,
    experiment_name: s.experiment_name
  }))
});

// Test 2: Sign in as the user who owns the sessions
console.log('\n2. Attempting to sign in...');
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'canfieldjuan24@gmail.com',
  password: process.env.TEST_USER_PASSWORD || 'test-password-here'
});

if (authError) {
  console.log('   ❌ Sign in failed:', authError.message);
  console.log('   Note: Set TEST_USER_PASSWORD in .env.local to test authenticated access');
} else {
  console.log('   ✅ Sign in successful!');
  console.log('   User ID:', authData.user.id);
  console.log('   Email:', authData.user.email);

  // Test 3: Get sessions WITH authentication
  console.log('\n3. Testing WITH authentication...');
  const { data: authSessions, error: authSessionsError } = await supabase
    .from('conversations')
    .select('id, session_id, experiment_name, user_id')
    .not('session_id', 'is', null)
    .not('experiment_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('   Result:', {
    count: authSessions?.length || 0,
    error: authSessionsError?.message
  });

  if (authSessions && authSessions.length > 0) {
    console.log('   Sessions:');
    authSessions.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.session_id} | ${s.experiment_name} | User: ${s.user_id}`);
    });
  }

  // Test 4: Check RLS policies
  console.log('\n4. Checking RLS policies on conversations table...');
  const { data: policies, error: policiesError } = await supabase
    .rpc('exec_sql', { query: `
      SELECT policyname, cmd, qual
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = 'conversations';
    ` })
    .catch(() => ({ data: null, error: { message: 'RPC not available' } }));

  if (policiesError) {
    console.log('   ⚠️  Could not check policies:', policiesError.message);
  } else if (policies) {
    console.log('   Policies:', policies);
  }
}

console.log('\n=== DONE ===');
