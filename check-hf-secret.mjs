import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('provider_secrets')
  .select('*')
  .ilike('provider', 'huggingface')
  .limit(5);

if (error) {
  console.error('Error:', error);
} else {
  console.log('HuggingFace secrets found:', data?.length || 0);
  data?.forEach((secret, i) => {
    console.log(`\nSecret ${i+1}:`);
    console.log('  Provider:', secret.provider);
    console.log('  User ID:', secret.user_id);
    console.log('  Has encrypted key:', !!secret.api_key_encrypted);
    console.log('  Encrypted key length:', secret.api_key_encrypted?.length || 0);
    console.log('  Metadata:', secret.metadata);
  });
}
