/**
 * Script to apply GPU utilization migration
 * Phase 2.1 - Training Health Metrics
 *
 * This script:
 * 1. Verifies local_training_metrics table exists
 * 2. Checks if gpu_utilization_percent column already exists
 * 3. Applies migration if needed
 * 4. Verifies successful application
 */

import { supabaseAdmin } from '../lib/supabaseAdmin';
import * as fs from 'fs';
import * as path from 'path';

async function verifyTableExists(): Promise<boolean> {
  console.log('[Migration] Step 1: Verifying local_training_metrics table exists...');

  const { data, error } = await supabaseAdmin
    .from('local_training_metrics')
    .select('id')
    .limit(1);

  if (error) {
    console.error('[Migration] ERROR: Table does not exist or cannot be accessed:', error.message);
    return false;
  }

  console.log('[Migration] ✓ Table exists');
  return true;
}

async function checkColumnExists(): Promise<boolean> {
  console.log('[Migration] Step 2: Checking if gpu_utilization_percent column exists...');

  // Query information_schema to check column
  const { data, error } = await supabaseAdmin.rpc('check_column_exists', {
    table_name: 'local_training_metrics',
    column_name: 'gpu_utilization_percent'
  });

  if (error) {
    // Function might not exist, try alternate method
    console.log('[Migration] Checking via direct query...');
    const { error: queryError } = await supabaseAdmin
      .from('local_training_metrics')
      .select('gpu_utilization_percent')
      .limit(1);

    if (queryError?.message.includes('column') && queryError?.message.includes('does not exist')) {
      console.log('[Migration] ✓ Column does not exist (ready to create)');
      return false;
    }

    console.log('[Migration] ✓ Column already exists');
    return true;
  }

  return Boolean(data);
}

async function applyMigration(): Promise<boolean> {
  console.log('[Migration] Step 3: Applying migration...');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251028000001_add_gpu_utilization.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('[Migration] Executing SQL migration...');

    // Execute migration using rpc to run raw SQL
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // RPC function might not exist, try direct approach
      console.log('[Migration] RPC not available, using direct SQL execution...');

      // Split into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.toUpperCase().startsWith('BEGIN') || statement.toUpperCase().startsWith('COMMIT')) {
          continue; // Skip transaction controls in Supabase client
        }

        const { error: stmtError } = await supabaseAdmin.rpc('exec', { query: statement });
        if (stmtError) {
          console.error('[Migration] ERROR executing statement:', stmtError.message);
          return false;
        }
      }
    }

    console.log('[Migration] ✓ Migration applied successfully');
    return true;
  } catch (err) {
    console.error('[Migration] ERROR reading or applying migration:', err);
    return false;
  }
}

async function verifyMigration(): Promise<boolean> {
  console.log('[Migration] Step 4: Verifying migration was applied...');

  // Try to select the new column
  const { error } = await supabaseAdmin
    .from('local_training_metrics')
    .select('gpu_utilization_percent')
    .limit(1);

  if (error) {
    console.error('[Migration] ERROR: Column still does not exist:', error.message);
    return false;
  }

  console.log('[Migration] ✓ Column gpu_utilization_percent exists and is accessible');
  return true;
}

async function main() {
  console.log('='.repeat(60));
  console.log('GPU Utilization Migration Script');
  console.log('Phase 2.1 - Training Health Metrics');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Verify table exists
    const tableExists = await verifyTableExists();
    if (!tableExists) {
      console.error('[Migration] FAILED: Table does not exist');
      process.exit(1);
    }

    // Step 2: Check if column already exists
    const columnExists = await checkColumnExists();
    if (columnExists) {
      console.log('[Migration] Column already exists. No action needed.');
      console.log('[Migration] SUCCESS: Migration is already applied');
      process.exit(0);
    }

    // Step 3: Apply migration
    const applied = await applyMigration();
    if (!applied) {
      console.error('[Migration] FAILED: Could not apply migration');
      process.exit(1);
    }

    // Step 4: Verify migration
    const verified = await verifyMigration();
    if (!verified) {
      console.error('[Migration] FAILED: Migration applied but verification failed');
      process.exit(1);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('[Migration] SUCCESS: GPU utilization column added');
    console.log('[Migration] Ready to collect GPU utilization metrics');
    console.log('='.repeat(60));
    process.exit(0);
  } catch (error) {
    console.error('[Migration] UNEXPECTED ERROR:', error);
    process.exit(1);
  }
}

main();
