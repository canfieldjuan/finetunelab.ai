import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CHECKING RECENT TRACE TIMESTAMPS ===\n');

const { data: traces } = await supabase
  .from('llm_traces')
  .select('span_id, created_at, operation_type, input_data')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('Last 10 traces:');
traces?.forEach((t, i) => {
  const hasTools = t.input_data?.toolDefinitions?.length > 0;
  const toolCount = hasTools ? t.input_data.toolDefinitions.length : 0;
  console.log(`${i + 1}. ${t.created_at}`);
  console.log(`   Span: ${t.span_id.substring(0, 20)}...`);
  console.log(`   Operation: ${t.operation_type}`);
  console.log(`   Tools: ${hasTools ? `✓ ${toolCount} tools` : '❌ No tools'}`);
  console.log('');
});

// Check if there are conversations table
const { data: convCheck, error: convError } = await supabase
  .from('conversations')
  .select('id')
  .limit(1);

if (convError) {
  console.log('Conversations table check:', convError.message);
} else {
  const { count } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true });
  console.log(`\nConversations table: ${count} total conversations`);
}
