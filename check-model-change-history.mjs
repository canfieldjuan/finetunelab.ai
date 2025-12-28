import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const qwenModelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';
const gptModelId = 'd700335c-50ed-4f6a-9257-2ec5075c4819';

console.log('=== MODEL CHANGE HISTORY ===\n');

// Check current state of Qwen model
const { data: qwenModel } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', qwenModelId)
  .single();

console.log('QWEN MODEL (3d086d4a...):');
console.log('  ID:', qwenModel.id);
console.log('  Name:', qwenModel.name);
console.log('  Provider:', qwenModel.provider);
console.log('  model_id:', qwenModel.model_id);
console.log('  updated_at:', qwenModel.updated_at);
console.log('  created_at:', qwenModel.created_at);
console.log('');

// Check GPT model
const { data: gptModel } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', gptModelId)
  .single();

console.log('GPT-5 MINI MODEL (d700335c...):');
console.log('  ID:', gptModel.id);
console.log('  Name:', gptModel.name);
console.log('  Provider:', gptModel.provider);
console.log('  model_id:', gptModel.model_id);
console.log('  updated_at:', gptModel.updated_at);
console.log('  created_at:', gptModel.created_at);
console.log('');

console.log('=== TIMELINE ===');
console.log('Qwen model updated_at:', qwenModel.updated_at);
console.log('fix-model-id.mjs run:', '2025-12-22 00:37 (file timestamp)');
console.log('Successful batch test (05:13):', '2025-12-22 05:13');
console.log('Broken batch test (06:01):', '2025-12-22 06:01');
console.log('');

// Parse timestamps
const qwenUpdated = new Date(qwenModel.updated_at);
const successfulTest = new Date('2025-12-22T05:13:21Z');
const brokenTest = new Date('2025-12-22T06:01:52Z');

console.log('=== ANALYSIS ===');
if (qwenUpdated < successfulTest) {
  console.log('✓ Qwen model was updated BEFORE the successful test at 05:13');
  console.log('  This means the model change did NOT break the 05:13 test');
} else {
  console.log('❌ Qwen model was updated AFTER the successful test at 05:13');
}

if (qwenUpdated > successfulTest && qwenUpdated < brokenTest) {
  console.log('⚠️  Qwen model was updated BETWEEN 05:13 and 06:01!');
  console.log('  This is the smoking gun! The model change broke the 06:01 test!');
} else {
  console.log('  Qwen model was NOT updated between the two tests');
}

console.log('\n=== HYPOTHESIS ===');
console.log('If the Qwen model was modified around 00:37,');
console.log('and this somehow affected the GPT model\'s traces,');
console.log('there might be a caching or default model issue.');
