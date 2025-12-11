import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Checking Realtime Status...\n');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function checkRealtimeStatus() {
  try {
    console.log('='.repeat(80));
    console.log('CHECKING REALTIME PUBLICATION STATUS');
    console.log('='.repeat(80));
    console.log('');

    // Check if tables are in realtime publication
    const { data: pubTables, error: pubError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT 
            schemaname,
            tablename
          FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND tablename IN ('local_training_jobs', 'local_training_metrics')
          ORDER BY tablename;
        `
      });

    if (pubError) {
      console.error('❌ Error checking publication tables:', pubError);
      
      // Try alternative approach - check using pg_catalog
      console.log('\n📋 Attempting alternative query...\n');
      
      const { data: altCheck, error: altError } = await supabase
        .from('local_training_jobs')
        .select('id')
        .limit(1);
      
      if (altError) {
        console.error('❌ Table query failed:', altError);
        console.log('\n⚠️  This likely means the tables exist but Realtime is NOT configured.\n');
      } else {
        console.log('✅ Tables are accessible');
        console.log('\n⚠️  Cannot verify Realtime publication status due to RPC limitations.');
        console.log('    Manual verification required in Supabase Dashboard.\n');
      }
    } else {
      console.log('Publication Tables Result:', pubTables);
      
      if (!pubTables || pubTables.length === 0) {
        console.log('');
        console.log('❌ CRITICAL: No training tables found in supabase_realtime publication!');
        console.log('');
        console.log('This means Realtime is NOT enabled for training tables.');
        console.log('');
        console.log('TO FIX:');
        console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/tkizlemssfmrfluychsn');
        console.log('2. Navigate to: Database > Replication');
        console.log('3. Find the "supabase_realtime" publication');
        console.log('4. Add tables: local_training_jobs and local_training_metrics');
        console.log('5. OR manually run the migration SQL in the SQL Editor');
        console.log('');
      } else {
        console.log('✅ Found', pubTables.length, 'tables in realtime publication');
        pubTables.forEach(table => {
          console.log('  ✓', table.tablename);
        });
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('MANUAL VERIFICATION STEPS');
    console.log('='.repeat(80));
    console.log('');
    console.log('1. Go to: https://supabase.com/dashboard/project/tkizlemssfmrfluychsn');
    console.log('2. Click: Database > Replication (left sidebar)');
    console.log('3. Check if "supabase_realtime" publication includes:');
    console.log('   - local_training_jobs');
    console.log('   - local_training_metrics');
    console.log('');
    console.log('4. If NOT listed, click "Edit publication" and add them');
    console.log('');
    console.log('5. Also verify in: Project Settings > API > Realtime');
    console.log('   - Ensure "Enable Realtime" is turned ON');
    console.log('');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

checkRealtimeStatus();
