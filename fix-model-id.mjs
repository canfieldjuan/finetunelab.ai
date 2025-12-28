import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const modelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

console.log('=== FIXING MODEL_ID ===\n');

const { data: before } = await supabase
  .from('llm_models')
  .select('model_id, name')
  .eq('id', modelId)
  .single();

console.log('Before:');
console.log('  Name:', before.name);
console.log('  Model ID:', before.model_id);

const { error } = await supabase
  .from('llm_models')
  .update({ model_id: 'Qwen/Qwen2.5-3B-Instruct' })
  .eq('id', modelId);

if (error) {
  console.log('\nError:', error.message);
  process.exit(1);
}

const { data: after } = await supabase
  .from('llm_models')
  .select('model_id, name')
  .eq('id', modelId)
  .single();

console.log('\nAfter:');
console.log('  Name:', after.name);
console.log('  Model ID:', after.model_id);

console.log('\n✅ Model fixed! Batch tests should work now.');
