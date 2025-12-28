import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

console.log('=== VERIFYING HUGGINGFACE SECRET ===\n');

// Check all provider secrets for this user
const { data: secrets, error } = await supabase
  .from('provider_api_keys')
  .select('*')
  .eq('user_id', userId);

if (error) {
  console.error('Error fetching secrets:', error);
} else {
  console.log(`Found ${secrets?.length || 0} provider secrets:\n`);

  secrets?.forEach(s => {
    console.log(`Provider: ${s.provider}`);
    console.log(`  Has encrypted key: ${!!s.api_key_encrypted}`);
    console.log(`  Created: ${s.created_at}`);
    console.log(`  Updated: ${s.updated_at}`);
    console.log('');
  });

  const hfSecret = secrets?.find(s => s.provider === 'huggingface');

  if (hfSecret && hfSecret.api_key_encrypted) {
    console.log('✓ HuggingFace secret EXISTS and is encrypted');
    console.log('Length of encrypted data:', hfSecret.api_key_encrypted.length);
  } else {
    console.log('❌ HuggingFace secret NOT FOUND');
  }
}
