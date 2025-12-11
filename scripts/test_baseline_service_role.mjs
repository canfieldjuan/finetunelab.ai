import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testBaselineCreation() {
  console.log('🧪 Testing baseline creation with service role client...\n');

  try {
    const testBaseline = {
      model_name: 'llama-3.2-3b',
      metric_name: 'accuracy',
      metric_category: 'accuracy',
      baseline_value: 0.92,
      threshold_type: 'min',
      threshold_value: 0.85,
      severity: 'warning',
      alert_enabled: true,
      description: 'Test baseline for llama 3.2 3B accuracy metric'
    };

    console.log('📝 Creating baseline:', testBaseline);

    const { data, error } = await supabase
      .from('model_baselines')
      .insert(testBaseline)
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to create baseline:', error.message);
      console.error('   Details:', error);
      return;
    }

    console.log('✅ Baseline created successfully!');
    console.log('   ID:', data.id);
    console.log('   Model:', data.model_name);
    console.log('   Metric:', data.metric_name);
    console.log('   Value:', data.baseline_value);

    // Clean up
    console.log('\n🧹 Cleaning up test baseline...');
    await supabase.from('model_baselines').delete().eq('id', data.id);
    console.log('✅ Cleanup complete');

    console.log('\n🎉 SUCCESS! The service role client works correctly!');
    console.log('   Your API endpoint should now work: POST /api/training/baselines');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testBaselineCreation();
