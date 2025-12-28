import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== DOCUMENT PROCESSING STATUS ===\n');

const { data: docs, error } = await supabase
  .from('documents')
  .select('id, filename, processed, neo4j_episode_ids, created_at, user_id')
  .order('created_at', { ascending: false });

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log(`Total documents: ${docs.length}\n`);

let processed = 0;
let hasEpisodeIds = 0;

docs.forEach((doc, i) => {
  console.log(`${i + 1}. ${doc.filename}`);
  console.log(`   Created: ${doc.created_at}`);
  console.log(`   User ID: ${doc.user_id || 'none'}`);
  console.log(`   Processed: ${doc.processed === true ? '✓ YES' : doc.processed === false ? '❌ NO' : '⚠️  ' + doc.processed}`);
  console.log(`   Episode IDs: ${doc.neo4j_episode_ids ? `✓ ${doc.neo4j_episode_ids.length} episodes` : '❌ None'}`);

  if (doc.processed) processed++;
  if (doc.neo4j_episode_ids && doc.neo4j_episode_ids.length > 0) hasEpisodeIds++;

  console.log('');
});

console.log('=== SUMMARY ===');
console.log(`Processed: ${processed}/${docs.length}`);
console.log(`Has Episode IDs: ${hasEpisodeIds}/${docs.length}`);

if (hasEpisodeIds === 0) {
  console.log('\n❌ PROBLEM: No documents have been ingested into Graphiti!');
  console.log('');
  console.log('This means:');
  console.log('1. Documents were uploaded to the documents table');
  console.log('2. But they were NOT sent to the Graphiti service');
  console.log('3. So there\'s no knowledge graph to retrieve from');
  console.log('');
  console.log('Possible causes:');
  console.log('- Graphiti service not configured (missing GRAPHITI_BASE_URL)');
  console.log('- Document processing pipeline broken');
  console.log('- Documents uploaded before Graphiti integration added');
  console.log('');
  console.log('Solution: Re-upload a document or run document processing job');
}

// Check environment configuration
console.log('\n=== GRAPHITI CONFIGURATION ===');
console.log(`GRAPHITI_BASE_URL: ${process.env.GRAPHITI_BASE_URL || '❌ NOT SET'}`);
console.log(`NEO4J_URI: ${process.env.NEO4J_URI || '❌ NOT SET'}`);
console.log(`NEO4J_USER: ${process.env.NEO4J_USER || '❌ NOT SET'}`);
console.log(`NEO4J_PASSWORD: ${process.env.NEO4J_PASSWORD ? '✓ SET' : '❌ NOT SET'}`);
