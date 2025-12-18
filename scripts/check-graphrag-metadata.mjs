import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('Checking for GraphRAG metadata in recent messages...\n');

const { data: messages, error } = await supabase
  .from('messages')
  .select('id, role, created_at, metadata')
  .eq('role', 'assistant')
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

console.log(`Found ${messages.length} recent assistant messages:\n`);

let foundGraphRAG = false;
messages.forEach((msg, idx) => {
  console.log(`${idx + 1}. Message ID: ${msg.id.substring(0, 8)}... (${new Date(msg.created_at).toLocaleString()})`);

  if (msg.metadata?.graphrag) {
    foundGraphRAG = true;
    console.log('   ✅ HAS GraphRAG metadata:');
    console.log('      ', JSON.stringify(msg.metadata.graphrag, null, 2).replace(/\n/g, '\n       '));
  } else {
    console.log('   ⚠️  No GraphRAG metadata');
  }

  if (msg.metadata?.model_name) {
    console.log(`   Model: ${msg.metadata.model_name}`);
  }
  console.log('');
});

if (!foundGraphRAG) {
  console.log('❌ No GraphRAG metadata found in recent messages.');
  console.log('\nPossible reasons:');
  console.log('1. You need to send a NEW message after the backend changes');
  console.log('2. GraphRAG is not enabled or no documents uploaded');
  console.log('3. Recent queries did not trigger GraphRAG retrieval');
  console.log('4. Search confidence threshold (0.7) is filtering out all results');
  console.log('\nTry: Upload a document and ask a question about it.');
} else {
  console.log('✅ GraphRAG metadata IS being saved to database!');
  console.log('   If not visible in UI:');
  console.log('   1. Check browser console for errors');
  console.log('   2. Hard refresh the page (Ctrl+Shift+R)');
  console.log('   3. Verify the message has graphrag_used: true');
}
