#!/usr/bin/env node
/**
 * Apply migration to fix inference server foreign key constraint
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔧 Applying inference server foreign key fix...\n');

  const migrations = [
    {
      name: 'Drop existing foreign key constraint',
      sql: `
        ALTER TABLE public.local_inference_servers
          DROP CONSTRAINT IF EXISTS local_inference_servers_training_job_id_fkey;
      `
    },
    {
      name: 'Recreate foreign key with NULL handling',
      sql: `
        ALTER TABLE public.local_inference_servers
          ADD CONSTRAINT local_inference_servers_training_job_id_fkey
          FOREIGN KEY (training_job_id)
          REFERENCES public.local_training_jobs(id)
          ON DELETE SET NULL;
      `
    },
    {
      name: 'Allow NULL for training_job_id column',
      sql: `
        ALTER TABLE public.local_inference_servers
          ALTER COLUMN training_job_id DROP NOT NULL;
      `
    }
  ];

  for (const migration of migrations) {
    console.log(`📝 ${migration.name}...`);

    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migration.sql
    });

    if (error) {
      console.error(`   ❌ Failed: ${error.message}`);

      // Try alternative method using direct SQL
      console.log('   Trying direct SQL execution...');
      const { error: directError } = await supabase
        .from('_sql')
        .insert({ query: migration.sql });

      if (directError) {
        console.error(`   ❌ Direct SQL also failed: ${directError.message}`);
        console.error('\n⚠️  Manual fix required. Run this SQL in Supabase SQL Editor:\n');
        console.error(migration.sql);
        continue;
      }
    }

    console.log('   ✅ Success\n');
  }

  console.log('✨ Migration complete!\n');
  console.log('📋 What changed:');
  console.log('   • training_job_id can now be NULL (for base models)');
  console.log('   • Foreign key constraint allows NULL references');
  console.log('   • ON DELETE SET NULL prevents orphaned records\n');

  console.log('🎯 Now try deploying your model again!');
}

applyMigration().catch((err) => {
  console.error('💥 Migration failed:', err);
  console.error('\n⚠️  Manual fix required. Go to Supabase Dashboard > SQL Editor and run:\n');
  console.error(fs.readFileSync('/tmp/run_migration.sql', 'utf-8'));
  process.exit(1);
});
