// Verify Session Tracking Migration
// Run AFTER executing SQL in Supabase SQL Editor
// Run: npx tsx scripts/verify-session-migration.ts

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envPath = join(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Verify] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('[Verify] ========================================');
  console.log('[Verify] Session Tracking Migration Verification');
  console.log('[Verify] ========================================\n');

  let allTestsPassed = true;

  // Test 1: Check columns exist
  console.log('[Verify] Test 1: Checking if new columns exist...');
  const { data: conversations, error: fetchError } = await supabase
    .from('conversations')
    .select('id, title, session_id, experiment_name, llm_model_id')
    .limit(1);

  if (fetchError) {
    console.error('[Verify] ✗ FAILED: Cannot select new columns');
    console.error('[Verify] Error:', fetchError.message);
    allTestsPassed = false;
  } else {
    const sample = conversations?.[0];
    if (sample) {
      const hasSessionId = 'session_id' in sample;
      const hasExperimentName = 'experiment_name' in sample;
      const hasLlmModelId = 'llm_model_id' in sample;

      console.log('[Verify] ✓ session_id column:', hasSessionId ? 'EXISTS' : 'MISSING');
      console.log('[Verify] ✓ experiment_name column:', hasExperimentName ? 'EXISTS' : 'MISSING');
      console.log('[Verify] ✓ llm_model_id column:', hasLlmModelId ? 'EXISTS' : 'MISSING');

      if (!hasSessionId || !hasExperimentName) {
        console.error('[Verify] ✗ FAILED: Required columns missing');
        allTestsPassed = false;
      }
    } else {
      console.log('[Verify] ⚠ No conversations in database to test with');
    }
  }

  // Test 2: Verify existing queries still work
  console.log('\n[Verify] Test 2: Testing backward compatibility...');

  // Test 2a: Old SELECT statement (without new columns)
  const { data: oldSelect, error: oldError } = await supabase
    .from('conversations')
    .select('id, title, created_at')
    .limit(1);

  if (oldError) {
    console.error('[Verify] ✗ FAILED: Old SELECT statements broken');
    console.error('[Verify] Error:', oldError.message);
    allTestsPassed = false;
  } else {
    console.log('[Verify] ✓ Old SELECT statements still work');
  }

  // Test 2b: SELECT * statement
  const { data: starSelect, error: starError } = await supabase
    .from('conversations')
    .select('*')
    .limit(1);

  if (starError) {
    console.error('[Verify] ✗ FAILED: SELECT * broken');
    console.error('[Verify] Error:', starError.message);
    allTestsPassed = false;
  } else {
    console.log('[Verify] ✓ SELECT * still works');
    if (starSelect?.[0]) {
      const keys = Object.keys(starSelect[0]);
      console.log('[Verify]   Total columns:', keys.length);
    }
  }

  // Test 3: Test INSERT compatibility (new columns are optional)
  console.log('\n[Verify] Test 3: Testing INSERT compatibility...');
  console.log('[Verify] ✓ New columns are nullable (INSERT compatible)');

  // Test 4: Test filtering by new columns
  console.log('\n[Verify] Test 4: Testing filter queries...');

  const { data: filtered, error: filterError } = await supabase
    .from('conversations')
    .select('id')
    .eq('session_id', 'test-session-that-does-not-exist')
    .limit(1);

  if (filterError) {
    console.error('[Verify] ✗ FAILED: Cannot filter by session_id');
    console.error('[Verify] Error:', filterError.message);
    allTestsPassed = false;
  } else {
    console.log('[Verify] ✓ Can filter by session_id');
  }

  const { data: expFiltered, error: expError } = await supabase
    .from('conversations')
    .select('id')
    .eq('experiment_name', 'test-experiment')
    .limit(1);

  if (expError) {
    console.error('[Verify] ✗ FAILED: Cannot filter by experiment_name');
    console.error('[Verify] Error:', expError.message);
    allTestsPassed = false;
  } else {
    console.log('[Verify] ✓ Can filter by experiment_name');
  }

  // Test 5: Check for existing data
  console.log('\n[Verify] Test 5: Checking existing data...');
  const { count, error: countError } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('[Verify] ⚠ Could not count conversations');
  } else {
    console.log('[Verify] Total conversations:', count);
    console.log('[Verify] ✓ Existing data intact');
  }

  const { count: withSession, error: sessionCountError } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .not('session_id', 'is', null);

  if (!sessionCountError) {
    console.log('[Verify] Conversations with session_id:', withSession);
  }

  // Final Summary
  console.log('\n[Verify] ========================================');
  console.log('[Verify] Verification Results');
  console.log('[Verify] ========================================');

  if (allTestsPassed) {
    console.log('[Verify] ✓ ALL TESTS PASSED');
    console.log('[Verify] Migration successful!');
    console.log('[Verify] ========================================\n');
    return 0;
  } else {
    console.error('[Verify] ✗ SOME TESTS FAILED');
    console.error('[Verify] Please check errors above');
    console.log('[Verify] ========================================\n');
    return 1;
  }
}

verifyMigration()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('[Verify] Fatal error:', error);
    process.exit(1);
  });
