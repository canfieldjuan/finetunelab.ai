import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';

function decrypt(encryptedText) {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('provider_secrets')
  .select('*')
  .ilike('provider', 'huggingface')
  .limit(1)
  .single();

if (error) {
  console.error('Error:', error);
} else if (data) {
  console.log('Encrypted token length:', data.api_key_encrypted?.length);

  try {
    const decrypted = decrypt(data.api_key_encrypted);
    console.log('Decrypted token length:', decrypted.length);
    console.log('Decrypted token preview:', decrypted.substring(0, 8) + '...' + decrypted.substring(decrypted.length - 4));
    console.log('Token starts with hf_:', decrypted.startsWith('hf_'));
  } catch (e) {
    console.error('Decryption failed:', e.message);
  }
}
