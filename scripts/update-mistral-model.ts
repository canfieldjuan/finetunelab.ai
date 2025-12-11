// Quick script to update Mistral model to v0.3
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateMistralModel() {
  console.log('Updating Mistral model from v0.2 to v0.3...');

  const { data, error } = await supabase
    .from('llm_models')
    .update({ model_id: 'mistralai/Mistral-7B-Instruct-v0.3' })
    .eq('model_id', 'mistralai/Mistral-7B-Instruct-v0.2')
    .select();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Updated models:', data);
  console.log('✓ Done! Refresh your browser and try again.');
}

updateMistralModel();
