/**
 * Migration Runner Script
 * Purpose: Execute database migrations via Supabase client
 * Date: 2025-11-24
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('[Migration] Starting migration execution...');

  // Load environment variables
  require('dotenv').config({ path: '.env.local' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Migration] ERROR: Missing Supabase credentials');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('[Migration] Connecting to:', supabaseUrl);

  // Create Supabase client with service role
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Read migration file
  const migrationPath = path.join(__dirname, '../migrations/20251124_add_dataset_download_tokens.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('[Migration] ERROR: Migration file not found:', migrationPath);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log('[Migration] Loaded migration:', migrationPath);
  console.log('[Migration] SQL length:', migrationSQL.length, 'characters');

  // Execute migration
  try {
    console.log('[Migration] Executing SQL...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // If exec_sql function doesn't exist, try direct query
      if (error.message.includes('function') || error.message.includes('does not exist')) {
        console.log('[Migration] exec_sql not available, trying direct execution...');
        
        // Split SQL into individual statements
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log('[Migration] Executing', statements.length, 'statements...');

        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          if (stmt.length === 0) continue;

          console.log(`[Migration] Statement ${i + 1}/${statements.length}:`, stmt.substring(0, 50) + '...');
          
          const { error: stmtError } = await supabase.rpc('exec', {
            query: stmt + ';'
          });

          if (stmtError) {
            console.error(`[Migration] ERROR in statement ${i + 1}:`, stmtError);
            throw stmtError;
          }
        }

        console.log('[Migration] ✅ All statements executed successfully');
      } else {
        throw error;
      }
    } else {
      console.log('[Migration] ✅ Migration executed successfully');
    }

    // Verify table was created
    console.log('[Migration] Verifying table creation...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('dataset_download_tokens')
      .select('count')
      .limit(0);

    if (tableError) {
      if (tableError.code === 'PGRST116' || tableError.message.includes('does not exist')) {
        console.error('[Migration] ❌ Table was not created');
        console.error('[Migration] You may need to run the migration via Supabase Dashboard SQL Editor');
        process.exit(1);
      }
    } else {
      console.log('[Migration] ✅ Table verified - dataset_download_tokens exists');
    }

    // Try to get table structure
    const { count, error: countError } = await supabase
      .from('dataset_download_tokens')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log('[Migration] ✅ Table is accessible (current rows:', count || 0, ')');
    }

    console.log('\n[Migration] ============================================');
    console.log('[Migration] MIGRATION COMPLETE');
    console.log('[Migration] ============================================\n');

  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    console.error('\n[Migration] MANUAL MIGRATION REQUIRED:');
    console.error('[Migration] 1. Go to Supabase Dashboard: https://supabase.com/dashboard');
    console.error('[Migration] 2. Navigate to SQL Editor');
    console.error('[Migration] 3. Paste contents of: migrations/20251124_add_dataset_download_tokens.sql');
    console.error('[Migration] 4. Execute the SQL');
    process.exit(1);
  }
}

// Run migration
runMigration().catch(error => {
  console.error('[Migration] Unhandled error:', error);
  process.exit(1);
});
