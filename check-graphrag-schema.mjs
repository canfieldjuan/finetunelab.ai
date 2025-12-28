import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CHECKING GRAPHRAG SCHEMA & DATA ===\n');

// Check what tables exist for GraphRAG
const tables = [
  'documents',
  'document_chunks',
  'entities',
  'entity_relationships',
  'graphiti_nodes',
  'graphiti_edges',
  'rag_documents'
];

for (const table of tables) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .limit(1);

  if (error) {
    console.log(`❌ ${table}: ${error.message}`);
  } else {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    console.log(`✓ ${table}: ${count || 0} rows`);
    if (data && data.length > 0) {
      console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
    }
  }
}

// Check if there are any retrieval child spans
console.log('\n=== CHECKING FOR RETRIEVAL CHILD SPANS ===');
const { data: allTraces, error: tracesError } = await supabase
  .from('llm_traces')
  .select('operation_type, COUNT(*)')
  .limit(1000);

if (!tracesError) {
  const opCounts = {};
  allTraces?.forEach(t => {
    opCounts[t.operation_type] = (opCounts[t.operation_type] || 0) + 1;
  });

  console.log('\nOperation type distribution:');
  Object.entries(opCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
}

// Check conversations table
console.log('\n=== CHECKING CONVERSATIONS ===');
const { data: convs, error: convsError } = await supabase
  .from('conversations')
  .select('id, user_id, created_at')
  .order('created_at', { ascending: false })
  .limit(5);

if (convsError) {
  console.log(`❌ Error: ${convsError.message}`);
} else {
  console.log(`Found ${convs?.length || 0} conversations`);
  if (convs && convs.length > 0) {
    console.log(`Most recent: ${convs[0].created_at}`);
  }
}
