// Verify Prompt Patterns Table
// Checks if prompt_patterns table exists and is accessible
// Date: October 14, 2025
//
// MANUAL STEP REQUIRED FIRST:
// 1. Open Supabase Dashboard SQL Editor
// 2. Copy contents of docs/schema_updates/07_prompt_patterns.sql
// 3. Execute the SQL to create the table
// 4. Then run this script to verify

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env file manually
const envPath = join(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[VerifyTable] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTable() {
  console.log('[VerifyTable] Checking if prompt_patterns table exists...');

  const { data, error } = await supabase
    .from('prompt_patterns')
    .select('id')
    .limit(1);

  if (error) {
    console.error('\n[VerifyTable] ✗ Table does not exist or is not accessible');
    console.error('Error:', error.message);
    console.log('\n📋 MANUAL STEP REQUIRED:');
    console.log('1. Open Supabase Dashboard → SQL Editor');
    console.log('2. Copy all contents from: docs/schema_updates/07_prompt_patterns.sql');
    console.log('3. Execute the SQL');
    console.log('4. Run this script again to verify\n');
    process.exit(1);
  }

  console.log('[VerifyTable] ✓ Table exists and is accessible');

  // Verify columns
  const testPattern = {
    user_id: '00000000-0000-0000-0000-000000000000',
    name: 'test_pattern_verify',
    template: 'Test template: {{variable}}',
    use_case: 'testing',
    success_rate: 0.85,
    avg_rating: 0.9,
    metadata: { test: true },
  };

  const { error: insertError } = await supabase
    .from('prompt_patterns')
    .insert(testPattern);

  if (insertError && insertError.code !== '23503') { // Ignore foreign key error (expected)
    console.error('[VerifyTable] ✗ Table structure issue:', insertError);
    process.exit(1);
  }

  console.log('[VerifyTable] ✓ Table structure is correct');
  console.log('\n[VerifyTable] Migration verification complete! ✓');
}

// Run verification
verifyTable()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[VerifyTable] Fatal error:', error);
    process.exit(1);
  });
