// Data Retention Cleanup Script
// Runs all retention policies to clean up old data
// Date: 2025-12-16
// Run: npx tsx scripts/run-retention-cleanup.ts

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('[RetentionCleanup] Starting data retention cleanup...');

// Load environment variables
const envPath = join(__dirname, '../.env');
let envContent: string;

try {
  envContent = readFileSync(envPath, 'utf-8');
  console.log('[RetentionCleanup] Environment file loaded');
} catch (error) {
  console.error('[RetentionCleanup] Failed to read .env file:', error);
  process.exit(1);
}

const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
  }
});

// Validate required environment variables
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[RetentionCleanup] Missing Supabase credentials');
  console.error('[RetentionCleanup] Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('[RetentionCleanup] Supabase URL:', supabaseUrl);
console.log('[RetentionCleanup] Initializing Supabase client...');

const supabase = createClient(supabaseUrl, supabaseKey);

interface CleanupResult {
  table_name: string;
  deleted_count: number;
  retention_days: number;
  cutoff_date: string;
  execution_time_ms: number;
}

async function runRetentionCleanup(): Promise<void> {
  console.log('[RetentionCleanup] Executing retention policies...\n');

  const startTime = Date.now();

  try {
    const { data, error } = await supabase.rpc('run_all_retention_policies');

    if (error) {
      console.error('[RetentionCleanup] Database error:', error.message);
      throw error;
    }

    const results = data as CleanupResult[];

    if (!results || results.length === 0) {
      console.log('[RetentionCleanup] No cleanup results returned');
      return;
    }

    console.log('[RetentionCleanup] Cleanup Results:\n');
    console.log('  Table                         | Deleted | Retention | Execution');
    console.log('  ------------------------------|---------|-----------|----------');

    let totalDeleted = 0;

    results.forEach(result => {
      const tableName = result.table_name.padEnd(29);
      const deleted = String(result.deleted_count).padStart(7);
      const retention = String(result.retention_days).padStart(9);
      const execTime = `${result.execution_time_ms.toFixed(1)}ms`.padStart(8);

      console.log(`  ${tableName} | ${deleted} | ${retention} | ${execTime}`);

      totalDeleted += result.deleted_count;
    });

    const totalTime = Date.now() - startTime;

    console.log('\n[RetentionCleanup] Summary:');
    console.log(`  Total rows deleted: ${totalDeleted.toLocaleString()}`);
    console.log(`  Total execution time: ${totalTime.toFixed(0)}ms`);
    console.log(`  Tables processed: ${results.length}`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RetentionCleanup] Cleanup failed:', errorMsg);
    throw error;
  }
}

// Execute cleanup
runRetentionCleanup()
  .then(() => {
    console.log('\n[RetentionCleanup] Cleanup completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n[RetentionCleanup] Fatal error:', error);
    process.exit(1);
  });
