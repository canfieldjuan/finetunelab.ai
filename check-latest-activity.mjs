import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CHECKING LATEST ACTIVITY ===\n');

const { data: latestTrace } = await supabase
  .from('llm_traces')
  .select('created_at, span_id, operation_type, input_data, output_data')
  .order('created_at', { ascending: false })
  .limit(1);

console.log('Latest trace:');
if (latestTrace && latestTrace.length > 0) {
  const trace = latestTrace[0];
  console.log(`  Created: ${trace.created_at}`);
  console.log(`  Span ID: ${trace.span_id}`);
  console.log(`  Operation: ${trace.operation_type}`);
  console.log(`  Has tools: ${trace.input_data?.toolDefinitions?.length > 0 ? 'YES (' + trace.input_data.toolDefinitions.length + ' tools)' : 'NO'}`);
  if (trace.output_data?.toolCallsMade) {
    console.log(`  Tool calls made: ${trace.output_data.toolCallsMade.length}`);
    trace.output_data.toolCallsMade.forEach(tc => {
      console.log(`    - ${tc.name}: ${tc.success ? 'SUCCESS' : 'FAILED'}`);
    });
  }
}

const { data: latestConv } = await supabase
  .from('conversations')
  .select('created_at, id')
  .order('created_at', { ascending: false })
  .limit(1);

console.log('\nLatest conversation:');
if (latestConv && latestConv.length > 0) {
  console.log(`  Created: ${latestConv[0].created_at}`);
  console.log(`  ID: ${latestConv[0].id}`);
}

const now = new Date();
const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

const { count: recentTraces } = await supabase
  .from('llm_traces')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', fiveMinutesAgo.toISOString());

console.log(`\nTraces in last 5 minutes: ${recentTraces || 0}`);

const { count: totalTraces } = await supabase
  .from('llm_traces')
  .select('*', { count: 'exact', head: true });

console.log(`Total traces: ${totalTraces}`);

if (recentTraces === 0) {
  console.log('\n❌ No activity in the last 5 minutes');
  console.log('   Either test was not run, or app needs restart to load new code');
}
