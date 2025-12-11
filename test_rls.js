// Simple RLS Policy Check using Direct Table Queries
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkRLSPolicies() {
  console.log('=== RLS POLICY VERIFICATION ===');
  console.log('Time:', new Date().toISOString());
  console.log();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('Missing credentials');
    process.exit(1);
  }

  console.log('Supabase URL:', supabaseUrl);
  console.log('Service Key available:', !!serviceKey);
  console.log('Anon Key available:', !!anonKey);
  console.log();

  // Test with service role (should bypass RLS)
  const supabaseService = createClient(supabaseUrl, serviceKey);
  
  // Test with anon key (subject to RLS)
  const supabaseAnon = createClient(supabaseUrl, anonKey);

  try {
    console.log('--- 1. Test Service Role Access to local_training_metrics ---');
    const { data: serviceData, error: serviceError } = await supabaseService
      .from('local_training_metrics')
      .select('*')
      .limit(1);
    
    if (serviceError) {
      console.log('Service Role Error:', serviceError);
    } else {
      console.log('Service Role Success:', serviceData?.length || 0, 'records found');
    }
    console.log();

    console.log('--- 2. Test Anon Role Access to local_training_metrics ---');
    const { data: anonData, error: anonError } = await supabaseAnon
      .from('local_training_metrics')
      .select('*')
      .limit(1);
    
    if (anonError) {
      console.log('Anon Role Error:', anonError);
    } else {
      console.log('Anon Role Success:', anonData?.length || 0, 'records found');
    }
    console.log();

    console.log('--- 3. Test Anon INSERT to local_training_metrics (should fail without RLS policy) ---');
    const testJobId = 'test-job-' + Date.now();
    
    // Get a valid user ID from existing data
    console.log('Getting valid user ID...');
    const { data: existingJob } = await supabaseService
      .from('local_training_jobs')
      .select('user_id')
      .limit(1)
      .single();
    
    const validUserId = existingJob?.user_id || '00000000-0000-0000-0000-000000000000';
    console.log('Using user ID:', validUserId);
    
    // First create a job record (simulating what happens in production)
    console.log('Creating test job with Service Role...');
    const { error: jobCreateError } = await supabaseService
      .from('local_training_jobs')
      .insert({
        id: testJobId,
        user_id: validUserId,
        model_name: 'test-model',
        status: 'running',
        job_token: 'test-token-123'
      });
    
    if (jobCreateError) {
      console.log('Job Create Error:', jobCreateError);
      return;
    }
    console.log('Test job created successfully');

    // First, let's check the actual schema of local_training_metrics
    console.log('Checking metrics table schema...');
    const { data: sampleMetrics, error: schemaError } = await supabaseService
      .from('local_training_metrics')
      .select('*')
      .limit(1);
    
    if (schemaError) {
      console.log('Schema Error:', schemaError);
    } else {
      console.log('Sample metrics record:', sampleMetrics?.[0] ? Object.keys(sampleMetrics[0]) : 'No records');
    }
    
    // Now try to insert metrics with Anon key (this is what fails in production)
    console.log('Attempting metrics insert with Anon key...');
    const { error: metricsError } = await supabaseAnon
      .from('local_training_metrics')
      .insert({
        job_id: testJobId,
        step: 1,
        epoch: 1,
        current_loss: 1.0,  // Use current_loss instead of loss
        learning_rate: 0.001
      });
    
    if (metricsError) {
      console.log('❌ METRICS INSERT FAILED (expected if RLS policy not applied):', metricsError);
    } else {
      console.log('✅ METRICS INSERT SUCCESS (RLS policy is working)');
    }

    // Cleanup test data
    console.log('Cleaning up test data...');
    await supabaseService.from('local_training_metrics').delete().eq('job_id', testJobId);
    await supabaseService.from('local_training_jobs').delete().eq('id', testJobId);
    console.log('Cleanup complete');

    console.log();
    console.log('=== VERIFICATION COMPLETE ===');

  } catch (error) {
    console.error('Verification failed:', error);
  }
}

checkRLSPolicies();