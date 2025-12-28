import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const testRunId = '8be5e9b9-88d1-401d-83a7-f59adf3575c9';

console.log('=== CHECKING BATCH TEST ERROR ===\n');

const { data: batchRun } = await supabase
  .from('batch_test_runs')
  .select('*')
  .eq('id', testRunId)
  .single();

console.log('Status:', batchRun.status);
console.log('Error:', batchRun.error);
console.log('Config:', JSON.stringify(batchRun.config, null, 2));
console.log('');

// Check if there are batch test results
const { data: results } = await supabase
  .from('batch_test_results')
  .select('*')
  .eq('test_run_id', testRunId);

console.log('Results count:', results?.length || 0);

if (results && results.length > 0) {
  results.forEach((r, idx) => {
    console.log(`\nResult ${idx + 1}:`);
    console.log('  Success:', r.success);
    console.log('  Error:', r.error);
    console.log('  Prompt:', r.prompt.substring(0, 50));
  });
}
