const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkTableSchema() {
  console.log('🔍 CHECKING TABLE SCHEMA FOR local_training_metrics');
  console.log('='.repeat(60));

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );

  try {
    // Try to get a few rows to see the actual structure
    console.log('1. Checking existing data structure...');
    const { data: sampleData, error: sampleError } = await serviceClient
      .from('local_training_metrics')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log('❌ Error reading table:', sampleError);
    } else {
      console.log('✅ Sample data:', JSON.stringify(sampleData, null, 2));
      
      if (sampleData.length > 0) {
        console.log('\n📊 Available columns:');
        Object.keys(sampleData[0]).forEach(col => {
          console.log(`   - ${col}: ${typeof sampleData[0][col]}`);
        });
      }
    }

    // Test different INSERT structures
    console.log('\n2. Testing different INSERT structures...');
    
    const testJobId = `schema-test-${Date.now()}`;
    
    // First ensure we have a job
    await serviceClient.from('local_training_jobs').insert({
      id: testJobId,
      model_name: 'schema-test',
      status: 'running',
      created_at: new Date().toISOString()
    });

    // Try minimal insert
    console.log('2a. Testing minimal insert...');
    const { data: minimalData, error: minimalError } = await serviceClient
      .from('local_training_metrics')
      .insert({
        job_id: testJobId,
        step: 1,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (minimalError) {
      console.log('❌ Minimal insert failed:', minimalError.code, minimalError.message);
    } else {
      console.log('✅ Minimal insert works:', minimalData);
    }

    // Try with different column names
    console.log('2b. Testing with train_loss instead of loss...');
    const { data: trainLossData, error: trainLossError } = await serviceClient
      .from('local_training_metrics')
      .insert({
        job_id: testJobId,
        step: 2,
        train_loss: 0.5,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (trainLossError) {
      console.log('❌ train_loss insert failed:', trainLossError.code, trainLossError.message);
    } else {
      console.log('✅ train_loss insert works:', trainLossData);
    }

    // Cleanup
    await serviceClient.from('local_training_metrics').delete().eq('job_id', testJobId);
    await serviceClient.from('local_training_jobs').delete().eq('id', testJobId);

  } catch (error) {
    console.log('❌ Schema check failed:', error.message);
  }
}

checkTableSchema();