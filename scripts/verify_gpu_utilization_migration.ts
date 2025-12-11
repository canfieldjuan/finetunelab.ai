/**
 * Script to verify GPU utilization migration
 * Phase 2.1 - Training Health Metrics
 *
 * This script verifies:
 * 1. local_training_metrics table exists
 * 2. gpu_utilization_percent column exists
 * 3. Column can be queried successfully
 */

import { supabaseAdmin } from '../lib/supabaseAdmin';

async function main() {
  console.log('='.repeat(60));
  console.log('GPU Utilization Migration Verification');
  console.log('Phase 2.1 - Training Health Metrics');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Check table
  console.log('[Verify] Step 1: Checking local_training_metrics table...');
  const { error: tableError } = await supabaseAdmin
    .from('local_training_metrics')
    .select('id')
    .limit(1);

  if (tableError) {
    console.error('[Verify] ERROR: Table not accessible:', tableError.message);
    process.exit(1);
  }
  console.log('[Verify] ✓ Table exists and is accessible');

  // Step 2: Check column
  console.log('[Verify] Step 2: Checking gpu_utilization_percent column...');
  const { error: columnError } = await supabaseAdmin
    .from('local_training_metrics')
    .select('gpu_utilization_percent')
    .limit(1);

  if (columnError) {
    console.error('[Verify] ERROR: Column does not exist:', columnError.message);
    console.log('');
    console.log('Next step: Apply migration via Supabase Dashboard');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Navigate to: SQL Editor');
    console.log('3. Copy contents of: supabase/migrations/20251028000001_add_gpu_utilization.sql');
    console.log('4. Paste and run the SQL');
    console.log('5. Re-run this verification script');
    process.exit(1);
  }
  console.log('[Verify] ✓ Column exists and is queryable');

  console.log('');
  console.log('='.repeat(60));
  console.log('[Verify] SUCCESS: Migration verified');
  console.log('[Verify] Ready to collect GPU utilization metrics');
  console.log('='.repeat(60));
}

main();
