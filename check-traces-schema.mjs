import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CHECKING LLM_TRACES SCHEMA ===\n');

// Get a sample trace to see all columns
const { data: traces, error } = await supabase
  .from('llm_traces')
  .select('*')
  .limit(1);

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

if (traces && traces.length > 0) {
  console.log('Available columns in llm_traces:');
  console.log(Object.keys(traces[0]).sort().join('\n'));
  console.log('\n');
} else {
  console.log('No traces found in database');
}

// Check if parent_span_id exists specifically
const { data: checkParent, error: parentError } = await supabase
  .from('llm_traces')
  .select('parent_span_id')
  .limit(1);

if (parentError) {
  console.log('❌ parent_span_id column: DOES NOT EXIST');
  console.log('   Error:', parentError.message);
} else {
  console.log('✓ parent_span_id column: EXISTS');
}
