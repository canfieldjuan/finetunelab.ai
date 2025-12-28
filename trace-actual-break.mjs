import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const modelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

console.log('=== FINDING WHEN IT BROKE ===\n');

// Get ALL traces for this model, ordered by time
const { data: allTraces } = await supabase
  .from('llm_traces')
  .select('span_id, created_at, status, model_provider, error_message')
  .eq('model_name', modelId)
  .order('created_at', { ascending: true });

console.log('Total traces for this model:', allTraces?.length || 0);
console.log('');

const successful = allTraces?.filter(t => t.status === 'completed') || [];
const failed = allTraces?.filter(t => t.status === 'failed') || [];

console.log('Successful:', successful.length);
console.log('Failed:', failed.length);
console.log('');

if (successful.length > 0) {
  console.log('FIRST SUCCESSFUL:');
  console.log('  Time:', successful[0].created_at);
  console.log('  Provider:', successful[0].model_provider);
  console.log('');
  
  console.log('LAST SUCCESSFUL:');
  console.log('  Time:', successful[successful.length - 1].created_at);
  console.log('  Provider:', successful[successful.length - 1].model_provider);
  console.log('');
}

if (failed.length > 0) {
  console.log('FIRST FAILED:');
  console.log('  Time:', failed[0].created_at);
  console.log('  Provider:', failed[0].model_provider);
  console.log('  Error:', failed[0].error_message?.substring(0, 100));
  console.log('');
}

// Check when the break happened
if (successful.length > 0 && failed.length > 0) {
  const lastSuccess = new Date(successful[successful.length - 1].created_at);
  const firstFail = new Date(failed[0].created_at);
  
  console.log('=== TIMELINE ===');
  console.log('Last success:', lastSuccess.toISOString());
  console.log('First failure:', firstFail.toISOString());
  console.log('Time between:', Math.round((firstFail - lastSuccess) / 1000 / 60), 'minutes');
}
