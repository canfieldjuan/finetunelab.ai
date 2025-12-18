import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get a recent user ID from messages
const { data, error } = await supabase
  .from('messages')
  .select('conversation_id, conversations(user_id)')
  .limit(1);

if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

if (data && data.length > 0 && data[0].conversations) {
  console.log(data[0].conversations.user_id);
} else {
  console.error('No user found');
  process.exit(1);
}
