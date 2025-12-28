import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const modelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

console.log('=== CURRENT MODEL STATE ===\n');

const { data: model } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', modelId)
  .single();

console.log('All Fields:');
Object.entries(model || {}).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});
