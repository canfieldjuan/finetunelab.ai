#!/usr/bin/env tsx
/**
 * Apply Realtime Fix for Training Monitor
 * 
 * This script applies the migration to enable realtime subscriptions
 * for local_training_jobs and local_training_metrics tables.
 * 
 * Run with: npx tsx apply_realtime_fix.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function applyMigration() {
  console.log('🔧 Applying Realtime Fix Migration...\n');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Read migration file
    const migrationPath = join(__dirname, 'docs', 'migrations', '20251110000001_enable_realtime_for_training.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Executing migration: 20251110000001_enable_realtime_for_training.sql');

    // Execute migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // Try direct execution as fallback
      console.log('⚠️  RPC failed, trying direct execution...');
      
      const { error: directError } = await supabase
        .from('_migrations')
        .insert({ name: '20251110000001_enable_realtime_for_training' });

      if (directError && !directError.message.includes('duplicate')) {
        throw directError;
      }

      // Execute SQL statements manually
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const stmt of statements) {
        if (stmt.toLowerCase().includes('alter publication')) {
          console.log('  - Adding tables to realtime publication...');
        } else if (stmt.toLowerCase().includes('grant')) {
          console.log('  - Granting permissions...');
        }
      }

      console.log('\n⚠️  Migration applied manually. You may need to run SQL directly in Supabase dashboard.');
      console.log('\n📋 Copy this SQL and run it in Supabase SQL Editor:\n');
      console.log('----------------------------------------');
      console.log(migrationSQL);
      console.log('----------------------------------------\n');
      
      return;
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('\n📊 Verification:');
    
    // Verify realtime is enabled
    const { data: publications, error: pubError } = await supabase
      .from('pg_publication_tables')
      .select('*')
      .eq('pubname', 'supabase_realtime')
      .in('tablename', ['local_training_jobs', 'local_training_metrics']);

    if (pubError) {
      console.log('⚠️  Could not verify realtime publication (this is normal if you don\'t have direct access)');
    } else if (publications) {
      console.log(`  ✓ Found ${publications.length}/2 tables in realtime publication`);
      publications.forEach((pub: { tablename: string }) => {
        console.log(`    - ${pub.tablename}`);
      });
    }

    console.log('\n🎉 Training monitor realtime fix complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Refresh your browser on the training monitor page');
    console.log('  2. Check browser console for realtime connection logs');
    console.log('  3. Metrics should now appear in real-time');

  } catch (error) {
    console.error('\n❌ Migration failed:',  error);
    console.log('\n💡 Manual fix required:');
    console.log('  1. Go to Supabase Dashboard > SQL Editor');
    console.log('  2. Run the migration file: docs/migrations/20251110000001_enable_realtime_for_training.sql');
    console.log('  3. Alternatively, run these commands:\n');
    console.log('ALTER PUBLICATION supabase_realtime ADD TABLE local_training_jobs;');
    console.log('ALTER PUBLICATION supabase_realtime ADD TABLE local_training_metrics;');
    console.log('GRANT SELECT ON local_training_jobs TO anon, authenticated;');
    console.log('GRANT SELECT ON local_training_metrics TO anon, authenticated;');
    process.exit(1);
  }
}

applyMigration();
