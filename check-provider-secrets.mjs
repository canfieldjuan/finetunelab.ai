import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

console.log('=== CHECKING PROVIDER SECRETS ===\n');

const { data: secrets, error } = await supabase
  .from('provider_secrets')
  .select('*')
  .eq('user_id', userId);

if (error) {
  console.error('Error:', error);
} else {
  console.log(`Found ${secrets?.length || 0} provider secrets:\n`);

  secrets?.forEach(s => {
    console.log(`Provider: ${s.provider_name}`);
    console.log(`  Has encrypted key: ${!!s.api_key_encrypted}`);
    console.log(`  Key length: ${s.api_key_encrypted?.length || 0} chars`);
    console.log(`  Created: ${s.created_at}`);
    console.log('');
  });

  const hfSecret = secrets?.find(s => s.provider_name === 'huggingface');

  if (hfSecret && hfSecret.api_key_encrypted) {
    console.log('✓ HuggingFace secret EXISTS!');
    console.log('');
    console.log('So the secret is there... but batch testing is not using it.');
    console.log('This means the authentication is not being passed correctly.');
  } else {
    console.log('❌ HuggingFace secret NOT FOUND in provider_secrets table');
  }
}
