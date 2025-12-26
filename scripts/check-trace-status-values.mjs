import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('llm_traces')
  .select('status')
  .limit(20);

if (error) {
  console.error('Error:', error);
} else {
  const uniqueStatuses = [...new Set(data.map(t => t.status))];
  console.log('Unique status values:', uniqueStatuses);
}
