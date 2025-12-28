import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const convId = '97d38df4-8078-481c-b475-9659dbfcc3c1';

console.log('=== CHECKING CONVERSATION ===\n');
console.log('Conversation ID:', convId, '\n');

const { data: messages } = await supabase
  .from('messages')
  .select('id, role, content, created_at')
  .eq('conversation_id', convId)
  .order('created_at', { ascending: true });

console.log('Messages:', messages?.length || 0);
if (messages && messages.length > 0) {
  messages.forEach((m, i) => {
    console.log('\n' + (i + 1) + '. ' + m.role + ' - ' + m.created_at);
    console.log('   Content: ' + m.content.substring(0, 100) + '...');
  });
} else {
  console.log('  No messages in this conversation');
}

const { data: traces } = await supabase
  .from('llm_traces')
  .select('span_id, operation_type, created_at')
  .eq('conversation_id', convId);

console.log('\n\nTraces for this conversation:', traces?.length || 0);
if (traces && traces.length > 0) {
  traces.forEach(t => {
    console.log('  -', t.operation_type, 'at', t.created_at);
  });
}
