import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== RECENT BATCH TESTS ANALYSIS ===\n');

const correctModelId = 'd700335c-50ed-4f6a-9257-2ec5075c4819'; // GPT-5 Mini
const wrongModelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760'; // Qwen

// Get recent batch test runs
const { data: batchRuns } = await supabase
  .from('batch_test_runs')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('RECENT BATCH TEST RUNS:');
console.log('');

for (const run of batchRuns || []) {
  console.log(`Batch Test Run: ${run.id}`);
  console.log(`  Created: ${run.created_at}`);
  console.log(`  Model: ${run.model_name}`);
  console.log(`  Status: ${run.status}`);

  // Get conversations for this run
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, llm_model_id')
    .eq('batch_test_run_id', run.id);

  if (convs && convs.length > 0) {
    console.log(`  Conversations:`);
    for (const conv of convs) {
      console.log(`    - ${conv.id}: llm_model_id = ${conv.llm_model_id}`);

      // Get traces for this conversation
      const { data: traces } = await supabase
        .from('llm_traces')
        .select('model_name, model_provider, created_at')
        .eq('conversation_id', conv.id);

      if (traces && traces.length > 0) {
        const uniqueModelNames = [...new Set(traces.map(t => t.model_name))];
        console.log(`      Traces: ${traces.length} total, models: ${uniqueModelNames.join(', ')}`);

        if (conv.llm_model_id !== uniqueModelNames[0]) {
          console.log(`      ❌ MISMATCH! Conversation uses ${conv.llm_model_id} but traces show ${uniqueModelNames[0]}`);
        }
      }
    }
  }

  console.log('');
}

console.log('\n=== PATTERN ANALYSIS ===');
console.log('Looking for when the mismatch started...');

// Check if ALL recent batch tests have this issue
const problematicRuns = [];
for (const run of batchRuns || []) {
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, llm_model_id')
    .eq('batch_test_run_id', run.id);

  for (const conv of convs || []) {
    const { data: traces } = await supabase
      .from('llm_traces')
      .select('model_name')
      .eq('conversation_id', conv.id)
      .limit(1)
      .single();

    if (traces && traces.model_name !== conv.llm_model_id) {
      problematicRuns.push({
        runId: run.id,
        created: run.created_at,
        expectedModel: conv.llm_model_id,
        actualModel: traces.model_name
      });
    }
  }
}

console.log('\nProblematic runs:', problematicRuns.length);
if (problematicRuns.length > 0) {
  console.log('\nFirst occurrence:', problematicRuns[problematicRuns.length - 1].created);
  console.log('Last occurrence:', problematicRuns[0].created);
  console.log('\nThis suggests the issue is SYSTEMIC, not just one batch test!');
}
