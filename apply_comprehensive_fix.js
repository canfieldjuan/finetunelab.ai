const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function applyComprehensiveRLSFix() {
  console.log('🔧 APPLYING COMPREHENSIVE RLS FIX');
  console.log('='.repeat(60));

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );

  try {
    console.log('1. Reading SQL fix file...');
    const sqlContent = fs.readFileSync('./COMPREHENSIVE_RLS_FIX.sql', 'utf8');
    
    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^=+$/));

    console.log(`Found ${statements.length} SQL statements to execute`);

    console.log('\n2. Applying RLS fixes...');
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.includes('SELECT') && (statement.includes('pg_tables') || statement.includes('pg_policies'))) {
        // Skip verification queries for now
        continue;
      }

      console.log(`Executing statement ${i + 1}: ${statement.substring(0, 80)}...`);
      
      try {
        // Use raw SQL execution through REST API
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
          },
          body: JSON.stringify({ sql: statement })
        });

        if (!response.ok) {
          console.log(`⚠️  Statement ${i + 1} failed: ${await response.text()}`);
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (error) {
        console.log(`❌ Statement ${i + 1} error:`, error.message);
      }
    }

    console.log('\n3. Testing the fix...');
    
    // Test with anon client after fix
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Test job creation
    const testJobId = `test-comprehensive-${Date.now()}`;
    
    console.log('3a. Testing job creation...');
    const { data: jobData, error: jobError } = await anonClient
      .from('local_training_jobs')
      .insert({
        id: testJobId,
        model_name: 'test-model-comprehensive',
        status: 'pending',
        config: { test: true },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.log('❌ Job creation still fails:', jobError.code, jobError.message);
    } else {
      console.log('✅ Job creation works:', jobData.id);

      console.log('3b. Testing metrics insertion...');
      const { data: metricsData, error: metricsError } = await anonClient
        .from('local_training_metrics')
        .insert({
          job_id: testJobId,
          step: 1,
          loss: 0.5,
          learning_rate: 0.001,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (metricsError) {
        console.log('❌ Metrics insertion still fails:', metricsError.code, metricsError.message);
      } else {
        console.log('✅ Metrics insertion works:', metricsData.id);
      }

      // Cleanup
      await anonClient.from('local_training_metrics').delete().eq('job_id', testJobId);
      await anonClient.from('local_training_jobs').delete().eq('id', testJobId);
      console.log('✅ Test data cleaned up');
    }

  } catch (error) {
    console.log('❌ Fix application failed:', error.message);
  }
}

applyComprehensiveRLSFix();