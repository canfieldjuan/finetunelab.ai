// Check what the 2 HuggingFace traces are
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Checking HuggingFace traces\n');

const { data: hfTraces } = await supabase
  .from('llm_traces')
  .select('id, model_name, model_provider, created_at, status, operation_type')
  .eq('model_provider', 'huggingface')
  .order('created_at', { ascending: false });

console.log(`Found ${hfTraces?.length || 0} HuggingFace trace(s):\n`);

hfTraces?.forEach((trace, idx) => {
  console.log(`Trace ${idx + 1}:`);
  console.log(`  - ID: ${trace.id}`);
  console.log(`  - Model Name: ${trace.model_name}`);
  console.log(`  - Provider: ${trace.model_provider}`);
  console.log(`  - Operation: ${trace.operation_type}`);
  console.log(`  - Status: ${trace.status}`);
  console.log(`  - Created: ${trace.created_at}\n`);
});

// Also check what model names exist in llm_models with huggingface provider
console.log('\n🔍 Checking all HuggingFace models in llm_models table:\n');

const { data: hfModels } = await supabase
  .from('llm_models')
  .select('id, name, provider, is_global, enabled')
  .eq('provider', 'huggingface');

console.log(`Found ${hfModels?.length || 0} HuggingFace model(s):\n`);

hfModels?.forEach((model, idx) => {
  console.log(`Model ${idx + 1}:`);
  console.log(`  - ID: ${model.id}`);
  console.log(`  - Name: ${model.name}`);
  console.log(`  - Enabled: ${model.enabled}`);
  console.log(`  - is_global: ${model.is_global}\n`);
});
