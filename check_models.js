const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl ? 'present' : 'MISSING');
console.log('Service Role Key:', serviceRoleKey ? 'present' : 'MISSING');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkModels() {
  console.log('\n=== Checking llm_models table ===\n');
  
  const { data, error } = await supabase
    .from('llm_models')
    .select('id, name, provider, is_global, enabled, user_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error querying models:', error.message);
    return;
  }

  console.log(`Found ${data?.length || 0} total models:\n`);
  
  if (data && data.length > 0) {
    data.forEach((model, idx) => {
      console.log(`${idx + 1}. ${model.name}`);
      console.log(`   ID: ${model.id}`);
      console.log(`   Provider: ${model.provider}`);
      console.log(`   Global: ${model.is_global}`);
      console.log(`   Enabled: ${model.enabled}`);
      console.log(`   User ID: ${model.user_id || 'null'}`);
      console.log(`   Created: ${model.created_at}`);
      console.log('');
    });

    const enabledModels = data.filter(m => m.enabled);
    const globalModels = data.filter(m => m.is_global);
    
    console.log(`\nSummary:`);
    console.log(`  Total: ${data.length}`);
    console.log(`  Enabled: ${enabledModels.length}`);
    console.log(`  Global: ${globalModels.length}`);
    console.log(`  User-specific: ${data.length - globalModels.length}`);
  } else {
    console.log('No models found in database!');
    console.log('This is why the batch testing dropdown is empty.');
  }
}

checkModels().catch(console.error);
