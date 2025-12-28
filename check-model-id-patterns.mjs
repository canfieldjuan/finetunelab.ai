import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== CHECKING model_id PATTERNS ===\n');

// Get all models to see the pattern
const { data: models } = await supabase
  .from('llm_models')
  .select('id, name, provider, model_id, served_model_name')
  .limit(20);

console.log('MODEL NAME vs MODEL_ID PATTERNS:\n');

const grouped = {};
models?.forEach(m => {
  if (!grouped[m.provider]) {
    grouped[m.provider] = [];
  }
  grouped[m.provider].push(m);
});

Object.entries(grouped).forEach(([provider, mods]) => {
  console.log(`\n=== ${provider.toUpperCase()} MODELS ===`);
  mods.forEach(m => {
    console.log(`\nName: ${m.name}`);
    console.log(`model_id: ${m.model_id}`);
    console.log(`served_model_name: ${m.served_model_name}`);
  });
});

console.log('\n\n=== ANALYSIS ===');
console.log('');
console.log('For HuggingFace models, the model_id should be the HuggingFace repository ID');
console.log('(e.g., "Qwen/Qwen2.5-3B-Instruct")');
console.log('');
console.log('For OpenAI models, the model_id is the API model name');
console.log('(e.g., "gpt-4o-mini", "gpt-5-mini-2025-08-07")');
console.log('');
console.log('The "name" field is a friendly display name chosen by the user');
console.log('(e.g., "GPT-5 Mini", "Qwen Agentic Model")');
