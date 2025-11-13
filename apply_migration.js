// Apply migration to fix user_id issue
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applyMigration() {
  console.log('\n=== Applying Migration ===\n');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Read migration file
  const migrationSQL = fs.readFileSync(
    'supabase/migrations/20251028000003_fix_inference_servers_user_id.sql',
    'utf8'
  );
  
  console.log('Executing migration SQL...\n');
  
  // Execute the migration
  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
  
  if (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Trying direct approach...\n');
    
    // Try each statement individually
    const statements = [
      'ALTER TABLE local_inference_servers ALTER COLUMN user_id DROP NOT NULL;',
    ];
    
    for (const stmt of statements) {
      console.log('Executing:', stmt.trim());
      const result = await supabase.rpc('exec_sql', { sql: stmt });
      if (result.error) {
        console.error('  Error:', result.error.message);
      } else {
        console.log('  ✓ Success');
      }
    }
  } else {
    console.log('✓ Migration applied successfully!');
  }
  
  console.log('\n=== Migration Complete ===\n');
}

applyMigration().catch(console.error);
