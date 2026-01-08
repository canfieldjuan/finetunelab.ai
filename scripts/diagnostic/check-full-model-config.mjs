#!/usr/bin/env node

/**
 * Check complete model configuration including model_id field
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
    .select('*')
    .eq('id', modelId)
    .single();

  if (error) {
    console.error('Error fetching model:', error);
    process.exit(1);
  }

  console.log('=== COMPLETE MODEL CONFIGURATION ===\n');
  console.log('ID:', model.id);
  console.log('Name:', model.name);
  console.log('Provider:', model.provider);
  console.log('Base URL:', model.base_url);
  console.log('Model ID:', model.model_id);
  console.log('Served Model Name:', model.served_model_name);
  console.log('API Key (encrypted):', model.api_key_encrypted ? 'SET ✓' : 'NOT SET ✗');
  console.log('Is Global:', model.is_global);
  console.log('User ID:', model.user_id);
  console.log('Enabled:', model.enabled);
  console.log('');

  console.log('=== ISSUE DIAGNOSIS ===\n');

  if (model.provider === 'openai' && model.base_url === 'https://api.openai.com/v1') {
    console.log('❌ PROBLEM FOUND:');
    console.log('   Provider is set to OpenAI');
    console.log('   Base URL points to OpenAI API');
    console.log(`   But model_id is: ${model.model_id}`);
    console.log('');
    console.log('OpenAI does not have a model called "' + model.model_id + '"');
    console.log('This will result in 401 or 404 errors from OpenAI API');
    console.log('');
    console.log('SOLUTIONS:');
    console.log('1. Change model_id to a real OpenAI model (gpt-4o-mini, gpt-4o, etc.)');
    console.log('2. Change provider to openrouter and base_url to https://openrouter.ai/api/v1');
    console.log('3. Change provider to together and base_url to https://api.together.xyz/v1');
  }
}

main();
