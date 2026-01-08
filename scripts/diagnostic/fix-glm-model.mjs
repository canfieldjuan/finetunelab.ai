#!/usr/bin/env node

/**
 * Fix GLM model configuration
 * Updates base_url to point to correct API endpoint
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  const modelId = 'cacfe907-baaa-468b-be77-e473b0861314';

  console.log('GLM Model Configuration Fix\n');
  console.log('Current model is trying to call z-ai/glm-4.7 via OpenAI API');
  console.log('This will NOT work because OpenAI doesn\'t have this model.\n');

  console.log('Available options:\n');
  console.log('1. OpenRouter (recommended) - Access GLM models through OpenRouter aggregator');
  console.log('   Base URL: https://openrouter.ai/api/v1');
  console.log('   Model ID: zhipuai/glm-4');
  console.log('');
  console.log('2. Together.ai - Direct access to Zhipu GLM models');
  console.log('   Base URL: https://api.together.xyz/v1');
  console.log('   Model ID: Zhipu/glm-4-9b-chat');
  console.log('');
  console.log('3. Direct Zhipu AI - Use Zhipu\'s official API (China-based)');
  console.log('   Base URL: https://open.bigmodel.cn/api/paas/v4/');
  console.log('   Model ID: glm-4-flash');
  console.log('');

  const choice = await question('Which option do you want? (1/2/3): ');

  let provider, baseUrl, modelIdNew;

  switch (choice.trim()) {
    case '1':
      provider = 'openrouter';
      baseUrl = 'https://openrouter.ai/api/v1';
      modelIdNew = 'zhipuai/glm-4';
      break;
    case '2':
      provider = 'together';
      baseUrl = 'https://api.together.xyz/v1';
      modelIdNew = 'Zhipu/glm-4-9b-chat';
      break;
    case '3':
      provider = 'openai'; // Use OpenAI-compatible adapter
      baseUrl = 'https://open.bigmodel.cn/api/paas/v4/';
      modelIdNew = 'glm-4-flash';
      break;
    default:
      console.log('Invalid choice. Exiting.');
      rl.close();
      process.exit(1);
  }

  console.log('\nUpdating model configuration...');
  console.log(`  Provider: ${provider}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Model ID: ${modelIdNew}`);

  const { error } = await supabase
    .from('llm_models')
    .update({
      provider,
      base_url: baseUrl,
      model_id: modelIdNew,
      served_model_name: modelIdNew
    })
    .eq('id', modelId);

  if (error) {
    console.error('\n❌ Update failed:', error);
    rl.close();
    process.exit(1);
  }

  console.log('\n✅ Model configuration updated successfully!');
  console.log('\nIMPORTANT: Make sure you have an API key configured for this provider:');
  console.log(`  - Go to Settings > API Keys`);
  console.log(`  - Add your ${provider} API key`);
  console.log(`  - Or update the model's API key directly in the model settings`);

  rl.close();
}

main();
