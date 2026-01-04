import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('=== CHECKING ANALYTICS SESSIONS ===\n');

// 1. Check for tools table
console.log('1. Checking for tools table...');
const { data: tables, error: tablesError } = await supabase
  .from('information_schema.tables')
  .select('table_name')
  .eq('table_schema', 'public')
  .like('table_name', '%tool%');

if (!tablesError && tables) {
  console.log('   Tool-related tables:', tables.map(t => t.table_name).join(', '));
} else {
  console.log('   No tool tables found or error:', tablesError?.message);
}

// 2. Check for auto-tagged conversations
console.log('\n2. Checking for auto-tagged conversations...');
const { data: taggedConvs, error: taggedError } = await supabase
  .from('conversations')
  .select('id, session_id, experiment_name, llm_model_id, title, created_at')
  .not('session_id', 'is', null)
  .order('created_at', { ascending: false })
  .limit(20);

if (!taggedError && taggedConvs) {
  console.log(`   Found ${taggedConvs.length} tagged conversations`);
  taggedConvs.forEach((conv, i) => {
    console.log(`   ${i + 1}. ${conv.session_id} | ${conv.experiment_name} | Model: ${conv.llm_model_id} | ${conv.created_at}`);
  });
} else {
  console.log('   Error:', taggedError?.message);
}

// 3. Check conversations missing experiment_name
console.log('\n3. Checking conversations with session_id but NO experiment_name...');
const { data: missingExp, error: missingExpError } = await supabase
  .from('conversations')
  .select('id, session_id, experiment_name, llm_model_id, title, created_at')
  .not('session_id', 'is', null)
  .is('experiment_name', null)
  .limit(10);

if (!missingExpError && missingExp) {
  console.log(`   Found ${missingExp.length} conversations with session_id but no experiment_name`);
  missingExp.forEach((conv, i) => {
    console.log(`   ${i + 1}. ${conv.session_id} | NO EXPERIMENT NAME | Model: ${conv.llm_model_id}`);
  });
} else {
  console.log('   None found or error:', missingExpError?.message);
}

// 4. Check batch test runs
console.log('\n4. Checking batch test runs...');
const { data: batchTests, error: batchError } = await supabase
  .from('batch_test_runs')
  .select('id, status, model_name, total_prompts, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

if (!batchError && batchTests) {
  console.log(`   Found ${batchTests.length} batch test runs`);
  batchTests.forEach((test, i) => {
    console.log(`   ${i + 1}. ${test.id} | ${test.status} | Model: ${test.model_name} | ${test.created_at}`);
  });
} else {
  console.log('   Error:', batchError?.message);
}

// 5. Check for analytics_tool_logs (new Phase 4 table)
console.log('\n5. Checking analytics_tool_logs table...');
const { data: toolLogs, error: toolLogsError } = await supabase
  .from('analytics_tool_logs')
  .select('tool_name, status, created_at')
  .order('created_at', { ascending: false })
  .limit(5);

if (!toolLogsError && toolLogs) {
  console.log(`   Found ${toolLogs.length} tool logs`);
  toolLogs.forEach((log, i) => {
    console.log(`   ${i + 1}. ${log.tool_name} | ${log.status} | ${log.created_at}`);
  });
} else {
  console.log('   Error or table not found:', toolLogsError?.message);
}

console.log('\n=== DONE ===');
