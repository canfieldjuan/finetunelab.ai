// Test script to check raw secret data
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkRawSecret() {
  console.log('=== Checking Raw Secret Data ===\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  
  console.log('Environment check:');
  console.log(`  ENCRYPTION_KEY present: ${!!encryptionKey}`);
  console.log(`  ENCRYPTION_KEY length: ${encryptionKey ? encryptionKey.length : 0}`);
  
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
  console.log('\nDatabase record:');
  console.log(`  Provider: ${secret.provider}`);
  console.log(`  User ID: ${secret.user_id}`);
  console.log(`  Created: ${secret.created_at}`);
  console.log(`  Encrypted key present: ${!!secret.api_key_encrypted}`);
  
  if (secret.api_key_encrypted) {
    const encrypted = secret.api_key_encrypted;
    console.log(`\n  Encrypted data length: ${encrypted.length}`);
    console.log(`  First 100 chars: ${encrypted.substring(0, 100)}`);
    console.log(`  Contains colon: ${encrypted.includes(':')}`);
    
    // Check format
    if (encrypted.includes(':')) {
      const parts = encrypted.split(':');
      console.log(`  Parts count: ${parts.length}`);
      console.log(`  IV part length: ${parts[0]?.length || 0}`);
      console.log(`  Data part length: ${parts[1]?.length || 0}`);
    } else {
      console.log('  ⚠️  No colon separator - unexpected format!');
    }
  }
}

checkRawSecret().catch(console.error);
