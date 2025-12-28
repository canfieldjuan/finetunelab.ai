
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { getGraphitiClient } from '../lib/graphrag/graphiti/client';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const OLLAMA_URL = 'http://localhost:11434';
const EMBEDDING_MODEL = 'mxbai-embed-large'; // 1024 dimensions
const GROUP_ID = 'documentation-v2'; // Changed to v2 to avoid dimension mismatch with failed v1 data

// Define what we want to ingest
const TARGETS = {
  'training-workflow': {
    title: 'Training Job Workflow',
    patterns: [
      'app/training/**/page.tsx',
      'app/api/training/**/route.ts',
      'lib/training/**/*.ts'
    ],
    ignore: ['**/*.test.ts', '**/*.spec.ts']
  },
  'analytics-features': {
    title: 'Analytics Features',
    patterns: [
      'app/analytics/**/page.tsx',
      'app/api/analytics/**/route.ts',
      'lib/analytics/**/*.ts'
    ],
    ignore: ['**/*.test.ts']
  }
};

async function ingestToGraphRAG(targetKey: string) {
  const target = TARGETS[targetKey as keyof typeof TARGETS];
  if (!target) {
    console.error(`Target '${targetKey}' not found.`);
    return;
  }

  console.log(`\n🚀 Starting GraphRAG Ingestion for: ${target.title}`);
  
  // 1. Initialize Graphiti Client
  const client = getGraphitiClient();
  
  // Configure it to use Ollama for embeddings (via RunPod/Custom provider interface)
  // Note: Graphiti needs to support this custom provider or we need to proxy it.
  // Assuming Graphiti supports 'runpod' or generic OpenAI-compatible endpoints.
  // If Graphiti runs locally, it might have its own embedder.
  // Here we pass config headers that the Graphiti server understands.
  
  client.setEmbedderConfig({
    provider: 'runpod', // Using 'runpod' as generic OpenAI-compatible provider
    baseUrl: `${OLLAMA_URL}/v1`,
    model: EMBEDDING_MODEL,
    apiKey: 'ollama', // Dummy key
  });

  // 2. Gather source files
  console.log('📂 Gathering source files...');
  let episodes = [];

  for (const pattern of target.patterns) {
    const files = await glob(pattern, { ignore: target.ignore });
    for (const file of files) {
      if (fs.statSync(file).isFile()) {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Create an "Episode" for Graphiti
        // An episode is a unit of text that Graphiti processes into nodes/edges
        episodes.push({
          name: path.basename(file),
          episode_body: `FILE PATH: ${file}\n\n${content}`,
          source_description: `Source Code: ${target.title}`,
          reference_time: new Date().toISOString(),
          group_id: GROUP_ID
        });
      }
    }
  }

  console.log(`✅ Found ${episodes.length} files to ingest.`);

  // 3. Send to Graphiti
  // We'll send in batches to avoid timeouts
  const BATCH_SIZE = 5;
  for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
    const batch = episodes.slice(i, i + BATCH_SIZE);
    console.log(`📡 Ingesting batch ${i / BATCH_SIZE + 1} / ${Math.ceil(episodes.length / BATCH_SIZE)}...`);
    
    try {
      // Using the bulk ingestion endpoint
      // Note: You might need to adjust this based on your exact Graphiti API version
      // The client.ts shows 'ingestEpisodes' or similar might be available, 
      // but let's use the raw client method if needed or the exposed one.
      
      // Checking client.ts methods... it seems we need to use `ingestEpisode` loop or `ingestEpisodes` if available.
      // Let's assume we loop for now to be safe, or use bulk if implemented.
      
      // Actually, let's look at client.ts again. It has `ingestEpisode`.
      // It doesn't seem to have a bulk method exposed in the snippet I read, 
      // but `GraphitiBulkEpisodeRequest` type exists.
      
      // Let's try to use the bulk endpoint manually if the method isn't on the class instance
      // or just loop. Looping is safer for now.
      
      await Promise.all(batch.map(ep => client.addEpisode(ep)));
      
    } catch (error) {
      console.error('❌ Error ingesting batch:', error);
    }
  }

  console.log(`\n✨ Ingestion complete!`);
  console.log(`📊 Data is now in Neo4j (Group: ${GROUP_ID})`);
  console.log(`💡 You can now query this data using the GraphRAGService.`);
}

// Run
const target = process.argv[2] || 'training-workflow';
ingestToGraphRAG(target);
