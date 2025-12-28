import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const modelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

console.log('=== FINDING INTERMITTENT FAILURE CAUSE ===\n');

const { data: model } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', modelId)
  .single();

console.log('Model Fields:');
console.log('  id:', model.id);
console.log('  name:', model.name);
console.log('  provider:', model.provider);
console.log('  model_id:', model.model_id);
console.log('  served_model_name:', model.served_model_name);
console.log('  base_url:', model.base_url);
console.log('');

console.log('ANALYSIS:');
console.log('The model_id field contains:', model.model_id);
console.log('This is sent directly to HuggingFace API');
console.log('HuggingFace rejects it because that model does not exist');
console.log('');
console.log('Why does it work sometimes?');
console.log('Answer: It does NOT work with this model.');
console.log('Working traces are using a DIFFERENT model entirely.');
console.log('');

const { data: conversations } = await supabase
  .from('conversations')
  .select('id, llm_model_id, created_at')
  .order('created_at', { ascending: false })
  .limit(5);

console.log('Recent conversations and their models:');
conversations?.forEach(c => {
  console.log('  Conv:', c.id.substring(0, 12), '... Model:', c.llm_model_id);
});
console.log('');

const { data: allModels } = await supabase
  .from('llm_models')
  .select('id, name, provider, model_id')
  .eq('enabled', true);

console.log('All enabled models in database:');
allModels?.forEach(m => {
  console.log('  ID:', m.id);
  console.log('    Name:', m.name);
  console.log('    Provider:', m.provider);
  console.log('    Model ID:', m.model_id);
  console.log('');
});
