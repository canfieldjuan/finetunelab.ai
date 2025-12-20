import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkModels() {
  console.log('Checking llm_models table...\n');

  const { data, error } = await supabase
    .from('llm_models')
    .select('id, model_id, name, user_id')
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data?.length || 0} models:\n`);
  data?.forEach(m => {
    console.log(`  ${m.model_id} (${m.name}) - User: ${m.user_id || 'NULL'} - UUID: ${m.id}`);
  });

  console.log('\n\nChecking recent conversations without session_id...\n');

  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('id, user_id, llm_model_id, session_id, title')
    .is('session_id', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (convError) {
    console.error('Error:', convError);
    return;
  }

  console.log(`Found ${convs?.length || 0} conversations without session_id:\n`);
  convs?.forEach(c => {
    console.log(`  ID: ${c.id.substring(0, 8)}... - Model: ${c.llm_model_id || 'NULL'} - Title: ${c.title}`);
  });
}

checkModels();
