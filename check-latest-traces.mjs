import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CHECKING LATEST TRACES ===\n');

const { data: traces } = await supabase
  .from('llm_traces')
  .select('span_id, created_at, operation_type, status, parent_trace_id, input_data, output_data, error_message, model_name')
  .order('created_at', { ascending: false })
  .limit(5);

console.log('Last 5 traces:\n');
traces?.forEach((t, i) => {
  console.log((i + 1) + '. ' + t.span_id);
  console.log('   Created:', t.created_at);
  console.log('   Model:', t.model_name || 'none');
  console.log('   Operation:', t.operation_type);
  console.log('   Status:', t.status);
  console.log('   Parent:', t.parent_trace_id || 'ROOT');
  console.log('   Has tools:', t.input_data?.toolDefinitions?.length > 0 ? 'YES (' + t.input_data.toolDefinitions.length + ')' : 'NO');
  if (t.error_message) {
    console.log('   Error:', t.error_message.substring(0, 150));
  }
  if (t.output_data?.toolCallsMade) {
    console.log('   Tool calls:', t.output_data.toolCallsMade.length);
    t.output_data.toolCallsMade.forEach(tc => {
      console.log('     -', tc.name + ':', tc.success ? 'SUCCESS' : 'FAILED');
    });
  }
  console.log('');
});

const { count: childSpans } = await supabase
  .from('llm_traces')
  .select('*', { count: 'exact', head: true })
  .not('parent_trace_id', 'is', null);

console.log('Total child spans in database:', childSpans || 0);

const { count: retrievalSpans } = await supabase
  .from('llm_traces')
  .select('*', { count: 'exact', head: true })
  .eq('operation_type', 'retrieval');

console.log('Total retrieval spans:', retrievalSpans || 0);
