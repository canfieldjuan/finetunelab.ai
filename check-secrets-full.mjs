import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

console.log('=== PROVIDER SECRETS FULL DATA ===\n');

const { data: secrets } = await supabase
  .from('provider_secrets')
  .select('*')
  .eq('user_id', userId);

console.log('Table columns:', Object.keys(secrets[0] || {}));
console.log('');

secrets?.forEach((s, i) => {
  console.log(`Secret ${i + 1}:`);
  console.log(JSON.stringify(s, null, 2));
  console.log('');
});
