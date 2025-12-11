// Test script to decrypt HuggingFace token
import { createClient } from '@supabase/supabase-js';
import { decrypt, createApiKeyPreview } from './lib/models/encryption.ts';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testDecryption() {
  console.log('=== Testing HuggingFace Token Decryption ===\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    console.error('❌ ENCRYPTION_KEY not found in environment!');
    return;
  }

  const client = createClient(supabaseUrl, supabaseServiceKey);

  const { data: secrets, error } = await client
    .from('provider_secrets')
    .select('*')
    .eq('provider', 'huggingface')
    .limit(1);

  if (error || !secrets || secrets.length === 0) {
    console.error('❌ No HuggingFace secrets found');
    return;
  }

  const secret = secrets[0];
  console.log(`User ID: ${secret.user_id}`);
  console.log(`Provider: ${secret.provider}`);
  console.log(`Has encrypted key: ${!!secret.api_key_encrypted}`);

  if (!secret.api_key_encrypted) {
    console.error('❌ No encrypted key in database');
    return;
  }

  try {
    const decrypted = decrypt(secret.api_key_encrypted);
    console.log(`\n✓ Decryption successful!`);
    console.log(`Preview: ${createApiKeyPreview(decrypted)}`);
    console.log(`Full token: ${decrypted}`);
    
    if (decrypted === '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') {
      console.log('\n⚠️  THIS IS THE INVALID TOKEN WE SAW IN LOGS!');
      console.log('The database contains the expired/invalid token.');
      console.log('You need to update it with a valid HuggingFace token.');
    } else if (decrypted.startsWith('hf_')) {
      console.log(`\n✓ Token appears to be a valid HuggingFace token format`);
      console.log('Testing with HuggingFace API...');
      
      // Test the token
      const response = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: { 'Authorization': `Bearer ${decrypted}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✓ Token is VALID! Username: ${data.name}`);
      } else {
        console.log(`❌ Token is INVALID! Status: ${response.status}`);
      }
    }
  } catch (err) {
    console.error('❌ Decryption failed:', err.message);
  }
}

testDecryption().catch(console.error);
