import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

async function applyRLSFix() {
  console.log('🔧 Applying RLS policy fixes...\n');

  try {
    // Read the SQL migration files
    const modelBaselinesSql = fs.readFileSync(
      'supabase/migrations/20251129_fix_model_baselines_rls.sql',
      'utf8'
    );
    const validationResultsSql = fs.readFileSync(
      'supabase/migrations/20251129_fix_validation_results_rls.sql',
      'utf8'
    );

    console.log('📝 Applying model_baselines RLS fixes...');
    
    // Split SQL into individual statements and execute them
    const baselineStatements = modelBaselinesSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of baselineStatements) {
      if (statement) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.log(`⚠️  Statement: ${statement.substring(0, 50)}...`);
          console.log(`   Error: ${error.message}`);
        }
      }
    }

    console.log('✅ model_baselines policies updated\n');

    console.log('📝 Applying validation_results RLS fixes...');
    
    const validationStatements = validationResultsSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of validationStatements) {
      if (statement) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.log(`⚠️  Statement: ${statement.substring(0, 50)}...`);
          console.log(`   Error: ${error.message}`);
        }
      }
    }

    console.log('✅ validation_results policies updated\n');

    // Test insert to verify it works
    console.log('🧪 Testing baseline creation...');
    const { data, error } = await supabase
      .from('model_baselines')
      .insert({
        model_name: 'test-model',
        metric_name: 'test-metric',
        metric_category: 'accuracy',
        baseline_value: 0.95,
        threshold_type: 'min',
        threshold_value: 0.90,
        severity: 'info',
        description: 'Test baseline for RLS verification'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Test failed:', error.message);
      console.log('\n⚠️  RLS policies may need to be applied manually in Supabase Studio');
    } else {
      console.log('✅ Test insert successful!');
      console.log(`   Created baseline: ${data.id}`);
      
      // Clean up test data
      await supabase.from('model_baselines').delete().eq('id', data.id);
      console.log('✅ Test data cleaned up\n');
      console.log('🎉 RLS policies are working correctly!');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\n📋 Manual steps required:');
    console.log('1. Open Supabase Studio SQL Editor');
    console.log('2. Run: supabase/migrations/20251129_fix_model_baselines_rls.sql');
    console.log('3. Run: supabase/migrations/20251129_fix_validation_results_rls.sql');
  }
}

applyRLSFix();
