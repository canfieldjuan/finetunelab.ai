import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testLookup() {
  console.log('🔍 Testing lookup for gpt-4o-mini...\n');

  // Test 1: Direct lookup by model_id
  console.log('Test 1: Direct lookup by model_id');
  const { data: direct } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .eq('model_id', 'gpt-4o-mini');

  console.log(`Found ${direct?.length || 0} results:`);
  direct?.forEach(m => console.log(`  - ${m.name} (${m.model_id})`));

  // Test 2: OR query (how it's done in useMessages)
  console.log('\nTest 2: OR query');
  const { data: orQuery } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .or(`id.eq.gpt-4o-mini,model_id.eq.gpt-4o-mini`);

  console.log(`Found ${orQuery?.length || 0} results:`);
  orQuery?.forEach(m => console.log(`  - ${m.name} (${m.model_id})`));

  // Test 3: Get the actual UUID for gpt-4o-mini
  console.log('\nTest 3: Full record for gpt-4o-mini');
  const { data: full } = await supabase
    .from('llm_models')
    .select('*')
    .eq('model_id', 'gpt-4o-mini')
    .single();

  if (full) {
    console.log(`ID: ${full.id}`);
    console.log(`Name: ${full.name}`);
    console.log(`Model ID: ${full.model_id}`);
    console.log(`Provider: ${full.provider}`);
  }
}

testLookup();
