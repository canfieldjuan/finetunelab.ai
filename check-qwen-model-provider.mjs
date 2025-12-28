import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const qwenModelId = 'f473a286-f239-4705-b0db-a2b5ae2e97ad';
const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

console.log('=== CHECKING QWEN MODEL PROVIDER ===\n');

// Get the model
const { data: model } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', qwenModelId)
  .single();

console.log('Model ID:', model.id);
console.log('Model Name:', model.name);
console.log('Provider:', JSON.stringify(model.provider));
console.log('Has API key:', !!model.api_key_encrypted);
console.log('');

// Check provider_secrets table for this provider
console.log('=== CHECKING PROVIDER SECRETS ===\n');

const { data: secrets, error } = await supabase
  .from('provider_secrets')
  .select('*')
  .eq('user_id', userId);

if (error) {
  console.error('Error querying provider_secrets:', error);
} else {
  console.log(`Found ${secrets?.length || 0} provider secrets:\n`);

  secrets?.forEach(s => {
    console.log(`Provider: "${s.provider}"`);
    console.log(`  Has encrypted key: ${!!s.api_key_encrypted}`);
    console.log(`  Created: ${s.created_at}`);
    console.log('');
  });

  // Check for exact match
  const matchingSecret = secrets?.find(s => s.provider === model.provider);

  if (matchingSecret) {
    console.log('✅ FOUND MATCHING SECRET for provider:', model.provider);
  } else {
    console.log('❌ NO MATCHING SECRET for provider:', model.provider);
    console.log('');
    console.log('Available providers:', secrets?.map(s => `"${s.provider}"`).join(', '));
    console.log('Model needs provider:', `"${model.provider}"`);
    console.log('');
    console.log('MISMATCH: Model provider name does not match any secret provider name');
  }
}
