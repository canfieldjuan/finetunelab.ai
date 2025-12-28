import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== ANALYZING ORIGINAL PROBLEM ===\n');

// The original problematic conversation
const problematicConv = '97d38df4-8078-481c-b475-9659dbfcc3c1';
const gptModelId = 'd700335c-50ed-4f6a-9257-2ec5075c4819';
const qwenModelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

// Get both models
const { data: gptModel } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', gptModelId)
  .single();

const { data: qwenModel } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', qwenModelId)
  .single();

console.log('GPT-5 MINI:');
console.log('  ID:', gptModel.id);
console.log('  Name:', gptModel.name);
console.log('  Provider:', gptModel.provider);
console.log('  model_id:', gptModel.model_id);
console.log('  served_model_name:', gptModel.served_model_name);
console.log('  enabled:', gptModel.enabled);
console.log('  is_global:', gptModel.is_global);
console.log('');

console.log('QWEN:');
console.log('  ID:', qwenModel.id);
console.log('  Name:', qwenModel.name);
console.log('  Provider:', qwenModel.provider);
console.log('  model_id:', qwenModel.model_id);
console.log('  served_model_name:', qwenModel.served_model_name);
console.log('  enabled:', qwenModel.enabled);
console.log('  is_global:', qwenModel.is_global);
console.log('');

// Key insight: Check if getModelConfig could have returned the wrong model
console.log('=== HYPOTHESIS ===');
console.log('');
console.log('When getModelConfig() is called with UUID:', gptModelId);
console.log('Could it somehow return the Qwen model instead?');
console.log('');
console.log('Let me check if there are any name collisions...');
console.log('');

// Check if there's any way the model names could collide
console.log('GPT model_id:', gptModel.model_id);
console.log('GPT name:', gptModel.name);
console.log('GPT served_model_name:', gptModel.served_model_name);
console.log('');
console.log('Qwen model_id:', qwenModel.model_id);
console.log('Qwen name:', qwenModel.name);
console.log('Qwen served_model_name:', qwenModel.served_model_name);
console.log('');

// Check for ANY models that might match the GPT UUID as an alias
const { data: aliasMatches } = await supabase
  .from('llm_models')
  .select('id, name, model_id, served_model_name')
  .or(`name.eq.${gptModelId},model_id.eq.${gptModelId},served_model_name.eq.${gptModelId}`);

console.log('Models that could match GPT UUID as alias:', aliasMatches?.length || 0);
if (aliasMatches && aliasMatches.length > 0) {
  console.log('⚠️  FOUND ALIAS COLLISION!');
  aliasMatches.forEach(m => {
    console.log('  -', m.name, '(id:', m.id, ')');
  });
}
