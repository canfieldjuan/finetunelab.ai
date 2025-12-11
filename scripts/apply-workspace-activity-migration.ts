/**
 * Apply workspace_activity migration to Supabase
 * Run with: npx ts-node scripts/apply-workspace-activity-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing Supabase credentials');
  console.error('Required environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  console.log('[Migration] Starting workspace_activity migration...');
  console.log('[Migration] Supabase URL:', supabaseUrl);

  try {
    // Read the migration SQL file
    const migrationPath = path.join(
      __dirname,
      '../supabase/migrations/20251128_create_workspace_activity.sql'
    );

    console.log('[Migration] Reading migration file:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      console.error('[Migration] ERROR: Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('[Migration] Migration file loaded successfully');
    console.log('[Migration] SQL length:', migrationSQL.length, 'characters');

    // Execute the migration
    console.log('[Migration] Executing migration SQL...');

    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL,
    });

    if (error) {
      // exec_sql might not exist, try direct execution via PostgREST
      console.warn('[Migration] exec_sql RPC not found, trying alternative method...');

      // Split SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log('[Migration] Split into', statements.length, 'statements');

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (!statement) continue;

        console.log(`[Migration] Executing statement ${i + 1}/${statements.length}...`);

        try {
          // Note: This is a workaround. Ideally, use Supabase CLI or direct psql connection
          // For now, we'll output the SQL and instruct the user
          console.log('[Migration] Statement:', statement.substring(0, 100) + '...');
        } catch (err) {
          console.error(`[Migration] Error in statement ${i + 1}:`, err);
          throw err;
        }
      }

      console.log('\n[Migration] ⚠️  MANUAL MIGRATION REQUIRED ⚠️\n');
      console.log('The migration SQL needs to be applied manually.');
      console.log('\nOption 1: Using Supabase Dashboard (Recommended)');
      console.log('  1. Go to: https://supabase.com/dashboard/project/_/sql');
      console.log('  2. Paste the contents of: supabase/migrations/20251128_create_workspace_activity.sql');
      console.log('  3. Click "Run"');
      console.log('\nOption 2: Using psql');
      console.log('  1. Get your database connection string from Supabase Dashboard');
      console.log('  2. Run: psql <connection-string> -f supabase/migrations/20251128_create_workspace_activity.sql');
      console.log('\nMigration file location:');
      console.log('  ', migrationPath);
      console.log('');

      return;
    }

    console.log('[Migration] ✅ Migration applied successfully!');
    console.log('[Migration] Created:');
    console.log('  - Table: workspace_activity');
    console.log('  - Function: get_workspace_activity_feed');
    console.log('  - RLS policies for secure access');
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
