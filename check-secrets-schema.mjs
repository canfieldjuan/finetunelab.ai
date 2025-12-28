import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

console.log('=== PROVIDER SECRETS SCHEMA ===\n');

const { data: secrets } = await supabase
  .from('provider_secrets')
  .select('*')
  .eq('user_id', userId)
  .limit(1);

if (secrets && secrets.length > 0) {
  console.log('Columns in provider_secrets table:');
  console.log(Object.keys(secrets[0]));
  console.log('');
  console.log('First record:');
  console.log(JSON.stringify(secrets[0], null, 2));
}
