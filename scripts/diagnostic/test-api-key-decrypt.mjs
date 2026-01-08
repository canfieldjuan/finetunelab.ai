#!/usr/bin/env node

/**
 * Test if API key can be decrypted
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

// Import encryption utilities
async function main() {
  const modelId = 'be0372ac-cacb-458b-ba21-ac4ef0f2f71c';

  const { data: model, error } = await supabase
    .from('llm_models')
    .select('id, name, provider, api_key_encrypted')
    .eq('id', modelId)
    .single();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Model:', model.name);
  console.log('Provider:', model.provider);
  console.log('Has encrypted key:', !!model.api_key_encrypted);
  console.log('Encrypted key length:', model.api_key_encrypted?.length || 0);

  if (model.api_key_encrypted) {
    // Try to decrypt it
    try {
      const { decrypt } = await import('../../lib/models/encryption.js');
      const decrypted = decrypt(model.api_key_encrypted);
      console.log('✓ Decryption successful');
      console.log('Decrypted key preview:', decrypted.substring(0, 15) + '...');
      console.log('Decrypted key length:', decrypted.length);

      if (decrypted.length === 0) {
        console.log('❌ ERROR: Decrypted key is empty!');
      } else if (!decrypted.startsWith('sk-')) {
        console.log('⚠️  WARNING: Key does not start with sk- (may not be OpenRouter key)');
      }
    } catch (err) {
      console.log('❌ Decryption failed:', err.message);
    }
  } else {
    console.log('❌ No encrypted API key found');
  }
}

main();
