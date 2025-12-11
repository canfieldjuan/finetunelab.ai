import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEndToEnd() {
  console.log('🔍 Testing end-to-end model name lookup...\n');

  // Step 1: Get recent messages
  const { data: messages } = await supabase
    .from('messages')
    .select('id, model_id, provider, input_tokens, output_tokens')
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log(`Found ${messages?.length || 0} recent messages\n`);

  if (!messages || messages.length === 0) {
    console.log('No messages found');
    return;
  }

  // Step 2: Extract model_ids
  const modelIds = [...new Set(
    messages.map(msg => msg.model_id).filter(id => id != null)
  )];

  console.log('Unique model_ids:', modelIds);

  // Step 3: Fetch model names using .in()
  const { data: models, error } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .in('model_id', modelIds);

  if (error) {
    console.log('\n❌ Error fetching models:', error.message);
    return;
  }

  console.log(`\nFound ${models?.length || 0} matching models:`);
  models?.forEach(m => {
    console.log(`  - ${m.name} (model_id: ${m.model_id}, provider: ${m.provider})`);
  });

  // Step 4: Build modelMap like useMessages does
  const modelMap = new Map();
  models?.forEach(m => {
    const modelInfo = { name: m.name || m.model_id, provider: m.provider };
    modelMap.set(m.id, modelInfo);
    modelMap.set(m.model_id, modelInfo);
  });

  console.log(`\nModelMap size: ${modelMap.size}`);
  console.log('ModelMap keys:', Array.from(modelMap.keys()));

  // Step 5: Enrich messages like useMessages does
  console.log('\n📝 Enriched messages:');
  messages.forEach(msg => {
    const modelInfo = msg.model_id ? modelMap.get(msg.model_id) : null;
    const model_name = modelInfo?.name || msg.model_id || 'unknown';
    console.log(`\nMessage ${msg.id.substring(0, 8)}...`);
    console.log(`  model_id: ${msg.model_id}`);
    console.log(`  model_name: ${model_name}`);
    console.log(`  provider: ${msg.provider}`);
    console.log(`  tokens: ${msg.input_tokens} → ${msg.output_tokens}`);
  });
}

testEndToEnd();
