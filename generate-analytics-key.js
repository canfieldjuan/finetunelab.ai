const { generateApiKey } = require('./lib/auth/api-key-generator.ts');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[Generate] Creating new API key with "all" scope for analytics testing...\n');

// Generate key
const { key, keyHash, keyPrefix } = generateApiKey();

console.log('Generated API Key:');
console.log('  Full Key:', key);
console.log('  Key Prefix:', keyPrefix);
console.log('\nStoring in database with "all" scope...');

const supabase = createClient(supabaseUrl, supabaseKey);
const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

(async () => {
  const { data, error } = await supabase
    .from('user_api_keys')
    .insert({
      user_id: userId,
      name: 'SDK_TEST_ANALYTICS',
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: ['all'],  // Full access to training + production + testing
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('\n✓ API Key created successfully!');
    console.log('\nID:', data.id);
    console.log('Name:', data.name);
    console.log('Scopes:', data.scopes);
    console.log('\n=== SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN ===');
    console.log('API Key:', key);
    console.log('===================================================\n');
    console.log('This key can be used for:');
    console.log('  • Training predictions (training scope)');
    console.log('  • Production analytics (production scope)');
    console.log('  • Batch testing (testing scope)');
    console.log();
  }
})();
