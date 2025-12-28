import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const testRunId = '65a9f3a9-f8af-4a3e-b368-b0a1bd0e5469';

console.log('=== CHECKING LATEST TEST ERROR ===\n');

// Get conversation
const { data: convs } = await supabase
  .from('conversations')
  .select('id')
  .eq('batch_test_run_id', testRunId);

if (convs && convs.length > 0) {
  const { data: traces } = await supabase
    .from('llm_traces')
    .select('*')
    .eq('conversation_id', convs[0].id);

  if (traces && traces.length > 0) {
    console.log('TRACE ERROR:');
    console.log('  Status:', traces[0].status);
    console.log('  Model name:', traces[0].model_name);
    console.log('  Error message:', traces[0].error_message);
    console.log('  Error type:', traces[0].error_type);
  } else {
    console.log('No traces found - request failed before creating trace');
  }

  // Check messages
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', convs[0].id);

  console.log('\nMessages:', messages?.length || 0);
} else {
  console.log('No conversation found');
}
