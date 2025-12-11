import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addGPT4oMiniModel() {
  console.log('🔧 Adding gpt-4o-mini model entry to llm_models table...\n');

  // Check if it already exists
  const { data: existing } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .eq('model_id', 'gpt-4o-mini')
    .single();

  if (existing) {
    console.log('✅ Model already exists:');
    console.log(JSON.stringify(existing, null, 2));
    return;
  }

  // Insert new model entry
  const { data, error } = await supabase
    .from('llm_models')
    .insert({
      name: 'GPT-4o Mini',
      model_id: 'gpt-4o-mini',
      provider: 'openai',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to insert model:', error.message);
    return;
  }

  console.log('✅ Successfully added model entry:');
  console.log(JSON.stringify(data, null, 2));

  // Verify it can be found by the OR query
  console.log('\n🔍 Testing OR query lookup...');
  const { data: lookupTest } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .or(`id.eq.gpt-4o-mini,model_id.eq.gpt-4o-mini`);

  console.log(`Found ${lookupTest?.length || 0} results:`);
  lookupTest?.forEach(m => {
    console.log(`  - ${m.name} (${m.model_id})`);
  });

  console.log('\n🎉 Fix complete! Recent messages should now show model name.');
}

addGPT4oMiniModel();
