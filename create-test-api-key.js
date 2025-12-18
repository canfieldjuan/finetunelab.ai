// Create a temporary test API key
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = 'https://tkizlemssfmrfluychsn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';

const supabase = createClient(supabaseUrl, supabaseKey);

function generateApiKey() {
  const randomBytes = crypto.randomBytes(32);
  return 'wak_' + randomBytes.toString('base64url').substring(0, 43);
}

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function createTestKey() {
  const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750'; // User with predictions
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 12);

  console.log('Creating test API key...\n');

  const { data, error } = await supabase
    .from('user_api_keys')
    .insert({
      user_id: userId,
      name: 'TEST_PREDICTIONS_SDK',
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: ['training'],
      is_active: true,
      last_used_at: null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating key:', error);
    return null;
  }

  console.log('✓ Test API key created successfully!');
  console.log('\nAPI Key (save this, it won\'t be shown again):');
  console.log('─────────────────────────────────────────────');
  console.log(apiKey);
  console.log('─────────────────────────────────────────────');
  console.log('\nKey Details:');
  console.log(`  ID: ${data.id}`);
  console.log(`  Name: ${data.name}`);
  console.log(`  Scopes: ${JSON.stringify(data.scopes)}`);
  console.log(`  User ID: ${userId}`);
  console.log('\nUse this key to test the predictions endpoints!');

  return apiKey;
}

createTestKey().catch(console.error);
