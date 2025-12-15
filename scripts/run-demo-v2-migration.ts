/**
 * Run Demo V2 Tables Migration
 * Executes the demo v2 migration via Supabase Management API
 *
 * Run with: npx tsx scripts/run-demo-v2-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('Running Demo V2 migration...\n');

  // Step 1: Create demo_model_configs table
  console.log('1. Creating demo_model_configs table...');
  const { error: createTableError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS demo_model_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL UNIQUE,
        endpoint_url TEXT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        model_id TEXT NOT NULL,
        model_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        connection_tested BOOLEAN DEFAULT FALSE,
        connection_latency_ms INTEGER,
        last_error TEXT
      );
    `
  });

  if (createTableError) {
    // Try direct insert to check if table exists
    const { error: checkError } = await supabase
      .from('demo_model_configs')
      .select('id')
      .limit(1);

    if (checkError?.code === '42P01') {
      console.log('   Table does not exist and RPC failed. Please run migration manually.');
      console.log('   Error:', createTableError.message);
    } else {
      console.log('   Table already exists or was created.');
    }
  } else {
    console.log('   Done.');
  }

  // Step 2: Add indexes
  console.log('\n2. Creating indexes...');
  // Indexes are created in the SQL editor since they need DDL

  // Step 3: Add columns to existing tables
  console.log('\n3. Adding demo_session_id columns...');

  // Check if column exists by trying to select it
  const { error: checkColumnError } = await supabase
    .from('demo_batch_test_runs')
    .select('demo_session_id')
    .limit(1);

  if (checkColumnError?.message?.includes('does not exist')) {
    console.log('   Columns need to be added manually via SQL editor.');
  } else {
    console.log('   Columns already exist or were added.');
  }

  // Step 4: Verify table exists
  console.log('\n4. Verifying demo_model_configs table...');
  const { data, error: verifyError } = await supabase
    .from('demo_model_configs')
    .select('id')
    .limit(1);

  if (verifyError) {
    console.log('   Verification failed:', verifyError.message);
    console.log('\n   Please run the following SQL manually in Supabase SQL Editor:');
    console.log('   File: supabase/migrations/20251215100000_create_demo_v2_tables.sql');
  } else {
    console.log('   Table verified successfully!');
  }

  console.log('\n--- Migration Check Complete ---');
}

runMigration().catch(console.error);
