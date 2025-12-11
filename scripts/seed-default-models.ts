// Seed Default LLM Models
// Populates llm_models table with OpenAI and Anthropic models from .env
// Date: 2025-10-14
// Run: npx tsx scripts/seed-default-models.ts

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { encrypt } from '../lib/models/encryption';

const envPath = existsSync(join(__dirname, '../.env.local'))
  ? join(__dirname, '../.env.local')
  : join(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
    // Set in process.env so encryption module can access it
    process.env[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[SeedModels] Missing Supabase credentials');
  process.exit(1);
}

if (!envVars.ENCRYPTION_KEY) {
  console.error('[SeedModels] ENCRYPTION_KEY not found in .env');
  console.error('[SeedModels] Generate one with: openssl rand -base64 32');
  process.exit(1);
}

console.log('[SeedModels] Environment variables loaded');
console.log('[SeedModels] ENCRYPTION_KEY:', envVars.ENCRYPTION_KEY.substring(0, 10) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedModels() {
  console.log('[SeedModels] Starting model seeding...\n');

  const models = [];

  if (envVars.OPENAI_API_KEY && envVars.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    console.log('[SeedModels] Found OpenAI API key, creating models...');

    models.push({
      name: 'GPT-4o Mini',
      description: 'Fast and cost-effective model for most tasks',
      provider: 'openai',
      base_url: 'https://api.openai.com/v1',
      model_id: 'gpt-4o-mini',
      auth_type: 'bearer',
      api_key_encrypted: encrypt(envVars.OPENAI_API_KEY),
      supports_streaming: true,
      supports_functions: true,
      supports_vision: true,
      context_length: 128000,
      max_output_tokens: 16384,
      price_per_input_token: 0.00000015,
      price_per_output_token: 0.0000006,
      default_temperature: 0.7,
      default_top_p: 1.0,
      enabled: true,
      is_global: true,
    });

    models.push({
      name: 'GPT-4 Turbo',
      description: 'Most capable model for complex reasoning',
      provider: 'openai',
      base_url: 'https://api.openai.com/v1',
      model_id: 'gpt-4-turbo-preview',
      auth_type: 'bearer',
      api_key_encrypted: encrypt(envVars.OPENAI_API_KEY),
      supports_streaming: true,
      supports_functions: true,
      supports_vision: true,
      context_length: 128000,
      max_output_tokens: 4096,
      price_per_input_token: 0.00001,
      price_per_output_token: 0.00003,
      default_temperature: 0.7,
      default_top_p: 1.0,
      enabled: true,
      is_global: true,
    });
  }

  if (envVars.ANTHROPIC_API_KEY && envVars.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
    console.log('[SeedModels] Found Anthropic API key, creating models...');

    models.push({
      name: 'anthropic/claude-opus-4.5',
      description: 'Most capable Claude model for complex tasks',
      provider: 'anthropic',
      base_url: 'https://api.anthropic.com/v1',
      model_id: 'claude-opus-4-5-20251101',
      auth_type: 'api_key',
      api_key_encrypted: encrypt(envVars.ANTHROPIC_API_KEY),
      supports_streaming: true,
      supports_functions: true,
      supports_vision: true,
      context_length: 200000,
      max_output_tokens: 8192,
      price_per_input_token: 0.000015,
      price_per_output_token: 0.000075,
      default_temperature: 0.7,
      default_top_p: 1.0,
      enabled: true,
      is_global: true,
    });

    models.push({
      name: 'anthropic/claude-sonnet-4.5',
      description: 'Balanced performance and intelligence',
      provider: 'anthropic',
      base_url: 'https://api.anthropic.com/v1',
      model_id: 'claude-sonnet-4-5-20250929',
      auth_type: 'api_key',
      api_key_encrypted: encrypt(envVars.ANTHROPIC_API_KEY),
      supports_streaming: true,
      supports_functions: true,
      supports_vision: true,
      context_length: 200000,
      max_output_tokens: 8192,
      price_per_input_token: 0.000003,
      price_per_output_token: 0.000015,
      default_temperature: 0.7,
      default_top_p: 1.0,
      enabled: true,
      is_global: true,
    });

    models.push({
      name: 'anthropic/claude-haiku-4.5',
      description: 'Fast and cost-effective Claude model',
      provider: 'anthropic',
      base_url: 'https://api.anthropic.com/v1',
      model_id: 'claude-haiku-4-5-20251001',
      auth_type: 'api_key',
      api_key_encrypted: encrypt(envVars.ANTHROPIC_API_KEY),
      supports_streaming: true,
      supports_functions: true,
      supports_vision: true,
      context_length: 200000,
      max_output_tokens: 8192,
      price_per_input_token: 0.0000008,
      price_per_output_token: 0.000004,
      default_temperature: 0.7,
      default_top_p: 1.0,
      enabled: true,
      is_global: true,
    });
  }

  if (models.length === 0) {
    console.log('[SeedModels] No API keys found in .env');
    console.log('[SeedModels] Set OPENAI_API_KEY or ANTHROPIC_API_KEY and try again');
    return;
  }

  console.log(`[SeedModels] Inserting ${models.length} models...\n`);

  for (const model of models) {
    try {
      // Check if model already exists (global models have user_id = NULL)
      const { data: existing } = await supabase
        .from('llm_models')
        .select('id, name')
        .eq('name', model.name)
        .is('user_id', null)
        .single();

      if (existing) {
        console.log(`[SeedModels] ⊙ ${model.name} (already exists, skipping)`);
        continue;
      }

      // Insert new model
      const { data, error } = await supabase
        .from('llm_models')
        .insert(model)
        .select()
        .single();

      if (error) {
        console.error(`[SeedModels] ✗ ${model.name}: ${error.message}`);
      } else {
        console.log(`[SeedModels] ✓ ${model.name} (${model.model_id})`);
      }
    } catch (error) {
      console.error(`[SeedModels] Exception inserting ${model.name}:`, error);
    }
  }

  console.log('\n[SeedModels] Seeding complete!');
  console.log('[SeedModels] Verifying models...\n');

  const { data: allModels, error: listError } = await supabase
    .from('llm_models')
    .select('name, provider, model_id, enabled, is_global')
    .eq('is_global', true);

  if (listError) {
    console.error('[SeedModels] Error listing models:', listError);
  } else {
    console.log('[SeedModels] Global models:');
    allModels?.forEach(m => {
      console.log(`  - ${m.name} (${m.provider}/${m.model_id}) - ${m.enabled ? 'enabled' : 'disabled'}`);
    });
  }
}

seedModels()
  .then(() => {
    console.log('\n[SeedModels] Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('[SeedModels] Fatal error:', error);
    process.exit(1);
  });
