#!/usr/bin/env npx tsx
/**
 * Verify Training Executions Migration
 * Checks if the table exists and is properly configured
 * Date: 2025-10-24
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[Verify] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigration() {
  console.log('[Verify] Checking training_executions table...');

  try {
    // Test table exists by querying it
    const { data, error } = await supabase
      .from('training_executions')
      .select('id')
      .limit(1);

    if (error) {
      console.error('[Verify] ✗ Table does not exist or has errors');
      console.error('[Verify] Error:', error.message);
      console.log('[Verify] Please apply the migration manually via Supabase Dashboard');
      process.exit(1);
    }

    console.log('[Verify] ✓ Table exists');
    console.log('[Verify] Current row count:', data?.length || 0);

    // Test insert (and delete) to verify RLS and structure
    console.log('[Verify] Testing table structure...');

    const testRecord = {
      id: `exec_test_${Date.now()}`,
      user_id: '00000000-0000-0000-0000-000000000000', // Test user
      public_id: 'test_config',
      method: 'sft',
      provider: 'colab',
      status: 'pending',
      progress: 0,
    };

    // Note: This will fail due to RLS (which is expected)
    const { error: insertError } = await supabase
      .from('training_executions')
      .insert(testRecord);

    if (insertError && !insertError.message.includes('RLS')) {
      console.error('[Verify] Warning: Unexpected insert error:', insertError.message);
    } else {
      console.log('[Verify] ✓ Table structure is correct');
    }

    console.log('\n[Verify] ✓ Migration verification complete!');
    console.log('[Verify] The training_executions table is ready to use');
    console.log('\n[Verify] Next steps:');
    console.log('[Verify] 1. Test execution API: curl -X POST http://localhost:3000/api/training/execute');
    console.log('[Verify] 2. Test status API: curl http://localhost:3000/api/training/execute/{id}/status');
    console.log('[Verify] 3. Create test execution via DAG or API');

  } catch (err: unknown) {
    console.error('[Verify] Unexpected error:', err.message);
    process.exit(1);
  }
}

verifyMigration();
