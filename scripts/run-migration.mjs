#!/usr/bin/env node
/**
 * Run a Supabase migration file
 * Usage: node scripts/run-migration.mjs <migration-file-path>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Usage: node scripts/run-migration.mjs <migration-file-path>');
  process.exit(1);
}

// Read migration file
const migrationPath = resolve(__dirname, '..', migrationFile);
console.log(`📄 Reading migration: ${migrationPath}`);

let migrationSql;
try {
  migrationSql = readFileSync(migrationPath, 'utf8');
} catch (error) {
  console.error(`❌ Failed to read migration file: ${error.message}`);
  process.exit(1);
}

console.log(`✅ Migration file loaded (${migrationSql.split('\n').length} lines)`);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n🚀 Executing migration...\n');

try {
  // Execute the migration SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSql });

  if (error) {
    // If rpc doesn't exist, try direct query
    console.log('⚠️  exec_sql RPC not found, trying direct query execution...');

    // Split migration into statements and execute them
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing: ${stmt.substring(0, 80)}...`);

      const { error: stmtError } = await supabase.rpc('exec_sql', { sql: stmt + ';' });

      if (stmtError) {
        console.error(`❌ Statement failed: ${stmtError.message}`);
        throw stmtError;
      }
    }
  }

  console.log('\n✅ Migration executed successfully!');
  console.log('\n📊 Next steps:');
  console.log('   1. Verify tables created: Run verification queries');
  console.log('   2. Test RLS policies: Try CRUD operations');
  console.log('   3. Check indexes: Query pg_indexes');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error('\nError details:', error);
  process.exit(1);
}
