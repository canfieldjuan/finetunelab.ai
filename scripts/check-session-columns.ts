// Quick check: Do session tracking columns exist?
// Run: npx tsx scripts/check-session-columns.ts

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
  console.error('[Check] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('[Check] Verifying session tracking columns...\n');

  // Test 1: Try to select the columns
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, session_id, experiment_name')
    .limit(1);

  if (error) {
    console.log('[Check] ✗ Columns DO NOT exist');
    console.log('[Check] Error:', error.message);
    console.log('[Check]');
    console.log('[Check] Next steps:');
    console.log('[Check]   1. Run the migration:');
    console.log('[Check]      - Open Supabase SQL Editor');
    console.log('[Check]      - Run docs/migrations/008_add_session_tracking.sql');
    console.log('[Check]   2. Or use the migration script:');
    console.log('[Check]      - npx tsx scripts/run-session-tracking-migration.ts');
    return false;
  }

  console.log('[Check] ✓ Columns exist!');
  console.log('[Check] Sample data:', data?.[0] || 'No conversations yet');

  // Count how many have session data
  const { count: totalCount } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true });

  const { count: withSession } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .not('session_id', 'is', null);

  const { count: withExperiment } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .not('experiment_name', 'is', null);

  console.log('[Check]');
  console.log('[Check] Data population:');
  console.log(`[Check]   Total conversations: ${totalCount || 0}`);
  console.log(`[Check]   With session_id: ${withSession || 0}`);
  console.log(`[Check]   With experiment_name: ${withExperiment || 0}`);

  return true;
}

checkColumns()
  .then(exists => {
    console.log('');
    if (exists) {
      console.log('[Check] Ready to implement Phase 2 analytics!');
    } else {
      console.log('[Check] Migration needed before implementing analytics.');
    }
    process.exit(exists ? 0 : 1);
  })
  .catch(error => {
    console.error('[Check] Fatal error:', error);
    process.exit(1);
  });
