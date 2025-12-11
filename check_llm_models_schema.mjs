import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking llm_models schema...\n');

  // Get an example record to see the structure
  const { data } = await supabase
    .from('llm_models')
    .select('*')
    .limit(1);

  if (data && data.length > 0) {
    console.log('Sample record structure:');
    console.log(JSON.stringify(data[0], null, 2));
  }
}

checkSchema();
