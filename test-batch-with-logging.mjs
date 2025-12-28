import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== TESTING BATCH WITH DEBUG LOGGING ===\n');

const gptModelId = 'd700335c-50ed-4f6a-9257-2ec5075c4819'; // GPT-5 Mini

console.log('Creating a small batch test with GPT-5 Mini');
console.log('Model ID:', gptModelId);
console.log('');

// Create a test suite with just 1 prompt
const { data: testSuite, error: suiteError } = await supabase
  .from('test_suites')
  .insert({
    user_id: '38c85707-1fc5-40c6-84be-c017b3b8e750',
    name: 'Debug Logging Test',
    description: 'Single prompt test to check logging',
    prompt_count: 1,
    prompts: ['hello world test']
  })
  .select()
  .single();

if (suiteError) {
  console.error('Failed to create test suite:', suiteError);
  process.exit(1);
}

console.log('Created test suite:', testSuite.id);
console.log('');

// Trigger batch test
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const response = await fetch(`${baseUrl}/api/batch-testing/run`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'x-service-role-key': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'x-user-id': '38c85707-1fc5-40c6-84be-c017b3b8e750'
  },
  body: JSON.stringify({
    config: {
      model_id: gptModelId,
      test_suite_id: testSuite.id,
      prompt_limit: 1,
      concurrency: 1,
      delay_ms: 0
    }
  })
});

if (!response.ok) {
  const error = await response.text();
  console.error('Batch test failed:', error);
  process.exit(1);
}

const result = await response.json();
console.log('Batch test started:', result.test_run_id);
console.log('');

console.log('=== NEXT STEPS ===');
console.log('1. Check the server logs for [DEBUG-CHECKPOINT-*] entries');
console.log('2. Look for the request ID in the logs');
console.log('3. Track selectedModelId through all checkpoints');
console.log('4. Identify where it changes from GPT-5 Mini to Qwen (if it does)');
console.log('');
console.log('Test run ID:', result.test_run_id);
console.log('');

// Wait a few seconds for the batch test to complete
console.log('Waiting 10 seconds for batch test to complete...');
await new Promise(resolve => setTimeout(resolve, 10000));

// Check the results
const { data: batchRun } = await supabase
  .from('batch_test_runs')
  .select('*')
  .eq('id', result.test_run_id)
  .single();

console.log('Batch test status:', batchRun.status);
console.log('Completed prompts:', batchRun.completed_prompts);
console.log('Failed prompts:', batchRun.failed_prompts);
console.log('');

// Get the conversation
const { data: conversations } = await supabase
  .from('conversations')
  .select('id, llm_model_id')
  .eq('batch_test_run_id', result.test_run_id);

if (conversations && conversations.length > 0) {
  const conv = conversations[0];
  console.log('Conversation ID:', conv.id);
  console.log('Conversation llm_model_id:', conv.llm_model_id);
  console.log('');

  // Get traces
  const { data: traces } = await supabase
    .from('llm_traces')
    .select('model_name, model_provider, status')
    .eq('conversation_id', conv.id);

  if (traces && traces.length > 0) {
    console.log('TRACES:');
    traces.forEach((t, idx) => {
      console.log(`  Trace ${idx + 1}:`);
      console.log(`    model_name: ${t.model_name}`);
      console.log(`    model_provider: ${t.model_provider}`);
      console.log(`    status: ${t.status}`);
      console.log('');
    });

    const wrongModel = traces.some(t => t.model_name !== gptModelId);
    if (wrongModel) {
      console.log('❌ BUG REPRODUCED! Traces have wrong model_name');
      console.log('Expected:', gptModelId);
      console.log('Got:', traces[0].model_name);
      console.log('');
      console.log('NOW CHECK THE SERVER LOGS FOR DEBUG-CHECKPOINT ENTRIES!');
    } else {
      console.log('✓ Traces have correct model_name');
    }
  }
}
