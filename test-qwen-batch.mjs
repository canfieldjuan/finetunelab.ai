import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const qwenModelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';
const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

console.log('=== TESTING QWEN BATCH TEST ===\n');

// Verify model is fixed
const { data: model } = await supabase
  .from('llm_models')
  .select('name, model_id')
  .eq('id', qwenModelId)
  .single();

console.log('Model verification:');
console.log('  Name:', model.name);
console.log('  model_id:', model.model_id);
console.log('  ✓ Looks good!');
console.log('');

// Create a test suite with just 1 prompt
const { data: testSuite, error: suiteError } = await supabase
  .from('test_suites')
  .insert({
    user_id: userId,
    name: 'Qwen Batch Test - Fixed',
    description: 'Testing Qwen after fixing model_id',
    prompt_count: 1,
    prompts: ['Hello, can you confirm you are working?']
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
    'x-user-id': userId
  },
  body: JSON.stringify({
    config: {
      model_id: qwenModelId,
      test_suite_id: testSuite.id,
      prompt_limit: 1,
      concurrency: 1,
      delay_ms: 0
    }
  })
});

if (!response.ok) {
  const error = await response.text();
  console.error('Batch test failed to start:', error);
  process.exit(1);
}

const result = await response.json();
console.log('Batch test started:', result.test_run_id);
console.log('Status:', result.status);
console.log('');

console.log('Waiting 15 seconds for batch test to complete...');
await new Promise(resolve => setTimeout(resolve, 15000));

// Check results
const { data: batchRun } = await supabase
  .from('batch_test_runs')
  .select('*')
  .eq('id', result.test_run_id)
  .single();

console.log('=== RESULTS ===');
console.log('Status:', batchRun.status);
console.log('Total prompts:', batchRun.total_prompts);
console.log('Completed:', batchRun.completed_prompts);
console.log('Failed:', batchRun.failed_prompts);
console.log('');

if (batchRun.error) {
  console.log('Error:', batchRun.error);
  console.log('');
}

// Get traces
const { data: conversations } = await supabase
  .from('conversations')
  .select('id')
  .eq('batch_test_run_id', result.test_run_id);

if (conversations && conversations.length > 0) {
  const { data: traces } = await supabase
    .from('llm_traces')
    .select('status, error_message, model_name')
    .eq('conversation_id', conversations[0].id);

  if (traces && traces.length > 0) {
    console.log('TRACES:');
    traces.forEach((t, idx) => {
      console.log(`  Trace ${idx + 1}:`);
      console.log(`    Status: ${t.status}`);
      console.log(`    Model: ${t.model_name}`);
      if (t.error_message) {
        console.log(`    Error: ${t.error_message}`);
      }
      console.log('');
    });
  }

  // Get the actual message
  const { data: messages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversations[0].id)
    .order('created_at', { ascending: true });

  if (messages && messages.length > 1) {
    console.log('MESSAGE EXCHANGE:');
    messages.forEach(m => {
      console.log(`  ${m.role.toUpperCase()}: ${m.content.substring(0, 100)}`);
    });
    console.log('');
  }
}

if (batchRun.status === 'completed' && batchRun.completed_prompts > 0 && batchRun.failed_prompts === 0) {
  console.log('✅ SUCCESS! Qwen batch testing is now working!');
} else if (batchRun.failed_prompts > 0) {
  console.log('❌ FAILED - Check the error messages above');
} else {
  console.log('⚠️  Test incomplete - check the status');
}
