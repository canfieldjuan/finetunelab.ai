#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('================================================');
console.log('  APPLYING WORKER METRICS DATA TYPE FIX');
console.log('================================================\n');

// Read migration SQL
const migrationSQL = `
-- Fix worker_metrics data types to accept decimal values
ALTER TABLE public.worker_metrics
  ALTER COLUMN memory_used_mb TYPE NUMERIC USING memory_used_mb::NUMERIC,
  ALTER COLUMN memory_total_mb TYPE NUMERIC USING memory_total_mb::NUMERIC,
  ALTER COLUMN disk_used_gb TYPE NUMERIC USING disk_used_gb::NUMERIC,
  ALTER COLUMN network_sent_mb TYPE NUMERIC USING network_sent_mb::NUMERIC,
  ALTER COLUMN network_recv_mb TYPE NUMERIC USING network_recv_mb::NUMERIC;
`;

console.log('Executing migration...\n');
console.log(migrationSQL);

try {
  // Execute the SQL
  const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

  if (error) {
    // Try alternative method - direct query
    const { error: altError } = await supabase
      .from('worker_metrics')
      .select('*')
      .limit(0); // Just to test connection

    if (altError) {
      console.error('❌ Connection error:', altError);
      process.exit(1);
    }

    console.log('\n⚠️  Cannot execute via RPC. Please run the SQL manually:');
    console.log('\n1. Go to: https://supabase.com/dashboard/project/tkizlemssfmrfluychsn/sql/new');
    console.log('2. Copy and paste the SQL above');
    console.log('3. Click "Run"\n');
    process.exit(0);
  }

  console.log('\n✅ Migration applied successfully!');
} catch (err) {
  console.error('❌ Error:', err.message);
  console.log('\nPlease apply the migration manually via Supabase Dashboard:');
  console.log('https://supabase.com/dashboard/project/tkizlemssfmrfluychsn/sql/new\n');
  process.exit(1);
}
