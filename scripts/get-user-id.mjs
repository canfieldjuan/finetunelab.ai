import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase.auth.admin.listUsers();
if (error) {
  console.error('Error:', error);
} else {
  if (data.users.length > 0) {
    console.log(data.users[0].id);
  } else {
    console.log('00000000-0000-0000-0000-000000000001');
  }
}
