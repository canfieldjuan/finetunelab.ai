import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CHECKING SUCCESSFUL VS FAILED TRACES ===\n');

const { data: successTrace } = await supabase
  .from('llm_traces')
  .select('span_id, model_name, model_provider, status, conversation_id, created_at, input_data')
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

const { data: failedTrace } = await supabase
  .from('llm_traces')
  .select('span_id, model_name, model_provider, status, conversation_id, created_at, input_data')
  .eq('status', 'failed')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log('SUCCESSFUL TRACE:');
console.log('  Created:', successTrace.created_at);
console.log('  Model Name:', successTrace.model_name);
console.log('  Provider:', successTrace.model_provider);
console.log('  Conversation ID:', successTrace.conversation_id);
console.log('  Has tools:', successTrace.input_data?.toolDefinitions?.length > 0 ? 'YES' : 'NO');

console.log('\nFAILED TRACE:');
console.log('  Created:', failedTrace.created_at);
console.log('  Model Name:', failedTrace.model_name);
console.log('  Provider:', failedTrace.model_provider);
console.log('  Conversation ID:', failedTrace.conversation_id);
console.log('  Has tools:', failedTrace.input_data?.toolDefinitions?.length > 0 ? 'YES' : 'NO');

if (successTrace.conversation_id) {
  const { data: conv } = await supabase
    .from('conversations')
    .select('llm_model_id')
    .eq('id', successTrace.conversation_id)
    .single();
  console.log('\n  Success conversation model_id:', conv?.llm_model_id);
}

if (failedTrace.conversation_id) {
  const { data: conv } = await supabase
    .from('conversations')
    .select('llm_model_id')
    .eq('id', failedTrace.conversation_id)
    .single();
  console.log('  Failed conversation model_id:', conv?.llm_model_id);
}
