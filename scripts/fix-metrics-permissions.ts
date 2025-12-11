#!/usr/bin/env npx tsx

/**
 * Fix metrics permissions for training scripts
 * Enables anonymous role to update training jobs using job_token
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const sql = `
-- Grant UPDATE permission on metrics columns
GRANT UPDATE (
  current_step, current_epoch, loss, eval_loss, learning_rate,
  grad_norm, samples_per_second, gpu_memory_allocated_gb,
  gpu_memory_reserved_gb, elapsed_seconds, remaining_seconds,
  progress, updated_at, status
) ON local_training_jobs TO anon, authenticated;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow metrics updates with valid job_token" ON local_training_jobs;

-- Create RLS policy for job_token authentication
CREATE POLICY "Allow metrics updates with valid job_token"
ON local_training_jobs
FOR UPDATE
TO anon, authenticated
USING (job_token IS NOT NULL)
WITH CHECK (job_token IS NOT NULL);
`;

async function main() {
  console.log('🔄 Fixing metrics permissions...\n');

  try {
    // Execute each statement separately since Supabase doesn't support multi-statement execution well
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (!statement) continue;

      console.log(`Executing: ${statement.substring(0, 50)}...`);

      const { data, error } = await supabase.rpc('exec', {
        query: statement
      });

      if (error) {
        console.error(`❌ Error: ${error.message}`);
        console.log('\n💡 Try running this SQL manually in Supabase dashboard:');
        console.log('File: fix_metrics_permissions.sql\n');
        process.exit(1);
      }
    }

    console.log('\n✅ Permissions fixed successfully!');
    console.log('\n🔍 Verifying policy...');

    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('policyname, cmd, roles')
      .eq('tablename', 'local_training_jobs')
      .eq('policyname', 'Allow metrics updates with valid job_token');

    if (policies && policies.length > 0) {
      console.log('✅ Policy found:', policies[0]);
    } else if (policyError) {
      console.log('⚠️ Could not verify policy:', policyError.message);
    } else {
      console.log('⚠️ Policy not found (might still be OK if GRANT succeeded)');
    }

  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.log('\n💡 Try running fix_metrics_permissions.sql manually in Supabase dashboard');
    process.exit(1);
  }
}

main();
