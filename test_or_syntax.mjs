import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testORSyntax() {
  const modelIds = ['gpt-4o-mini', '99c7f7be-2504-4cc8-897b-cb691dc8286a'];

  console.log('🔍 Testing different OR query syntaxes...\n');
  console.log('Model IDs:', modelIds);

  // Current syntax (WRONG)
  console.log('\n❌ Current syntax:');
  const query1 = modelIds.map(id => `id.eq.${id},model_id.eq.${id}`).join(',');
  console.log(`Query: .or("${query1}")`);
  const { data: result1 } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .or(query1);
  console.log(`Found ${result1?.length || 0} results`);

  // Try alternative: Filter by id OR filter by model_id
  console.log('\n✅ Alternative 1: Separate filters');
  const { data: result2 } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .or(`id.in.(${modelIds.join(',')}),model_id.in.(${modelIds.join(',')})`);
  console.log(`Query: .or("id.in.(${modelIds.join(',')}),model_id.in.(${modelIds.join(',')})")`);
  console.log(`Found ${result2?.length || 0} results:`);
  result2?.forEach(m => console.log(`  - ${m.name} (id: ${m.id.substring(0, 8)}..., model_id: ${m.model_id})`));

  // Try with quoted strings
  console.log('\n✅ Alternative 2: Quoted strings');
  const quotedIds = modelIds.map(id => `"${id}"`).join(',');
  const { data: result3 } = await supabase
    .from('llm_models')
    .select('id, name, model_id, provider')
    .or(`id.in.(${quotedIds}),model_id.in.(${quotedIds})`);
  console.log(`Query: .or("id.in.(${quotedIds}),model_id.in.(${quotedIds})")`);
  console.log(`Found ${result3?.length || 0} results:`);
  result3?.forEach(m => console.log(`  - ${m.name} (id: ${m.id.substring(0, 8)}..., model_id: ${m.model_id})`));
}

testORSyntax();
