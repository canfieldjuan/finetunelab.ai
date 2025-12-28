import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';
const normalizedProvider = 'huggingface';

console.log('=== TESTING ILIKE QUERY ===\n');
console.log('Looking for provider:', normalizedProvider);
console.log('User ID:', userId);
console.log('');

// Test the exact query that getSecret uses
const { data, error } = await supabase
  .from('provider_secrets')
  .select('*')
  .eq('user_id', userId)
  .ilike('provider', normalizedProvider)
  .single();

console.log('Query result:');
console.log('Error:', error);
console.log('Data:', data);
console.log('');

if (data) {
  console.log('✅ FOUND SECRET');
  console.log('Provider:', data.provider);
  console.log('Has API key:', !!data.api_key_encrypted);
} else if (error) {
  console.log('❌ QUERY ERROR');
  console.log('Error code:', error.code);
  console.log('Error message:', error.message);

  // Try without .single() to see if multiple results
  console.log('');
  console.log('Trying without .single()...');
  const { data: multiData, error: multiError } = await supabase
    .from('provider_secrets')
    .select('*')
    .eq('user_id', userId)
    .ilike('provider', normalizedProvider);

  console.log('Multiple results:', multiData?.length || 0);
  multiData?.forEach((s, i) => {
    console.log(`  ${i + 1}. Provider: "${s.provider}"`);
  });
}
