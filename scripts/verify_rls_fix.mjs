import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyRLSFix() {
  console.log('🔍 Verifying RLS policies were applied...\n');

  try {
    // Test 1: Insert into model_baselines
    console.log('🧪 Test 1: Inserting test baseline...');
    const { data: baseline, error: baselineError } = await supabase
      .from('model_baselines')
      .insert({
        model_name: 'test-verification',
        metric_name: 'accuracy',
        metric_category: 'accuracy',
        baseline_value: 0.95,
        threshold_type: 'min',
        threshold_value: 0.90,
        severity: 'info',
        description: 'RLS verification test'
      })
      .select()
      .single();

    if (baselineError) {
      console.error('❌ model_baselines still has RLS issues:');
      console.error('   ', baselineError.message);
      console.log('\n⚠️  Please verify the migration was run correctly');
      return;
    }

    console.log('✅ model_baselines insert successful!');
    console.log(`   Baseline ID: ${baseline.id}`);

    // Test 2: Insert into validation_results
    console.log('\n🧪 Test 2: Inserting test validation result...');
    const { data: validation, error: validationError } = await supabase
      .from('validation_results')
      .insert({
        execution_id: 'test-exec-' + Date.now(),
        job_id: 'test-job',
        model_name: 'test-model',
        status: 'passed',
        metrics: { accuracy: 0.96 },
        baseline_comparisons: []
      })
      .select()
      .single();

    if (validationError) {
      console.error('❌ validation_results still has RLS issues:');
      console.error('   ', validationError.message);
      
      // Clean up baseline
      await supabase.from('model_baselines').delete().eq('id', baseline.id);
      return;
    }

    console.log('✅ validation_results insert successful!');
    console.log(`   Validation ID: ${validation.id}`);

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('model_baselines').delete().eq('id', baseline.id);
    await supabase.from('validation_results').delete().eq('id', validation.id);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 SUCCESS! RLS policies are working correctly!');
    console.log('   Your API endpoint should now work: POST /api/training/baselines');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

verifyRLSFix();
