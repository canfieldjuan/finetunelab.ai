import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const qwenModelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

console.log('=== CHECKING QWEN BATCH TEST FAILURES ===\n');

// Get recent batch tests with Qwen
const { data: batchRuns } = await supabase
  .from('batch_test_runs')
  .select('*')
  .eq('model_name', qwenModelId)
  .order('created_at', { ascending: false })
  .limit(5);

console.log(`Found ${batchRuns?.length || 0} recent Qwen batch tests:\n`);

for (const run of batchRuns || []) {
  console.log(`Batch Test: ${run.id}`);
  console.log(`  Created: ${run.created_at}`);
  console.log(`  Status: ${run.status}`);
  console.log(`  Total: ${run.total_prompts}, Completed: ${run.completed_prompts}, Failed: ${run.failed_prompts}`);
  console.log(`  Error: ${run.error || 'none'}`);

  // Get conversation for this batch test
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, llm_model_id')
    .eq('batch_test_run_id', run.id);

  if (convs && convs.length > 0) {
    const conv = convs[0];
    console.log(`  Conversation: ${conv.id}`);
    console.log(`    llm_model_id: ${conv.llm_model_id}`);

    // Get traces
    const { data: traces } = await supabase
      .from('llm_traces')
      .select('span_id, model_name, status, error_message')
      .eq('conversation_id', conv.id);

    if (traces && traces.length > 0) {
      console.log(`    Traces: ${traces.length}`);
      traces.slice(0, 3).forEach(t => {
        console.log(`      - ${t.span_id.substring(0, 20)}... status: ${t.status}`);
        if (t.error_message) {
          console.log(`        Error: ${t.error_message.substring(0, 100)}`);
        }
      });
    }
  }

  console.log('');
}

console.log('\n=== SUMMARY ===');
console.log('If Qwen batch tests are failing, check:');
console.log('1. The error messages in traces');
console.log('2. Whether the model_id in the database is correct');
console.log('3. Whether the API key / provider secret is set up');
