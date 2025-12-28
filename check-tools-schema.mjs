import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('=== TOOLS TABLE SCHEMA ===\n');

const { data: tools } = await supabase
  .from('tools')
  .select('*')
  .eq('is_enabled', true)
  .limit(1);

if (tools && tools.length > 0) {
  console.log('Columns in tools table:');
  console.log(Object.keys(tools[0]));
  console.log('');
  console.log('First record:');
  console.log(JSON.stringify(tools[0], null, 2));
}
