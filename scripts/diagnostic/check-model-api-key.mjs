#!/usr/bin/env node

/**
 * Check if model has API key configured
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
  const modelId = 'cacfe907-baaa-468b-be77-e473b0861314';

  const { data: model, error } = await supabase
    .from('llm_models')
    .select('id, name, provider, base_url, api_key_encrypted, is_global, user_id')
    .eq('id', modelId)
    .single();

  if (error) {
    console.error('Error fetching model:', error);
    process.exit(1);
  }

  console.log('Model Configuration:\n');
  console.log(`Name: ${model.name}`);
  console.log(`Provider: ${model.provider}`);
  console.log(`Base URL: ${model.base_url}`);
  console.log(`API Key (encrypted): ${model.api_key_encrypted ? 'SET ✓' : 'NOT SET ✗'}`);
  console.log(`Is Global: ${model.is_global}`);
  console.log(`User ID: ${model.user_id || 'NULL'}`);
  console.log('');

  // Check for provider secrets
  if (!model.api_key_encrypted && model.user_id) {
    console.log('No model-specific API key. Checking for provider secrets...\n');

    const { data: secrets, error: secretsError } = await supabase
      .from('secrets')
      .select('provider, api_key_encrypted, created_at')
      .eq('user_id', model.user_id)
      .eq('provider', model.provider);

    if (secretsError) {
      console.error('Error fetching provider secrets:', secretsError);
    } else if (!secrets || secrets.length === 0) {
      console.log(`❌ No provider secret found for: ${model.provider}`);
      console.log('This model will fail with 401 authentication error!');
      console.log('');
      console.log(`To fix: Add ${model.provider} API key in Settings > API Keys`);
    } else {
      console.log(`✅ Provider secret found for: ${model.provider}`);
      console.log(`   Created: ${secrets[0].created_at}`);
      console.log('   API key will be loaded from provider secrets');
    }
  } else if (!model.api_key_encrypted && !model.user_id) {
    console.log('⚠️  WARNING: No API key and no user_id!');
    console.log('This model will fail when trying to make API calls.');
  } else {
    console.log('✅ Model has API key configured');
  }
}

main();
