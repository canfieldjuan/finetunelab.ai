import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const convId = 'fabd1573-1fb4-4112-b9f9-33fd121ed7c6';
const expectedModelId = 'd700335c-50ed-4f6a-9257-2ec5075c4819';

console.log('=== CHECKING TEST TRACES ===\n');
console.log('Conversation ID:', convId);
console.log('Expected model ID:', expectedModelId);
console.log('');

const { data: traces } = await supabase
  .from('llm_traces')
  .select('*')
  .eq('conversation_id', convId);

if (!traces || traces.length === 0) {
  console.log('No traces found for this conversation');
  console.log('The request probably failed before creating a trace');
} else {
  console.log(`Found ${traces.length} trace(s):\n`);
  traces.forEach((t, idx) => {
    console.log(`Trace ${idx + 1}:`);
    console.log('  span_id:', t.span_id);
    console.log('  model_name:', t.model_name);
    console.log('  model_provider:', t.model_provider);
    console.log('  status:', t.status);
    console.log('  error_message:', t.error_message);
    console.log('');

    if (t.model_name !== expectedModelId) {
      console.log('❌ BUG REPRODUCED!');
      console.log('Expected:', expectedModelId);
      console.log('Got:', t.model_name);
    } else {
      console.log('✓ Correct model_name');
    }
    console.log('');
  });
}

// Check messages too
const { data: messages } = await supabase
  .from('messages')
  .select('role, metadata')
  .eq('conversation_id', convId)
  .order('created_at', { ascending: true });

if (messages && messages.length > 0) {
  console.log('MESSAGES:\n');
  messages.forEach((m, idx) => {
    console.log(`Message ${idx + 1} (${m.role}):`);
    if (m.metadata && m.metadata.model_id) {
      console.log('  metadata.model_id:', m.metadata.model_id);
      if (m.metadata.model_id !== expectedModelId) {
        console.log('  ❌ Wrong model_id in message metadata!');
      } else {
        console.log('  ✓ Correct model_id');
      }
    }
    console.log('');
  });
}
