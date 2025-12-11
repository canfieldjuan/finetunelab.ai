import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPolicies() {
  console.log('🔍 Checking RLS policies for model_baselines...\n');

  const { data, error } = await supabase.rpc('exec_sql', {
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
      WHERE tablename = 'model_baselines';
    `
  }).single();

  if (error) {
    console.log('Trying alternative method...\n');
    
    // Try a simple insert to see the actual error
    const { error: insertError } = await supabase
      .from('model_baselines')
      .insert({
        model_name: 'test',
        metric_name: 'test',
        metric_category: 'accuracy',
        baseline_value: 1.0,
        threshold_type: 'min',
        threshold_value: 0.8,
        severity: 'info'
      });
    
    console.log('Insert error:', insertError);
  } else {
    console.log('Policies found:', data);
  }
}

checkPolicies();
