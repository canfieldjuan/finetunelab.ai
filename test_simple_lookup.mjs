import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSimpleLookup() {
  const modelIds = ['gpt-4o-mini', '99c7f7be-2504-4cc8-897b-cb691dc8286a'];

  console.log('🔍 Testing simple IN queries...\n');

  // Test 1: Just search by model_id
  console.log('Test 1: .in("model_id", array)');
  const { data: result1, error: error1 } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .in('model_id', modelIds);
  console.log(`Found ${result1?.length || 0} results:`);
  result1?.forEach(m => console.log(`  - ${m.name} (model_id: ${m.model_id})`));
  if (error1) console.log('Error:', error1.message);

  // Test 2: Just search by id
  console.log('\nTest 2: .in("id", array)');
  const { data: result2, error: error2 } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .in('id', modelIds);
  console.log(`Found ${result2?.length || 0} results:`);
  result2?.forEach(m => console.log(`  - ${m.name} (id: ${m.id.substring(0, 8)}...)`));
  if (error2) console.log('Error:', error2.message);

  // Test 3: Try OR with proper parentheses
  console.log('\nTest 3: .or() with proper syntax');
  const orConditions = modelIds.map(id => `model_id.eq.${id}`).join(',');
  console.log(`Query: .or("${orConditions}")`);
  const { data: result3, error: error3 } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .or(orConditions);
  console.log(`Found ${result3?.length || 0} results:`);
  result3?.forEach(m => console.log(`  - ${m.name} (model_id: ${m.model_id})`));
  if (error3) console.log('Error:', error3.message);
}

testSimpleLookup();
