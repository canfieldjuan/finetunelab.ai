const { createClient } = require('@supabase/supabase-js');

async function debugNextJSRLS() {
  console.log('🔍 DEBUGGING NEXT.JS RLS ISSUES');
  console.log('='.repeat(50));

  // Check environment variables
  console.log('\n1. ENVIRONMENT VARIABLES:');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET (length: ' + process.env.SUPABASE_ANON_KEY.length + ')' : 'MISSING');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'MISSING');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.log('❌ Missing required environment variables');
    return;
  }

  // Test different client configurations
  console.log('\n2. CLIENT CONFIGURATIONS:');
  
  // Anon client (subject to RLS)
  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  
  // Service role client (bypasses RLS)
  const serviceClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  console.log('Anon client created:', !!anonClient);
  console.log('Service client created:', !!serviceClient);

  // Test current RLS policies
  console.log('\n3. TESTING CURRENT RLS POLICIES:');
  
  try {
    // Check if optimized RLS policy is active
    const { data: policies, error: policyError } = await serviceClient
      .rpc('get_policies', { table_name: 'local_training_metrics' })
      .single();
      
    if (policyError) {
      console.log('⚠️  Could not fetch policies:', policyError.message);
    } else {
      console.log('Current policies found:', !!policies);
    }
  } catch (error) {
    console.log('⚠️  Policy check failed:', error.message);
  }

  // Test direct INSERT with anon client
  console.log('\n4. TESTING INSERT WITH ANON CLIENT:');
  const testJobId = 'test-nextjs-' + Date.now();
  
  try {
    // First, create a job (this should work)
    const { data: jobData, error: jobError } = await anonClient
      .from('local_training_jobs')
      .insert({
        id: testJobId,
        model_name: 'test-model',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.log('❌ Job creation failed:', jobError);
      return;
    }
    
    console.log('✅ Job created successfully:', jobData.id);

    // Now try to insert metrics (this is where RLS might fail)
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
      console.log('❌ Metrics insert failed:');
      console.log('Error code:', metricsError.code);
      console.log('Error message:', metricsError.message);
      console.log('Error details:', metricsError.details);
      console.log('Error hint:', metricsError.hint);
      
      // Check if this is the specific RLS error
      if (metricsError.code === '42501') {
        console.log('🚨 RLS POLICY VIOLATION DETECTED');
        console.log('This suggests the optimized RLS policy may not be active');
      }
    } else {
      console.log('✅ Metrics insert successful:', metricsData.id);
    }

    // Cleanup
    await anonClient.from('local_training_jobs').delete().eq('id', testJobId);
    
  } catch (error) {
    console.log('❌ Test failed with exception:', error.message);
  }

  // Test with different auth contexts
  console.log('\n5. TESTING DIFFERENT AUTH CONTEXTS:');
  
  // Test with explicit auth headers
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/local_training_metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        job_id: 'test-fetch-' + Date.now(),
        step: 1,
        loss: 0.5,
        learning_rate: 0.001,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.log('❌ Fetch API failed:', response.status, errorData);
    } else {
      const data = await response.json();
      console.log('✅ Fetch API successful:', data.length || 'no data');
    }
  } catch (error) {
    console.log('❌ Fetch API error:', error.message);
  }

  console.log('\n6. NEXT.JS SPECIFIC CHECKS:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Process platform:', process.platform);
  console.log('Process version:', process.version);
  
  // Check if we're in a serverless environment
  console.log('AWS_LAMBDA_FUNCTION_NAME:', process.env.AWS_LAMBDA_FUNCTION_NAME || 'NOT_SET');
  console.log('VERCEL:', process.env.VERCEL || 'NOT_SET');
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

debugNextJSRLS().catch(console.error);