// Verification script for provider misattribution fix
// Tests that model config lookup works correctly with service role client

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Testing provider attribution fix\n');

// Step 1: Find the Qwen HuggingFace model
console.log('Step 1: Looking for Qwen HuggingFace model...');
const { data: qwenModel, error: modelError } = await supabase
  .from('llm_models')
  .select('*')
  .ilike('name', '%qwen%')
  .eq('provider', 'huggingface')
  .single();

if (modelError || !qwenModel) {
  console.error('❌ Could not find Qwen HuggingFace model:', modelError);
  process.exit(1);
}

console.log('✅ Found Qwen model:');
console.log(`   - ID: ${qwenModel.id}`);
console.log(`   - Name: ${qwenModel.name}`);
console.log(`   - Provider: ${qwenModel.provider}`);
console.log(`   - is_global: ${qwenModel.is_global}`);
console.log(`   - user_id: ${qwenModel.user_id || 'null'}\n`);

// Step 2: Check recent traces for this model
console.log('Step 2: Checking recent traces for this model...');
const { data: traces, error: traceError } = await supabase
  .from('llm_traces')
  .select('id, model_name, model_provider, created_at, status')
  .eq('model_name', qwenModel.name)
  .order('created_at', { ascending: false })
  .limit(5);

if (traceError) {
  console.error('❌ Error fetching traces:', traceError);
} else if (!traces || traces.length === 0) {
  console.log('⚠️  No traces found for this model yet');
  console.log('   Please send a test message using the Qwen model to create a trace\n');
} else {
  console.log(`✅ Found ${traces.length} trace(s):\n`);
  traces.forEach((trace, idx) => {
    const isCorrect = trace.model_provider === 'huggingface';
    const icon = isCorrect ? '✅' : '❌';
    console.log(`   ${icon} Trace ${idx + 1}:`);
    console.log(`      - ID: ${trace.id}`);
    console.log(`      - Provider: ${trace.model_provider} ${isCorrect ? '(CORRECT)' : '(WRONG - should be huggingface)'}`);
    console.log(`      - Status: ${trace.status}`);
    console.log(`      - Created: ${trace.created_at}\n`);
  });
}

// Step 3: Test provider comparison data
console.log('Step 3: Checking provider comparison stats...');
const { data: allTraces } = await supabase
  .from('llm_traces')
  .select('model_provider')
  .not('model_provider', 'is', null);

const providerCounts = {};
(allTraces || []).forEach(t => {
  providerCounts[t.model_provider] = (providerCounts[t.model_provider] || 0) + 1;
});

console.log('✅ Provider distribution:');
Object.entries(providerCounts).sort((a, b) => b[1] - a[1]).forEach(([provider, count]) => {
  console.log(`   - ${provider}: ${count} traces`);
});

console.log('\n🎯 Next Steps:');
console.log('   1. Send a test message using the Qwen HuggingFace model');
console.log('   2. Run this script again to verify the new trace has correct provider');
console.log('   3. Check the Provider Comparison view in the analytics dashboard');
