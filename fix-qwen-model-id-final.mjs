import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const modelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

console.log('=== FIXING QWEN MODEL ID ===\n');

// Get current state
const { data: currentModel } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', modelId)
  .single();

console.log('CURRENT STATE:');
console.log('  Name:', currentModel.name);
console.log('  model_id:', currentModel.model_id);
console.log('');

console.log('ISSUE:');
console.log('  The model_id contains extra text: "Qwen/Qwen2.5-3B-Instruct - Agentic Tetst"');
console.log('  It should ONLY be: "Qwen/Qwen2.5-3B-Instruct"');
console.log('  The extra text should be in the "name" field instead');
console.log('');

// Fix it
const { error } = await supabase
  .from('llm_models')
  .update({
    model_id: 'Qwen/Qwen2.5-3B-Instruct'
  })
  .eq('id', modelId);

if (error) {
  console.error('ERROR:', error);
} else {
  console.log('✓ FIXED! Updated model_id to: "Qwen/Qwen2.5-3B-Instruct"');
  console.log('');
  console.log('The model name stays as:', currentModel.name);
  console.log('(which can keep the extra descriptive text)');
}

// Verify
const { data: updatedModel } = await supabase
  .from('llm_models')
  .select('name, model_id')
  .eq('id', modelId)
  .single();

console.log('');
console.log('VERIFICATION:');
console.log('  Name:', updatedModel.name);
console.log('  model_id:', updatedModel.model_id);
console.log('');
console.log('✓ Batch tests with this model should now work!');
