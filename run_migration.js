#!/usr/bin/env node
/**
 * Apply database migration to fix inference server foreign key
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Found' : 'Missing');
  console.error('\n   Add SUPABASE_SERVICE_ROLE_KEY to your .env file');
  console.error('   Get it from: Supabase Dashboard > Settings > API > service_role');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🔧 Applying migration to fix foreign key constraint...\n');

  // Step 1: Drop constraint
  console.log('Step 1: Dropping existing foreign key constraint...');
  const { error: error1 } = await supabase.rpc('exec', {
    sql: `ALTER TABLE public.local_inference_servers DROP CONSTRAINT IF EXISTS local_inference_servers_training_job_id_fkey;`
  });

  if (error1) {
    console.log('   ⚠️  RPC method not available, trying direct approach...');
  } else {
    console.log('   ✅ Constraint dropped\n');
  }

  // Step 2: Make column nullable
  console.log('Step 2: Making training_job_id nullable...');
  const { error: error2 } = await supabase.rpc('exec', {
    sql: `ALTER TABLE public.local_inference_servers ALTER COLUMN training_job_id DROP NOT NULL;`
  });

  if (error2) {
    console.log('   ⚠️  RPC method not available\n');
  } else {
    console.log('   ✅ Column is now nullable\n');
  }

  // Step 3: Recreate constraint
  console.log('Step 3: Recreating foreign key with NULL support...');
  const { error: error3 } = await supabase.rpc('exec', {
    sql: `ALTER TABLE public.local_inference_servers ADD CONSTRAINT local_inference_servers_training_job_id_fkey FOREIGN KEY (training_job_id) REFERENCES public.local_training_jobs(id) ON DELETE SET NULL;`
  });

  if (error3) {
    console.log('   ⚠️  RPC method not available\n');
  } else {
    console.log('   ✅ Constraint recreated with NULL support\n');
  }

  if (error1 || error2 || error3) {
    console.log('⚠️  RPC exec method not available. Manual fix required:\n');
    console.log('Go to Supabase Dashboard > SQL Editor and run:\n');
    console.log('-- Drop existing constraint');
    console.log('ALTER TABLE public.local_inference_servers');
    console.log('  DROP CONSTRAINT IF EXISTS local_inference_servers_training_job_id_fkey;');
    console.log('');
    console.log('-- Make column nullable');
    console.log('ALTER TABLE public.local_inference_servers');
    console.log('  ALTER COLUMN training_job_id DROP NOT NULL;');
    console.log('');
    console.log('-- Recreate with NULL support');
    console.log('ALTER TABLE public.local_inference_servers');
    console.log('  ADD CONSTRAINT local_inference_servers_training_job_id_fkey');
    console.log('  FOREIGN KEY (training_job_id)');
    console.log('  REFERENCES public.local_training_jobs(id)');
    console.log('  ON DELETE SET NULL;');
    console.log('');
    process.exit(1);
  }

  console.log('✨ Migration complete!');
  console.log('\n🎯 Now try deploying your model again.');
}

runMigration().catch((err) => {
  console.error('💥 Migration failed:', err.message);
  process.exit(1);
});
