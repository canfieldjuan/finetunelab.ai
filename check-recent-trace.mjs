import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

console.log('=== CHECKING RECENT TRACE DATA ===\n');

// Get most recent trace for this user
const { data: traces } = await supabase
  .from('llm_traces')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(1);

if (!traces || traces.length === 0) {
  console.log('No traces found');
  process.exit(0);
}

const trace = traces[0];

console.log('Trace ID:', trace.trace_id);
console.log('Created:', trace.created_at);
console.log('Conversation ID:', trace.conversation_id);
console.log('');

console.log('=== INPUT DATA ===');
const inputData = trace.input_data;
console.log('Has systemPrompt:', !!inputData?.systemPrompt);
console.log('Has userMessage:', !!inputData?.userMessage);
console.log('Has conversationHistory:', !!inputData?.conversationHistory);
console.log('conversationHistory length:', inputData?.conversationHistory?.length || 0);
console.log('Has toolDefinitions:', !!inputData?.toolDefinitions);
console.log('toolDefinitions length:', inputData?.toolDefinitions?.length || 0);
console.log('');

if (inputData?.conversationHistory?.length > 0) {
  console.log('Sample conversation history:');
  inputData.conversationHistory.slice(0, 2).forEach((msg, i) => {
    console.log(`  ${i + 1}. [${msg.role}]: ${msg.content?.substring(0, 50)}...`);
  });
  console.log('');
}

if (inputData?.toolDefinitions?.length > 0) {
  console.log('Tool definitions:');
  inputData.toolDefinitions.slice(0, 5).forEach((tool, i) => {
    console.log(`  ${i + 1}. ${tool.name}`);
  });
  console.log('');
} else {
  console.log('⚠️ NO TOOL DEFINITIONS IN INPUT DATA');
  console.log('');
}

console.log('=== OUTPUT DATA ===');
const outputData = trace.output_data;
console.log('Has content:', !!outputData?.content);
console.log('Has toolCallsMade:', !!outputData?.toolCallsMade);
console.log('toolCallsMade length:', outputData?.toolCallsMade?.length || 0);
console.log('');

console.log('Full input_data:');
console.log(JSON.stringify(inputData, null, 2));
