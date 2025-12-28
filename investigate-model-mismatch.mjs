import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const problematicConvId = '97d38df4-8078-481c-b475-9659dbfcc3c1';

console.log('=== INVESTIGATING MODEL MISMATCH ===\n');

// Get the conversation details
const { data: conversation } = await supabase
  .from('conversations')
  .select('*')
  .eq('id', problematicConvId)
  .single();

console.log('CONVERSATION RECORD:');
console.log('  ID:', conversation.id);
console.log('  llm_model_id:', conversation.llm_model_id);
console.log('  created_at:', conversation.created_at);
console.log('  user_id:', conversation.user_id);
console.log('');

// Get the actual model it should be using
const { data: correctModel } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', conversation.llm_model_id)
  .single();

console.log('CORRECT MODEL (from conversation.llm_model_id):');
console.log('  ID:', correctModel.id);
console.log('  Name:', correctModel.name);
console.log('  Provider:', correctModel.provider);
console.log('  Model ID:', correctModel.model_id);
console.log('');

// Get all traces for this conversation
const { data: traces } = await supabase
  .from('llm_traces')
  .select('*')
  .eq('conversation_id', problematicConvId)
  .order('created_at', { ascending: true });

console.log('TRACES FOR THIS CONVERSATION:');
console.log('  Total traces:', traces?.length || 0);
console.log('');

traces?.forEach((trace, idx) => {
  console.log(`Trace ${idx + 1}:`);
  console.log('  span_id:', trace.span_id);
  console.log('  model_name:', trace.model_name);
  console.log('  model_provider:', trace.model_provider);
  console.log('  operation_type:', trace.operation_type);
  console.log('  status:', trace.status);
  console.log('  created_at:', trace.created_at);
  console.log('');
});

// Check what model the traces are pointing to
const wrongModelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';
const { data: wrongModel } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', wrongModelId)
  .single();

console.log('WRONG MODEL (from traces.model_name):');
console.log('  ID:', wrongModel.id);
console.log('  Name:', wrongModel.name);
console.log('  Provider:', wrongModel.provider);
console.log('  Model ID:', wrongModel.model_id);
console.log('');

console.log('=== ANALYSIS ===');
console.log('Expected model_name in traces:', conversation.llm_model_id);
console.log('Actual model_name in traces:', traces?.[0]?.model_name);
console.log('Match:', conversation.llm_model_id === traces?.[0]?.model_name ? '✓' : '❌');
console.log('');
console.log('This means the chat API is passing the WRONG selectedModelId to startTrace()');
