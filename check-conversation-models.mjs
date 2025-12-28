import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CONVERSATION MODEL ASSIGNMENTS ===\n');

// Get all conversations that have traces for our target model
const targetModelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

const { data: traces } = await supabase
  .from('llm_traces')
  .select('conversation_id, model_provider, status, created_at')
  .eq('model_name', targetModelId)
  .order('created_at', { ascending: true });

const convIds = [...new Set(traces?.map(t => t.conversation_id))];

console.log(`Found ${convIds.length} conversations with traces for model ${targetModelId}\n`);

// Get the actual conversation records
const { data: conversations } = await supabase
  .from('conversations')
  .select('id, llm_model_id, created_at')
  .in('id', convIds);

console.log('CONVERSATION → MODEL MAPPING:\n');
conversations?.forEach(conv => {
  const convTraces = traces?.filter(t => t.conversation_id === conv.id) || [];
  const providers = [...new Set(convTraces.map(t => t.model_provider))];
  const statuses = {
    completed: convTraces.filter(t => t.status === 'completed').length,
    failed: convTraces.filter(t => t.status === 'failed').length
  };

  console.log(`Conversation: ${conv.id}`);
  console.log(`  Created: ${conv.created_at}`);
  console.log(`  Actual Model ID: ${conv.llm_model_id}`);
  console.log(`  Trace Providers: ${providers.join(', ')}`);
  console.log(`  Trace Results: ${statuses.completed} completed, ${statuses.failed} failed`);
  console.log('');
});

// Now check if the traces are recording the conversation's model correctly
console.log('\n=== TRACE MODEL vs CONVERSATION MODEL ===\n');
conversations?.forEach(conv => {
  const convTraces = traces?.filter(t => t.conversation_id === conv.id) || [];
  const mismatch = conv.llm_model_id !== targetModelId;

  if (mismatch) {
    console.log(`❌ MISMATCH in Conversation ${conv.id.substring(0, 12)}...`);
    console.log(`   Conversation.llm_model_id: ${conv.llm_model_id}`);
    console.log(`   Trace.model_name: ${targetModelId}`);
    console.log(`   Providers in traces: ${[...new Set(convTraces.map(t => t.model_provider))].join(', ')}`);
    console.log('');
  } else {
    console.log(`✓ Match in Conversation ${conv.id.substring(0, 12)}...`);
  }
});
