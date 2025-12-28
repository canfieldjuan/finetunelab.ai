import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const convId = '97d38df4-8078-481c-b475-9659dbfcc3c1';

console.log('=== TRACE DETAILS FOR BROKEN BATCH TEST ===\n');

// Get ALL trace data
const { data: traces } = await supabase
  .from('llm_traces')
  .select('*')
  .eq('conversation_id', convId)
  .order('created_at', { ascending: true });

traces?.forEach((trace, idx) => {
  console.log(`\n=== TRACE ${idx + 1} ===`);
  console.log('span_id:', trace.span_id);
  console.log('created_at:', trace.created_at);
  console.log('model_name:', trace.model_name);
  console.log('model_provider:', trace.model_provider);
  console.log('operation_type:', trace.operation_type);
  console.log('status:', trace.status);
  console.log('error_message:', trace.error_message);
  console.log('error_type:', trace.error_type);
  console.log('input_data:', JSON.stringify(trace.input_data, null, 2));
  console.log('output_data:', trace.output_data ? JSON.stringify(trace.output_data, null, 2).substring(0, 200) + '...' : null);
  console.log('metadata:', JSON.stringify(trace.metadata, null, 2));
});

console.log('\n\n=== KEY QUESTION ===');
console.log('How did model_name become 3d086d4a-f0d3-41dd-88e7-cd24bffaa760');
console.log('when the batch test passed modelId: d700335c-50ed-4f6a-9257-2ec5075c4819?');
console.log('\nLet me check if there are any clues in the input_data or metadata...');
