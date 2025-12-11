const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkNotificationFunctions() {
  console.log('Checking notification RPC functions...\n');

  // Test 1: Check if workspace_notifications table exists
  console.log('1. Checking workspace_notifications table...');
  const { data: tableCheck, error: tableError } = await supabase
    .from('workspace_notifications')
    .select('count')
    .limit(1);
  
  if (tableError) {
    console.error('  ❌ Table error:', tableError.message);
  } else {
    console.log('  ✓ Table exists');
  }

  // Test 2: Try to call get_notifications
  console.log('\n2. Testing get_notifications RPC...');
  const { data: notifData, error: notifError } = await supabase
    .rpc('get_notifications', {
      p_workspace_id: null,
      p_limit: 5,
      p_offset: 0,
    });
  
  if (notifError) {
    console.error('  ❌ RPC error:', notifError);
    console.error('  Full error:', JSON.stringify(notifError, null, 2));
  } else {
    console.log('  ✓ RPC works, returned:', notifData?.length || 0, 'notifications');
  }

  // Test 3: Try to call get_unread_count
  console.log('\n3. Testing get_unread_count RPC...');
  const { data: countData, error: countError } = await supabase
    .rpc('get_unread_count', {
      p_workspace_id: null,
    });
  
  if (countError) {
    console.error('  ❌ RPC error:', countError);
    console.error('  Full error:', JSON.stringify(countError, null, 2));
  } else {
    console.log('  ✓ RPC works, unread count:', countData);
  }

  // Test 4: Check auth status
  console.log('\n4. Checking auth status...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('  ❌ Not authenticated:', authError?.message || 'No user');
  } else {
    console.log('  ✓ Authenticated as:', user.email);
  }

  // Test 5: Direct query to check functions
  console.log('\n5. Summary...');
  console.log('  If RPC functions failed, the migration may not be applied.');
  console.log('  Check: migrations/workspaces/012_create_workspace_notifications.sql');
}

checkNotificationFunctions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
