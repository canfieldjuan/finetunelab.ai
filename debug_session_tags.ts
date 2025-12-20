import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars!');
    console.log('URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking llm_models table...\n');

  // Try to read models
  const { data: models, error } = await supabase
    .from('llm_models')
    .select('id, model_id, name')
    .limit(10);

  if (error) {
    console.error('❌ Error reading llm_models:', error);
  } else {
    console.log(`✅ Found ${models?.length || 0} models:`);
    models?.forEach(m => console.log(`  - ${m.model_id} (${m.name})`));
  }

  // Check recent conversations
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, llm_model_id, session_id, title')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n📝 Recent conversations:');
  convs?.forEach(c => console.log(`  - Model: ${c.llm_model_id || 'NULL'}, Session: ${c.session_id || 'NULL'}`));
}

main().catch(console.error);
