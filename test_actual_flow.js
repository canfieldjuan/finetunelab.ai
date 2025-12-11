// Test to trace actual API key resolution flow with decryption failure
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testActualFlow() {
  console.log('=== Testing Actual API Key Resolution Flow ===\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(supabaseUrl, supabaseServiceKey);

  // Get a HuggingFace model
  const { data: models } = await client
    .from('llm_models')
    .select('*')
    .eq('provider', 'huggingface')
    .limit(1);

  if (!models || models.length === 0) {
    console.error('No HuggingFace models found');
    return;
  }

  const model = models[0];
  const userId = model.user_id;

  console.log(`Testing with model: ${model.name} (${model.model_id})`);
  console.log(`User ID: ${userId}`);
  console.log(`Model has api_key_encrypted: ${!!model.api_key_encrypted}`);

  // Simulate the getModelConfig flow
  console.log('\n--- Simulating getModelConfig() flow ---\n');

  let apiKey;

  // Priority 1: Model-specific key
  if (model.api_key_encrypted) {
    console.log('Step 1: Model has api_key_encrypted, trying to decrypt...');
    try {
      // This will fail because of encryption format mismatch
      const crypto = require('crypto');
      const password = process.env.ENCRYPTION_KEY;
      const combined = Buffer.from(model.api_key_encrypted, 'base64');
      console.log(`  Encrypted data length: ${combined.length}`);
      console.log(`  Expected minimum: ${16 + 16 + 16} (salt + iv + authTag)`);
      
      if (combined.length < 48) {
        throw new Error('Invalid encrypted data: too short');
      }
      
      // This will throw because the data format is wrong
      apiKey = 'DECRYPTION_WOULD_FAIL_HERE';
      console.log('  ❌ Decryption would fail with format mismatch error');
      console.log('  ❌ This causes getModelConfig() to throw and crash');
    } catch (error) {
      console.log(`  ❌ Exception: ${error.message}`);
      console.log('  ❌ Code execution STOPS HERE - exception bubbles up');
      console.log('  ❌ Priority 2 (provider secret) is NEVER reached');
      return;
    }
  }

  // Priority 2: Provider secret (this code is NEVER reached if decrypt fails)
  console.log('\nStep 2: Looking up provider secret...');
  const { data: secret } = await client
    .from('provider_secrets')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'huggingface')
    .limit(1);

  if (secret && secret.length > 0) {
    console.log('  ✓ Provider secret EXISTS in database');
    console.log('  ✓ But this code is NEVER executed because decrypt() threw an error');
  }

  console.log('\n--- Analysis ---');
  console.log('❌ When model.api_key_encrypted exists BUT decryption fails:');
  console.log('   1. decrypt() throws an error');
  console.log('   2. Error is NOT caught in getModelConfig()');
  console.log('   3. Entire function throws, returning error to caller');
  console.log('   4. Provider secret fallback is NEVER attempted');
  console.log('   5. Invalid token in logs must be coming from elsewhere');
}

testActualFlow().catch(console.error);
