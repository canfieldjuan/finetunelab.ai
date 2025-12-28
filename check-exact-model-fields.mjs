import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const qwenModelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

console.log('=== EXACT MODEL FIELD VALUES ===\n');

const { data: model } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', qwenModelId)
  .single();

console.log('Database UUID:', model.id);
console.log('');
console.log('MODEL NAME (friendly display):', JSON.stringify(model.name));
console.log('MODEL_ID (HF repo ID):', JSON.stringify(model.model_id));
console.log('');
console.log('=== CORRECT FORMAT ===');
console.log('Model Name CAN have extra text:  "Qwen/Qwen2.5-3B-Instruct - Agentic Model" ✓');
console.log('Model ID should be ONLY:         "Qwen/Qwen2.5-3B-Instruct" ✓');
console.log('');
console.log('=== YOUR CURRENT VALUES ===');
console.log(`Model Name:  ${JSON.stringify(model.name)}`);
console.log(`Model ID:    ${JSON.stringify(model.model_id)}`);
console.log('');

// Check if model_id has any extra text
if (model.model_id.includes(' - ') || model.model_id.includes('\t')) {
  console.log('❌ PROBLEM: model_id contains extra text or tabs!');
  console.log('   It should ONLY be the HuggingFace repo ID.');
  console.log('   Example: "Qwen/Qwen2.5-3B-Instruct"');
} else {
  console.log('✓ model_id looks clean (no extra text)');
}
