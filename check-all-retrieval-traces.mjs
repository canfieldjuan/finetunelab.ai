import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== SEARCHING ALL TRACES FOR RETRIEVAL OPERATIONS ===\n');

// Check total count by operation type
const { data: allTraces } = await supabase
  .from('llm_traces')
  .select('operation_type, created_at')
  .order('created_at', { ascending: false })
  .limit(1000);

const opTypeCounts = {};
allTraces?.forEach(t => {
  opTypeCounts[t.operation_type] = (opTypeCounts[t.operation_type] || 0) + 1;
});

console.log('Operation Type Distribution (last 1000 traces):');
Object.entries(opTypeCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

console.log('\n');

// Get total count from database
const { count: totalCount } = await supabase
  .from('llm_traces')
  .select('*', { count: 'exact', head: true });

console.log(`Total traces in database: ${totalCount}`);

// Check specifically for retrieval
const { count: retrievalCount } = await supabase
  .from('llm_traces')
  .select('*', { count: 'exact', head: true })
  .eq('operation_type', 'retrieval');

console.log(`Total retrieval traces: ${retrievalCount || 0}`);

// Check for ANY child spans
const { count: childSpansCount } = await supabase
  .from('llm_traces')
  .select('*', { count: 'exact', head: true })
  .not('parent_trace_id', 'is', null);

console.log(`Total child spans (any operation): ${childSpansCount || 0}\n`);

if (retrievalCount === 0) {
  console.log('❌ CONFIRMED: Zero retrieval traces in entire database');
  console.log('   This means GraphRAG has never been used (or retrieval traces not created)');
}

if (childSpansCount === 0) {
  console.log('❌ CONFIRMED: Zero child spans in entire database');
  console.log('   createChildSpan() has never been successfully called');
}
