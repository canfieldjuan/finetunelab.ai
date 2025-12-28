import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CHECKING QUERY_KNOWLEDGE_GRAPH TOOL ===\n');

// 1. Check if tool exists and is enabled
const { data: tool, error: toolError } = await supabase
  .from('tools')
  .select('*')
  .eq('name', 'query_knowledge_graph')
  .single();

if (toolError) {
  console.log('❌ Tool not found:', toolError.message);
} else {
  console.log('Tool Status:');
  console.log(`  Name: ${tool.name}`);
  console.log(`  Enabled: ${tool.is_enabled ? '✓ YES' : '❌ NO'}`);
  console.log(`  Description: ${tool.description.substring(0, 80)}...`);
  console.log('');
}

// 2. Check recent conversations for context_injection setting
const { data: convs } = await supabase
  .from('conversations')
  .select('id, context_injection_enabled, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('Recent Conversations:');
if (convs && convs.length > 0) {
  convs.forEach((conv, i) => {
    const contextEnabled = conv.context_injection_enabled !== false; // Default true
    console.log(`  ${i + 1}. ${conv.id.substring(0, 12)}... - Context Injection: ${contextEnabled ? '✓ ON' : '❌ OFF'} - ${conv.created_at}`);
  });
} else {
  console.log('  No conversations found');
}
console.log('');

// 3. Check if any traces have toolDefinitions
const { data: tracesWithTools } = await supabase
  .from('llm_traces')
  .select('span_id, created_at, input_data')
  .not('input_data', 'is', null)
  .order('created_at', { ascending: false })
  .limit(20);

let toolDefCounts = { withTools: 0, withoutTools: 0, withGraphRAG: 0 };
tracesWithTools?.forEach(trace => {
  if (trace.input_data?.toolDefinitions) {
    const toolDefs = trace.input_data.toolDefinitions;
    if (Array.isArray(toolDefs) && toolDefs.length > 0) {
      toolDefCounts.withTools++;
      const hasGraphRAG = toolDefs.some(t => t.function?.name === 'query_knowledge_graph');
      if (hasGraphRAG) toolDefCounts.withGraphRAG++;
    } else {
      toolDefCounts.withoutTools++;
    }
  } else {
    toolDefCounts.withoutTools++;
  }
});

console.log('Tool Definitions in Recent Traces:');
console.log(`  Traces WITH tools: ${toolDefCounts.withTools}`);
console.log(`  Traces WITHOUT tools: ${toolDefCounts.withoutTools}`);
console.log(`  Traces with query_knowledge_graph: ${toolDefCounts.withGraphRAG}`);
console.log('');

// 4. Sample a trace to see what tools were sent
const sampleWithTools = tracesWithTools?.find(t =>
  t.input_data?.toolDefinitions?.length > 0
);

if (sampleWithTools) {
  console.log('Sample Trace Tool Definitions:');
  const tools = sampleWithTools.input_data.toolDefinitions;
  tools.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.function?.name || 'unknown'}`);
  });
} else {
  console.log('❌ No traces found with tool definitions!');
}

console.log('\n=== DIAGNOSIS ===');
if (!tool?.is_enabled) {
  console.log('❌ query_knowledge_graph tool is DISABLED');
}
if (toolDefCounts.withGraphRAG === 0) {
  console.log('❌ query_knowledge_graph is NOT being sent to LLM');
  console.log('   Even though tools are loaded, this specific tool is missing');
}
if (convs?.some(c => c.context_injection_enabled === false)) {
  console.log('⚠️  Some conversations have context injection DISABLED');
}
