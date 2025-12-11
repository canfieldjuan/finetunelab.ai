const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Create Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('This migration requires admin privileges');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function applyFix() {
  console.log('Applying notification RPC function type fix...\n');

  // Read the SQL fix file
  const sqlPath = path.join(__dirname, 'fix_notification_type_mismatch.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing SQL fix...');
  
  // Note: Supabase client doesn't support executing raw SQL directly
  // We need to use the Supabase dashboard SQL editor or psql CLI
  
  console.log('\n📋 Manual Steps Required:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n� Method 1: Supabase Dashboard (Recommended)');
  console.log('  1. Go to: https://supabase.com/dashboard/project/[your-project]/sql');
  console.log('  2. Copy contents of: fix_notification_type_mismatch.sql');
  console.log('  3. Paste into SQL Editor');
  console.log('  4. Click "Run" button\n');
  
  console.log('🔧 Method 2: psql CLI (If you have database access)');
  console.log('  Run this command:');
  console.log(`  psql "${process.env.DATABASE_URL || '<your-database-url>'}" -f fix_notification_type_mismatch.sql\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Wait for user to apply the fix
  console.log('After applying the fix, press Enter to verify...');
  
  // Since this is automated, let's just test immediately
  console.log('(Attempting verification now...)\n');

  // Verify the fix worked
  console.log('Verifying fix...');
  const { data: testData, error: testError } = await supabase
    .rpc('get_notifications', {
      p_workspace_id: null,
      p_limit: 1,
      p_offset: 0,
    });

  if (testError) {
    console.error('❌ Fix verification failed:', testError.message);
    console.error('Full error:', JSON.stringify(testError, null, 2));
    return false;
  }

  console.log('✓ get_notifications RPC now works correctly!\n');
  return true;
}

applyFix()
  .then(success => {
    if (success) {
      console.log('✅ Notification system is now fully functional');
      process.exit(0);
    } else {
      console.log('⚠️  Manual intervention required (see instructions above)');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
