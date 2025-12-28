import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const widgetSessionId = 'batch_test_a97019bf-63c5-4a58-99ac-c7d47656cc45';

console.log('=== WIDGET SESSION ANALYSIS ===\n');
console.log('Widget Session ID:', widgetSessionId);
console.log('');

// Get ALL conversations for this widget session
const { data: conversations } = await supabase
  .from('conversations')
  .select('id, llm_model_id, created_at, title')
  .eq('widget_session_id', widgetSessionId)
  .order('created_at', { ascending: true });

console.log('CONVERSATIONS IN THIS WIDGET SESSION:');
console.log('Total:', conversations?.length || 0);
console.log('');

conversations?.forEach((conv, idx) => {
  console.log(`Conversation ${idx + 1}:`);
  console.log('  ID:', conv.id);
  console.log('  llm_model_id:', conv.llm_model_id);
  console.log('  created_at:', conv.created_at);
  console.log('  title:', conv.title);
  console.log('');
});

// Check if there are traces from OTHER models in this widget session
console.log('=== CHECKING FOR MODEL CONFUSION ===\n');

const convIds = conversations?.map(c => c.id) || [];
if (convIds.length > 0) {
  const { data: allTraces } = await supabase
    .from('llm_traces')
    .select('conversation_id, model_name, model_provider, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true });

  console.log('ALL TRACES IN WIDGET SESSION:');
  const tracesByModel = {};
  allTraces?.forEach(t => {
    if (!tracesByModel[t.model_name]) {
      tracesByModel[t.model_name] = [];
    }
    tracesByModel[t.model_name].push(t);
  });

  Object.entries(tracesByModel).forEach(([modelName, traces]) => {
    console.log(`\nModel: ${modelName}`);
    console.log(`  Count: ${traces.length}`);
    console.log(`  Provider: ${traces[0].model_provider}`);
    console.log(`  First trace: ${traces[0].created_at}`);
    console.log(`  Conversations: ${[...new Set(traces.map(t => t.conversation_id))].join(', ')}`);
  });
}

console.log('\n\n=== THEORY ===');
console.log('If widget sessions cache the model ID, this might explain');
console.log('why subsequent requests use the wrong model.');
console.log('Check if there is a widget session cache or state storage.');
