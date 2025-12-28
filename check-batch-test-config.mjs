import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const problematicConvId = '97d38df4-8078-481c-b475-9659dbfcc3c1';

console.log('=== CHECKING BATCH TEST CONFIGURATION ===\n');

// Get the conversation
const { data: conversation } = await supabase
  .from('conversations')
  .select('*')
  .eq('id', problematicConvId)
  .single();

console.log('CONVERSATION:');
console.log('  ID:', conversation.id);
console.log('  llm_model_id:', conversation.llm_model_id);
console.log('  widget_session_id:', conversation.widget_session_id);
console.log('  batch_test_run_id:', conversation.batch_test_run_id);
console.log('  run_id:', conversation.run_id);
console.log('');

if (conversation.batch_test_run_id) {
  // Get the batch test run
  const { data: batchRun } = await supabase
    .from('batch_test_runs')
    .select('*')
    .eq('id', conversation.batch_test_run_id)
    .single();

  console.log('BATCH TEST RUN:');
  console.log('  ID:', batchRun.id);
  console.log('  model_name:', batchRun.model_name);
  console.log('  status:', batchRun.status);
  console.log('  created_at:', batchRun.created_at);
  console.log('  config:', JSON.stringify(batchRun.config, null, 2));
  console.log('');

  console.log('=== ANALYSIS ===');
  console.log('Batch test config.model_name:', batchRun.model_name);
  console.log('Conversation llm_model_id:', conversation.llm_model_id);
  console.log('Traces model_name:', '3d086d4a-f0d3-41dd-88e7-cd24bffaa760');
  console.log('');

  if (batchRun.model_name !== conversation.llm_model_id) {
    console.log('❌ MISMATCH: Batch config model_name != conversation llm_model_id');
  } else {
    console.log('✓ Batch config model_name == conversation llm_model_id');
  }

  if (batchRun.model_name !== '3d086d4a-f0d3-41dd-88e7-cd24bffaa760') {
    console.log('❌ Batch config model_name != traces model_name');
    console.log('This means the trace is storing the WRONG model ID!');
  } else {
    console.log('✓ Batch config model_name == traces model_name');
  }
}

// Get messages from this conversation to see metadata
const { data: messages } = await supabase
  .from('messages')
  .select('role, metadata')
  .eq('conversation_id', problematicConvId)
  .order('created_at', { ascending: true });

console.log('\nMESSAGES METADATA:');
messages?.forEach((msg, idx) => {
  console.log(`\nMessage ${idx + 1} (${msg.role}):`);
  console.log('  metadata:', JSON.stringify(msg.metadata, null, 2));
});
