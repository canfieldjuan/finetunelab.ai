const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkRLSStatus() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  console.log('🔍 CHECKING CURRENT RLS POLICY STATUS');
  console.log('='.repeat(50));

  try {
    // Check current policies on local_training_metrics
    const { data, error } = await client.rpc('sql', {
      query: `
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies 
        WHERE tablename = 'local_training_metrics'
        ORDER BY policyname;
      `
    });

    if (error) {
      console.log('❌ Error fetching policies:', error);
      return;
    }

    console.log(`Found ${data.length} policies on local_training_metrics:`);
    data.forEach((policy, index) => {
      console.log(`\n${index + 1}. Policy: ${policy.policyname}`);
      console.log(`   Command: ${policy.cmd}`);
      console.log(`   Roles: ${policy.roles}`);
      console.log(`   Qualifier: ${policy.qual}`);
      console.log(`   With Check: ${policy.with_check}`);
    });

    // Check if our optimized policy exists
    const optimizedPolicy = data.find(p => p.qual && p.qual.includes('job_id IS NOT NULL'));
    
    if (optimizedPolicy) {
      console.log('\n✅ OPTIMIZED RLS POLICY IS ACTIVE');
    } else {
      console.log('\n❌ OPTIMIZED RLS POLICY NOT FOUND');
      console.log('The old expensive policy may still be active');
    }

  } catch (error) {
    console.log('❌ Database query failed:', error);
  }
}

checkRLSStatus();