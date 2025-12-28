import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== GRAPHRAG SETUP DIAGNOSTIC ===\n');

// 1. Check if query_knowledge_graph tool is enabled
console.log('1. Checking if query_knowledge_graph tool is enabled...');
const { data: tool, error: toolError } = await supabase
  .from('tools')
  .select('*')
  .eq('name', 'query_knowledge_graph')
  .single();

if (toolError) {
  console.log('   ❌ Error fetching tool:', toolError.message);
} else if (!tool) {
  console.log('   ❌ query_knowledge_graph tool does not exist in database!');
} else {
  console.log(`   ${tool.is_enabled ? '✓' : '❌'} Tool enabled: ${tool.is_enabled}`);
  console.log(`   Tool description: ${tool.description.substring(0, 100)}...`);
}

// 2. Check if there are documents in the knowledge base
console.log('\n2. Checking for documents in knowledge base...');
const { data: docs, error: docsError } = await supabase
  .from('documents')
  .select('id, name, created_at')
  .limit(10);

if (docsError) {
  console.log('   ❌ Error fetching documents:', docsError.message);
} else if (!docs || docs.length === 0) {
  console.log('   ❌ NO DOCUMENTS FOUND in knowledge base!');
  console.log('   This is why GraphRAG is not being used.');
  console.log('\n   Solution: Upload documents via the Knowledge Base modal in the chat interface.');
} else {
  console.log(`   ✓ Found ${docs.length} documents`);
  docs.forEach((doc, i) => {
    console.log(`     ${i + 1}. ${doc.name} (${doc.created_at})`);
  });
}

// 3. Check for GraphRAG entities/nodes
console.log('\n3. Checking for GraphRAG entities...');
const { data: entities, error: entitiesError } = await supabase
  .from('entities')
  .select('id')
  .limit(1);

if (entitiesError) {
  console.log('   ⚠️  Error checking entities (table might not exist):', entitiesError.message);
} else if (!entities || entities.length === 0) {
  console.log('   ❌ No entities found in knowledge graph');
} else {
  const { count } = await supabase
    .from('entities')
    .select('*', { count: 'exact', head: true });
  console.log(`   ✓ Found ${count} entities in knowledge graph`);
}

// 4. Check recent conversations for context injection setting
console.log('\n4. Checking context injection settings...');
const { data: conversations } = await supabase
  .from('conversations')
  .select('id, context_injection_enabled, created_at')
  .order('created_at', { ascending: false })
  .limit(5);

if (conversations && conversations.length > 0) {
  console.log('   Recent conversations:');
  conversations.forEach((conv, i) => {
    const contextEnabled = conv.context_injection_enabled !== false; // Default true
    console.log(`     ${i + 1}. ${conv.id.substring(0, 8)}... - Context: ${contextEnabled ? '✓ ON' : '❌ OFF'}`);
  });
} else {
  console.log('   No conversations found');
}

console.log('\n=== DIAGNOSIS ===');
const hasDocuments = docs && docs.length > 0;
const toolEnabled = tool?.is_enabled === true;
const hasEntities = entities && entities.length > 0;

if (!toolEnabled) {
  console.log('❌ ISSUE: query_knowledge_graph tool is DISABLED');
  console.log('   Fix: Enable it in the tools table');
}

if (!hasDocuments) {
  console.log('❌ ISSUE: No documents in knowledge base');
  console.log('   Fix: Upload documents via Chat > Knowledge Base button (Plus icon)');
  console.log('   Then GraphRAG will automatically be used when context injection is enabled');
}

if (toolEnabled && hasDocuments && !hasEntities) {
  console.log('⚠️  WARNING: Documents exist but no entities extracted yet');
  console.log('   This means documents were uploaded but not processed into the graph');
}

if (toolEnabled && hasDocuments && hasEntities) {
  console.log('✓ Setup looks correct!');
  console.log('  If GraphRAG still not being used, check:');
  console.log('  1. Context Injection is enabled in conversation (default: ON)');
  console.log('  2. Tools are loading before messages sent (the fix we just made)');
  console.log('  3. Check browser console for tool loading errors');
}
