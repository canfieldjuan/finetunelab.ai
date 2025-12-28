import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const traceId = 'trace_1766442446897_4e0iw8b1wfq';

console.log('=== CHECKING TRACE STATUS ===\n');
console.log('Trace ID:', traceId);
console.log('');

const { data: traces, error } = await supabase
  .from('llm_traces')
  .select('*')
  .eq('trace_id', traceId);

if (error) {
  console.error('Error:', error);
} else {
  console.log(`Found ${traces?.length || 0} trace(s):\n`);

  traces?.forEach((trace, i) => {
    console.log(`Trace ${i + 1}:`);
    console.log('  span_id:', trace.span_id);
    console.log('  status:', trace.status);
    console.log('  operation_type:', trace.operation_type);
    console.log('  start_time:', trace.start_time);
    console.log('  end_time:', trace.end_time);
    console.log('  duration_ms:', trace.duration_ms);
    console.log('  has input_data:', !!trace.input_data);
    console.log('  has output_data:', !!trace.output_data);
    console.log('  created_at:', trace.created_at);
    console.log('  updated_at:', trace.updated_at);
    console.log('');
  });
}
