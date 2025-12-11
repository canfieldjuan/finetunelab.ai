const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkModelNames() {
  // Check training_configs table
  const { data: configs, error } = await supabase
    .from('training_configs')
    .select('id, config_json')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== Recent Training Configs ===');
  configs.forEach(config => {
    const modelName = config.config_json?.model?.name;
    console.log(`Config ${config.id}: model.name = "${modelName}"`);
  });
}

checkModelNames().then(() => process.exit(0));
