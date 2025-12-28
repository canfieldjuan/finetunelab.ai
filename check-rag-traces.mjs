import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CHECKING RAG/RETRIEVAL TRACES ===\n');

// Check for retrieval traces
const { data: retrievalTraces, error: retrievalError } = await supabase
  .from('llm_traces')
  .select('span_id, created_at, operation_type, span_name, output_data')
  .eq('operation_type', 'retrieval')
  .order('created_at', { ascending: false })
  .limit(10);

if (retrievalError) {
  console.error('Error fetching retrieval traces:', retrievalError);
  process.exit(1);
}

console.log(`Found ${retrievalTraces?.length || 0} retrieval traces\n`);

if (retrievalTraces && retrievalTraces.length > 0) {
  retrievalTraces.forEach((trace, i) => {
    console.log(`${i + 1}. ${trace.span_id}`);
    console.log(`   Created: ${trace.created_at}`);
    console.log(`   Name: ${trace.span_name}`);
    if (trace.output_data) {
      console.log(`   Output Data Keys:`, Object.keys(trace.output_data));
      if (trace.output_data.topChunks) {
        console.log(`   - topChunks: ${trace.output_data.topChunks.length} chunks`);
      }
      if (trace.output_data.avgConfidence !== undefined) {
        console.log(`   - avgConfidence: ${trace.output_data.avgConfidence}`);
      }
      if (trace.output_data.totalCandidates !== undefined) {
        console.log(`   - totalCandidates: ${trace.output_data.totalCandidates}`);
      }
    }
    console.log('');
  });
} else {
  console.log('❌ NO RETRIEVAL TRACES FOUND!\n');
  console.log('Checking all traces to see what operation types exist...\n');

  // Check all operation types
  const { data: allTraces } = await supabase
    .from('llm_traces')
    .select('operation_type')
    .order('created_at', { ascending: false })
    .limit(100);

  const opTypes = {};
  allTraces?.forEach(t => {
    opTypes[t.operation_type] = (opTypes[t.operation_type] || 0) + 1;
  });

  console.log('Operation types in last 100 traces:');
  Object.entries(opTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Check if GraphRAG is even being used
  console.log('\nChecking if query_knowledge_graph tool is being called...\n');

  const { data: recentTraces } = await supabase
    .from('llm_traces')
    .select('span_id, created_at, output_data')
    .eq('operation_type', 'llm_completion')
    .order('created_at', { ascending: false })
    .limit(20);

  let graphRAGCalls = 0;
  recentTraces?.forEach(trace => {
    if (trace.output_data?.toolCallsMade) {
      const graphRAGTool = trace.output_data.toolCallsMade.find(t => t.name === 'query_knowledge_graph');
      if (graphRAGTool) {
        graphRAGCalls++;
        console.log(`✓ Found query_knowledge_graph call in trace ${trace.span_id}`);
        console.log(`  Created: ${trace.created_at}`);
        console.log(`  Success: ${graphRAGTool.success}`);
      }
    }
  });

  if (graphRAGCalls === 0) {
    console.log('\n❌ No query_knowledge_graph tool calls found in recent traces!');
    console.log('This means GraphRAG is not being used in conversations.');
    console.log('\nPossible reasons:');
    console.log('1. Context Injection is disabled');
    console.log('2. No documents uploaded to knowledge base');
    console.log('3. Tool is not being offered to the LLM');
  } else {
    console.log(`\n✓ Found ${graphRAGCalls} query_knowledge_graph tool calls`);
    console.log('BUT no corresponding retrieval child traces!');
    console.log('\n⚠️  This means the retrieval traces are NOT being created.');
    console.log('Check: lib/graphrag/graphiti/search-service.ts line 72-112');
  }
}
