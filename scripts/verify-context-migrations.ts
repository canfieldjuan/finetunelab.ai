#!/usr/bin/env npx tsx
/**
 * Verify Context Injection Migrations (Phase 1)
 * Checks if all three tables exist and are properly configured
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

async function verifyTable(tableName: string): Promise<boolean> {
  console.log(`\n[Verify] Checking ${tableName} table...`);

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);

    if (error) {
      console.error(`[Verify] ✗ Table ${tableName} does not exist or has errors`);
      console.error('[Verify] Error:', error.message);
      return false;
    }

    console.log(`[Verify] ✓ Table ${tableName} exists`);
    console.log(`[Verify] Current row count: ${data?.length || 0}`);
    return true;

  } catch (err: any) {
    console.error(`[Verify] Unexpected error for ${tableName}:`, err.message);
    return false;
  }
}

async function verifyMigrations() {
  console.log('[Verify] Starting Context Injection Migrations Verification...');
  console.log('[Verify] Phase 1: Database Schema\n');

  const tables = [
    'user_context_profiles',
    'user_context_activity',
    'context_injection_logs',
  ];

  let allSuccess = true;

  for (const table of tables) {
    const success = await verifyTable(table);
    if (!success) {
      allSuccess = false;
    }
  }

  if (allSuccess) {
    console.log('\n[Verify] ✓ All Phase 1 migrations verified successfully!');
    console.log('\n[Verify] Next steps:');
    console.log('[Verify] 1. Phase 2: Build context provider service types');
    console.log('[Verify] 2. Phase 2: Implement essential context fetchers');
    console.log('[Verify] 3. Phase 3: Integrate with Chat API');
  } else {
    console.error('\n[Verify] ✗ Some migrations failed verification');
    console.error('[Verify] Please apply missing migrations via Supabase Dashboard');
    process.exit(1);
  }
}

verifyMigrations();
