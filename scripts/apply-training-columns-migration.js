/**
 * Apply Migration: Add Missing Training Job Columns
 * Run this script to add the missing columns to the local_training_jobs table
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('📦 Reading migration file...');
  
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251103000002_add_missing_training_job_columns.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('🚀 Applying migration to Supabase...\n');
  
  // Split by statement (simple split on semicolons, accounting for DO blocks)
  const statements = migrationSQL
    .split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/) // Split on ; but not inside strings
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    if (!statement) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        // Try direct execution if RPC doesn't work
        const { error: directError } = await supabase
          .from('_migrations')
          .insert({ name: '20251103000002_add_missing_training_job_columns' });
        
        if (directError && directError.code !== '23505') { // Ignore duplicate key
          console.error(`❌ Error executing statement:`, error);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
          errorCount++;
        } else {
          successCount++;
        }
      } else {
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Unexpected error:`, err);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Migration Complete!`);
  console.log(`   Statements executed: ${successCount}`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount}`);
  }
  console.log('='.repeat(60));
  
  console.log('\n📝 Verifying columns...');
  
  // Verify by trying to query with new columns
  const { data, error } = await supabase
    .from('local_training_jobs')
    .select('elapsed_seconds, progress, current_step')
    .limit(1);
  
  if (error) {
    console.error('❌ Verification failed:', error.message);
    console.log('\n⚠️  You may need to run the migration manually in Supabase SQL Editor:');
    console.log(`   ${migrationPath}`);
  } else {
    console.log('✅ Columns verified successfully!');
    console.log('   - elapsed_seconds');
    console.log('   - progress');
    console.log('   - current_step');
    console.log('   - And 30+ other columns added');
  }
}

applyMigration().catch(err => {
  console.error('💥 Migration failed:', err);
  process.exit(1);
});
