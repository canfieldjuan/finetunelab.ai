#!/usr/bin/env node

/**
 * Test OpenRouter API directly with the encrypted key
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../../lib/models/encryption.js';

const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const modelId = '03d60ee6-3d1a-4f71-8790-36ae8fdc3d6e';

  const { data: model } = await supabase
    .from('llm_models')
    .select('api_key_encrypted')
    .eq('id', modelId)
    .single();

  const apiKey = decrypt(model.api_key_encrypted);

  console.log('API Key Preview:', apiKey.substring(0, 20) + '...');
  console.log('API Key Length:', apiKey.length);
  console.log('Starts with sk-or-v1:', apiKey.startsWith('sk-or-v1-'));
  console.log('');

  console.log('Testing OpenRouter API directly...');
  console.log('');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://finetunelab.ai',
      'X-Title': 'FineTuneLab',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'mistralai/mistral-small-creative',
      messages: [{ role: 'user', content: 'Say hello' }]
    })
  });

  console.log('Status:', response.status, response.statusText);

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

main();
