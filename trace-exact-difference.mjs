import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== EXACT TRACE COMPARISON ===\n');

// Get the most recent failed and successful traces
const { data: failed } = await supabase
  .from('llm_traces')
  .select('*')
  .eq('model_name', '3d086d4a-f0d3-41dd-88e7-cd24bffaa760')
  .eq('status', 'failed')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

const { data: success } = await supabase
  .from('llm_traces')
  .select('*')
  .eq('model_name', '3d086d4a-f0d3-41dd-88e7-cd24bffaa760')
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log('FAILED TRACE:');
console.log('  Created:', failed?.created_at);
console.log('  Provider:', failed?.model_provider);
console.log('  Model Name:', failed?.model_name);
console.log('  Conversation ID:', failed?.conversation_id);
console.log('  Session Tag:', failed?.session_tag);
console.log('  Error:', failed?.error_message);

console.log('\nSUCCESS TRACE:');
console.log('  Created:', success?.created_at);
console.log('  Provider:', success?.model_provider);
console.log('  Model Name:', success?.model_name);
console.log('  Conversation ID:', success?.conversation_id);
console.log('  Session Tag:', success?.session_tag);

console.log('\n=== KEY DIFFERENCES ===');
console.log('Provider changed:', failed?.model_provider, '->', success?.model_provider);
console.log('Conversation changed:', failed?.conversation_id !== success?.conversation_id);
