#!/usr/bin/env node

/**
 * List all models for the user
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
  const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

  const { data: models, error } = await supabase
    .from('llm_models')
    .select('id, name, provider, model_id, base_url, api_key_encrypted, enabled')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Found ${models.length} models for user\n`);

  for (const model of models) {
    console.log(`Model: ${model.name}`);
    console.log(`  ID: ${model.id}`);
    console.log(`  Provider: ${model.provider}`);
    console.log(`  Model ID: ${model.model_id}`);
    console.log(`  Base URL: ${model.base_url}`);
    console.log(`  API Key: ${model.api_key_encrypted ? 'SET ✓' : 'NOT SET ✗'}`);
    console.log('');
  }
}

main();
