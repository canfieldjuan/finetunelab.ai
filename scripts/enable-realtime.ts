#!/usr/bin/env npx tsx

/**
 * Enable realtime for training tables
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function enableRealtime() {
  console.log('🔄 Enabling realtime for training tables...\n');

  const statements = [
    // Enable realtime publication
    `ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS local_training_jobs;`,
    `ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS local_training_metrics;`,

    // Set replica identity to FULL (required for UPDATE/DELETE events)
    `ALTER TABLE local_training_jobs REPLICA IDENTITY FULL;`,
    `ALTER TABLE local_training_metrics REPLICA IDENTITY FULL;`,

    // Grant SELECT to anon/authenticated (required for realtime)
    `GRANT SELECT ON local_training_jobs TO anon, authenticated;`,
    `GRANT SELECT ON local_training_metrics TO anon, authenticated;`,
  ];

  try {
    for (const sql of statements) {
      console.log(`Executing: ${sql.substring(0, 60)}...`);

      const { error } = await supabase.rpc('exec', { query: sql });

      if (error) {
        console.error(`❌ Error: ${error.message}`);
        console.log('\n💡 You may need to run this SQL manually in Supabase dashboard:');
        console.log('   File: docs/migrations/20251110000001_enable_realtime_for_training.sql\n');
        process.exit(1);
      }
    }

    console.log('\n✅ Realtime enabled successfully!');
    console.log('\n🔍 Testing realtime subscription...');

    // Test subscription
    const testChannel = supabase
      .channel(`test-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'local_training_jobs',
        },
        (payload) => {
          console.log('📡 Received:', payload);
        }
      )
      .subscribe((status, err) => {
        console.log('Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime is working!');
          setTimeout(() => {
            testChannel.unsubscribe();
            process.exit(0);
          }, 1000);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Still not working:', err?.message);
          setTimeout(() => {
            testChannel.unsubscribe();
            process.exit(1);
          }, 1000);
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Still timing out');
          setTimeout(() => {
            testChannel.unsubscribe();
            process.exit(1);
          }, 1000);
        }
      });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Give it a few seconds for realtime to initialize
setTimeout(() => {
  enableRealtime();
}, 500);
