import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const modelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

console.log('=== CHECKING FOR DUPLICATE MODEL RECORDS ===\n');

const { data: records, error } = await supabase
  .from('llm_models')
  .select('id, name, provider, model_id, enabled, is_global, created_at')
  .eq('id', modelId);

if (error) {
  console.log('Error:', error.message);
  process.exit(1);
}

console.log('Records found:', records.length);
records?.forEach((r, i) => {
  console.log('\n' + (i + 1) + '.');
  console.log('  ID:', r.id);
  console.log('  Name:', r.name);
  console.log('  Provider:', r.provider);
  console.log('  Model ID:', r.model_id);
  console.log('  Enabled:', r.enabled);
  console.log('  Is Global:', r.is_global);
  console.log('  Created:', r.created_at);
});
