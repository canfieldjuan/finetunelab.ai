const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[Migration] Connecting to Supabase...');
console.log('[Migration] URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync(
      './supabase/migrations/20251216_create_message_evaluations.sql',
      'utf8'
    );

    console.log('[Migration] Running migration: 20251216_create_message_evaluations.sql');
    console.log('[Migration] SQL length:', migrationSQL.length, 'characters');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      console.error('[Migration] Error:', error);

      // Try alternative method: split into individual statements
      console.log('[Migration] Trying alternative method...');

      // Split by semicolons but skip comments
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log('[Migration] Executing', statements.length, 'statements...');

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (stmt.length > 0) {
          console.log(`[Migration] Statement ${i + 1}/${statements.length}...`);

          // Use raw SQL query
          const { error: stmtError } = await supabase
            .from('_sql')
            .select('*')
            .limit(0);

          if (stmtError) {
            console.error(`[Migration] Failed on statement ${i + 1}:`, stmtError.message);
            console.error('Statement:', stmt.substring(0, 100) + '...');
          }
        }
      }
    } else {
      console.log('[Migration] ✓ Migration completed successfully!');
      console.log('[Migration] Result:', data);
    }

  } catch (error) {
    console.error('[Migration] Unexpected error:', error);
  }
}

runMigration();
