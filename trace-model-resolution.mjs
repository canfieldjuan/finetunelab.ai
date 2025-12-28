import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== MODEL RESOLUTION INVESTIGATION ===\n');

// Check what model_name is ACTUALLY stored in traces
const { data: allTraces } = await supabase
  .from('llm_traces')
  .select('span_id, model_name, model_provider, status, created_at, conversation_id')
  .eq('model_name', '3d086d4a-f0d3-41dd-88e7-cd24bffaa760')
  .order('created_at', { ascending: true });

console.log('Total traces:', allTraces?.length || 0);
console.log('');

// Group by provider
const byProvider = {};
allTraces?.forEach(t => {
  const provider = t.model_provider || 'null';
  if (!byProvider[provider]) {
    byProvider[provider] = { successful: [], failed: [] };
  }
  if (t.status === 'completed') {
    byProvider[provider].successful.push(t);
  } else if (t.status === 'failed') {
    byProvider[provider].failed.push(t);
  }
});

console.log('BREAKDOWN BY PROVIDER:');
Object.entries(byProvider).forEach(([provider, counts]) => {
  console.log(`\n${provider}:`);
  console.log(`  Successful: ${counts.successful.length}`);
  console.log(`  Failed: ${counts.failed.length}`);

  if (counts.successful.length > 0) {
    console.log(`  First success: ${counts.successful[0].created_at}`);
    console.log(`  Conv ID: ${counts.successful[0].conversation_id}`);
  }

  if (counts.failed.length > 0) {
    console.log(`  First fail: ${counts.failed[0].created_at}`);
    console.log(`  Conv ID: ${counts.failed[0].conversation_id}`);
  }
});

// Check if there are OTHER models that might be getting confused
console.log('\n\n=== CHECKING FOR MODEL ID CONFUSION ===');
const { data: conversations } = await supabase
  .from('conversations')
  .select('id, llm_model_id')
  .in('id', [...new Set(allTraces?.map(t => t.conversation_id))]);

console.log('\nConversations using this model:');
const modelUsage = {};
conversations?.forEach(c => {
  const modelId = c.llm_model_id;
  if (!modelUsage[modelId]) {
    modelUsage[modelId] = [];
  }
  modelUsage[modelId].push(c.id);
});

Object.entries(modelUsage).forEach(([modelId, convIds]) => {
  console.log(`\nModel: ${modelId}`);
  console.log(`  Conversations: ${convIds.length}`);
});

// If there are multiple models, check what they are
if (Object.keys(modelUsage).length > 1) {
  console.log('\n\n=== MULTIPLE MODELS DETECTED ===');
  const modelIds = Object.keys(modelUsage);
  const { data: models } = await supabase
    .from('llm_models')
    .select('id, name, provider, model_id')
    .in('id', modelIds);

  models?.forEach(m => {
    console.log(`\nModel ID: ${m.id}`);
    console.log(`  Name: ${m.name}`);
    console.log(`  Provider: ${m.provider}`);
    console.log(`  Model ID field: ${m.model_id}`);
  });
}
