const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data } = await supabase
    .from('user_api_keys')
    .select('id, name, key_prefix, scopes')
    .eq('is_active', true)
    .eq('user_id', '38c85707-1fc5-40c6-84be-c017b3b8e750')
    .contains('scopes', ['all'])
    .limit(1);

  if (data && data.length > 0) {
    console.log('\nFound API key with "all" scope:');
    console.log(`Name: ${data[0].name}`);
    console.log(`Prefix: ${data[0].key_prefix}...`);
    console.log(`ID: ${data[0].id}`);
    console.log('\nNote: You need the full key value to use it.');
    console.log('The full key was shown when it was first created.\n');
  } else {
    console.log('\nNo API keys with "all" scope found.');
    console.log('Generate a new one with "all" scope for testing.\n');
  }
})();
