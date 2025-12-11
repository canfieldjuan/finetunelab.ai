const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkRLSPolicies() {
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

  console.log('🔍 CHECKING RLS POLICIES ON local_training_metrics');
  console.log('='.repeat(60));

  try {
    // Query policies directly
    const { data, error } = await client
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'local_training_metrics');

    if (error) {
      console.log('❌ Error querying pg_policies:', error);
      
      // Try alternative approach
      console.log('\nTrying direct database query...');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({
          query: `
            SELECT 
              policyname,
              cmd,
              qual,
              with_check
            FROM pg_policies 
            WHERE tablename = 'local_training_metrics'
            ORDER BY policyname;
          `
        })
      });

      if (!response.ok) {
        console.log('❌ Direct query failed:', await response.text());
        return;
      }

      const result = await response.json();
      console.log('Direct query result:', result);
      return;
    }

    console.log(`Found ${data.length} policies:`);
    
    if (data.length === 0) {
      console.log('❌ NO RLS POLICIES FOUND on local_training_metrics');
      console.log('This could explain the 42501 error - RLS is enabled but no policies exist');
      return;
    }

    data.forEach((policy, index) => {
      console.log(`\n${index + 1}. Policy: ${policy.policyname}`);
      console.log(`   Command: ${policy.cmd}`);
      console.log(`   Roles: ${JSON.stringify(policy.roles)}`);
      console.log(`   Qualifier: ${policy.qual}`);
      console.log(`   With Check: ${policy.with_check}`);
    });

    // Check for our optimized policy
    const optimizedPolicy = data.find(p => 
      p.qual && p.qual.includes('job_id IS NOT NULL')
    );
    
    const expensivePolicy = data.find(p => 
      p.qual && p.qual.includes('EXISTS')
    );

    console.log('\n📊 POLICY ANALYSIS:');
    if (optimizedPolicy) {
      console.log('✅ Optimized policy found:', optimizedPolicy.policyname);
    } else {
      console.log('❌ No optimized policy found');
    }

    if (expensivePolicy) {
      console.log('⚠️  Expensive policy still exists:', expensivePolicy.policyname);
      console.log('   This could be causing timeouts that appear as RLS violations');
    }

    // Test table accessibility
    console.log('\n🧪 TESTING TABLE ACCESS:');
    
    // Test with service role (should always work)
    const { count: serviceCount, error: serviceError } = await client
      .from('local_training_metrics')
      .select('*', { count: 'exact', head: true });
      
    if (serviceError) {
      console.log('❌ Service role access failed:', serviceError);
    } else {
      console.log('✅ Service role can access table, count:', serviceCount);
    }

    // Test with anon key
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { count: anonCount, error: anonError } = await anonClient
      .from('local_training_metrics')
      .select('*', { count: 'exact', head: true });
      
    if (anonError) {
      console.log('❌ Anon access failed:', anonError);
      if (anonError.code === '42501') {
        console.log('🚨 CONFIRMED: RLS violation with anon key');
      }
    } else {
      console.log('✅ Anon key can access table, count:', anonCount);
    }

  } catch (error) {
    console.log('❌ Unexpected error:', error);
  }
}

checkRLSPolicies();