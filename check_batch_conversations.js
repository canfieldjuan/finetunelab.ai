// Check for batch test conversations in database
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBatchConversations() {
  console.log('\n=== Checking Batch Test Conversations ===\n');

  // Get all conversations
  const { data: allConvos, error: allError } = await supabase
    .from('conversations')
    .select('id, user_id, title, widget_session_id, archived, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (allError) {
    console.error('Error fetching conversations:', allError);
    return;
  }

  console.log(`Total conversations (last 50): ${allConvos.length}\n`);

  // Filter batch test conversations
  const batchConvos = allConvos.filter(c => c.widget_session_id?.startsWith('batch_test_'));
  const normalConvos = allConvos.filter(c => !c.widget_session_id);

  console.log(`Batch test conversations: ${batchConvos.length}`);
  console.log(`Normal conversations: ${normalConvos.length}\n`);

  if (batchConvos.length > 0) {
    console.log('=== Batch Test Conversations ===');
    for (const convo of batchConvos) {
      // Get message count
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', convo.id);

      console.log(`\nConversation ID: ${convo.id}`);
      console.log(`  Title: ${convo.title || '(no title)'}`);
      console.log(`  Widget Session: ${convo.widget_session_id}`);
      console.log(`  Messages: ${count || 0}`);
      console.log(`  Created: ${convo.created_at}`);
      console.log(`  Archived: ${convo.archived}`);
    }
  }

  console.log('\n=== Normal Conversations (First 5) ===');
  for (const convo of normalConvos.slice(0, 5)) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', convo.id);

    console.log(`\nConversation ID: ${convo.id}`);
    console.log(`  Title: ${convo.title || '(no title)'}`);
    console.log(`  Messages: ${count || 0}`);
    console.log(`  Created: ${convo.created_at}`);
  }
}

checkBatchConversations()
  .then(() => console.log('\n=== Done ===\n'))
  .catch(err => console.error('Fatal error:', err));
