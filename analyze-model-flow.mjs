import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const modelId = '3d086d4a-f0d3-41dd-88e7-cd24bffaa760';

console.log('=== CHECKING MODEL CONFIGURATION ===\n');

const { data: model, error } = await supabase
  .from('llm_models')
  .select('*')
  .eq('id', modelId)
  .single();

if (error) {
  console.log('Error:', error.message);
  process.exit(1);
}

console.log('Model Record:');
console.log('  ID:', model.id);
console.log('  Name:', model.name);
console.log('  Provider:', model.provider);
console.log('  Model ID (sent to API):', model.model_id);
console.log('  Display Name:', model.display_name || 'none');
console.log('  Description:', model.description || 'none');
console.log('  Is Active:', model.is_active);
console.log('  Has API Key ID:', model.api_key_id || 'none');
