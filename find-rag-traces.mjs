import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== SEARCHING FOR RAG TRACES ===\n');

// Search for traces with parent_trace_id (child spans)
const { data: childSpans, error } = await supabase
  .from('llm_traces')
  .select('span_id, parent_trace_id, operation_type, span_name, created_at, output_data')
  .not('parent_trace_id', 'is', null)
  .order('created_at', { ascending: false })
  .limit(20);

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log(`Found ${childSpans.length} child spans (traces with parent_trace_id)\n`);

const retrievalSpans = childSpans.filter(s => s.operation_type === 'retrieval');
const graphragSpans = childSpans.filter(s => s.span_name && s.span_name.includes('graphrag'));

console.log(`Retrieval spans: ${retrievalSpans.length}`);
console.log(`GraphRAG spans: ${graphragSpans.length}\n`);

if (retrievalSpans.length > 0) {
  console.log('=== RETRIEVAL TRACES ===');
  retrievalSpans.forEach((span, i) => {
    console.log(`\n${i + 1}. ${span.span_id}`);
    console.log(`   Created: ${span.created_at}`);
    console.log(`   Name: ${span.span_name}`);
    console.log(`   Parent: ${span.parent_trace_id}`);
    if (span.output_data) {
      console.log(`   Output Data:`, JSON.stringify(span.output_data, null, 2));
    }
  });
}

if (graphragSpans.length > 0 && graphragSpans.length !== retrievalSpans.length) {
  console.log('\n\n=== OTHER GRAPHRAG SPANS ===');
  graphragSpans.forEach((span, i) => {
    if (!retrievalSpans.find(r => r.span_id === span.span_id)) {
      console.log(`\n${i + 1}. ${span.span_id}`);
      console.log(`   Operation: ${span.operation_type}`);
      console.log(`   Name: ${span.span_name}`);
    }
  });
}

if (childSpans.length === 0) {
  console.log('❌ No child spans found at all!');
  console.log('This suggests createChildSpan() is not being called.');
}
