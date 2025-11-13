const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkModels() {
  const { data, error } = await supabase
    .from('llm_models')
    .select('id, name, provider, base_url')
    .eq('enabled', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== Model Base URLs ===\n');
  data.forEach(m => {
    console.log(`${m.name} (${m.provider})`);
    console.log(`  URL: ${m.base_url}`);
    console.log(`  ID: ${m.id}`);
    console.log('');
  });
}

checkModels();
