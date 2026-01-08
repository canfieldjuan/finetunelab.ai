#!/usr/bin/env node

/**
 * Check complete model details including API key status
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const modelId = '3105f421-bde2-4c96-9d61-85d79209f090';
  const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

  console.log('=== MODEL DETAILS ===\n');

  const { data: model, error } = await supabase
    .from('llm_models')
    .select('*')
    .eq('id', modelId)
    .single();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Model:', model.name);
  console.log('Provider:', model.provider);
  console.log('Model ID:', model.model_id);
  console.log('Base URL:', model.base_url);
  console.log('API Key Encrypted:', model.api_key_encrypted ? 'SET ✓' : 'NOT SET ✗');
  console.log('API Key Length:', model.api_key_encrypted?.length || 0);
  console.log('User ID:', model.user_id);
  console.log('');

  // Check for provider secrets
  console.log('=== PROVIDER SECRETS ===\n');

  const { data: secrets, error: secretError } = await supabase
    .from('secrets')
    .select('provider, api_key_encrypted, created_at')
    .eq('user_id', userId);

  if (secretError) {
    console.error('Error:', secretError);
  } else {
    console.log(`Total secrets: ${secrets.length}`);
    for (const secret of secrets) {
      console.log(`  - ${secret.provider}: API key length ${secret.api_key_encrypted?.length || 0}`);
    }
    console.log('');

    const openrouterSecret = secrets.find(s => s.provider === 'openrouter');
    if (openrouterSecret) {
      console.log('✓ OpenRouter secret found in vault');
    } else {
      console.log('✗ NO OpenRouter secret in vault');
    }
  }

  console.log('');
  console.log('=== DIAGNOSIS ===\n');

  if (model.api_key_encrypted) {
    console.log('Model has its own API key ✓');
    console.log('Will use model-specific key, NOT secrets vault');
  } else {
    console.log('Model has NO API key ✗');
    console.log('Will try to load from secrets vault for provider:', model.provider);

    const providerSecret = secrets?.find(s => s.provider === model.provider);
    if (providerSecret) {
      console.log('✓ Provider secret FOUND in vault');
    } else {
      console.log('✗ Provider secret NOT FOUND in vault');
      console.log('THIS WILL CAUSE 401 ERROR!');
    }
  }
}

main();
