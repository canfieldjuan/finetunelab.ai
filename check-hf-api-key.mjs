import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const qwenModelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';
const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

console.log('=== CHECKING HUGGINGFACE API KEY SETUP ===\n');

// Check if model has its own API key
const { data: model } = await supabase
  .from('llm_models')
  .select('name, api_key_encrypted, provider')
  .eq('id', qwenModelId)
  .single();

console.log('Model:', model.name);
console.log('Provider:', model.provider);
console.log('Has model-specific API key:', !!model.api_key_encrypted);
console.log('');

if (!model.api_key_encrypted) {
  console.log('Model does NOT have its own API key.');
  console.log('Checking for HuggingFace provider secret...');
  console.log('');

  // Check for provider secret
  const { data: secret } = await supabase
    .from('provider_api_keys')
    .select('provider, has_key_encrypted')
    .eq('user_id', userId)
    .eq('provider', 'huggingface')
    .single();

  if (secret && secret.has_key_encrypted) {
    console.log('✓ HuggingFace provider secret is configured');
  } else {
    console.log('❌ NO HUGGINGFACE PROVIDER SECRET FOUND!');
    console.log('');
    console.log('This is why batch testing is failing.');
    console.log('');
    console.log('TO FIX:');
    console.log('1. Go to Settings > Provider Secrets in the UI');
    console.log('2. Add your HuggingFace API key for the "huggingface" provider');
    console.log('OR');
    console.log('3. Edit the Qwen model and add an API key directly to the model');
  }
}
