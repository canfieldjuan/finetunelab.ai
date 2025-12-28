import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const convId = 'fabd1573-1fb4-4112-b9f9-33fd121ed7c6';

console.log('=== CHECKING MESSAGES ===\n');

const { data: messages } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', convId)
  .order('created_at', { ascending: true });

console.log('Messages count:', messages?.length || 0);
console.log('');

if (messages) {
  messages.forEach((m, idx) => {
    console.log(`Message ${idx + 1}:`);
    console.log('  Role:', m.role);
    console.log('  Content:', m.content.substring(0, 100));
    console.log('  Metadata:', JSON.stringify(m.metadata, null, 2));
    console.log('');
  });
}
