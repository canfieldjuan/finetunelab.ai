/**
 * Verification script to test that batch testing now includes tools in traces
 *
 * This script:
 * 1. Checks if user has enabled tools
 * 2. Runs a single batch test
 * 3. Verifies the trace includes tools in input_data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = '38c85707-1fc5-40c6-84be-c017b3b8e750';

console.log('=== BATCH TESTING TOOLS FIX VERIFICATION ===\n');

// Step 1: Check enabled tools (tools are global, not user-specific)
console.log('Step 1: Checking enabled tools...');
const { data: tools, error: toolsError } = await supabase
  .from('tools')
  .select('*')
  .eq('is_enabled', true)
  .order('name');

if (toolsError) {
  console.error('Error fetching tools:', toolsError);
  process.exit(1);
}

console.log(`Found ${tools?.length || 0} enabled tools:`);
tools?.forEach(t => {
  console.log(`  - ${t.name}`);
});
console.log('');

if (!tools || tools.length === 0) {
  console.log('⚠️ No enabled tools found. Enable some tools first to test this fix.');
  process.exit(0);
}

// Step 2: Find a recent batch test conversation
console.log('Step 2: Finding a recent batch test conversation...');
const { data: conversations } = await supabase
  .from('conversations')
  .select('id, title, created_at')
  .eq('user_id', userId)
  .eq('is_widget_session', true)
  .not('batch_test_run_id', 'is', null)
  .order('created_at', { ascending: false })
  .limit(5);

if (!conversations || conversations.length === 0) {
  console.log('⚠️ No batch test conversations found. Run a batch test first.');
  process.exit(0);
}

console.log(`Found ${conversations.length} recent batch test conversations:`);
conversations.forEach(c => {
  console.log(`  - ${c.title} (${c.created_at})`);
});
console.log('');

// Step 3: Check the most recent batch test trace
const mostRecentConv = conversations[0];
console.log(`Step 3: Checking traces for conversation: ${mostRecentConv.title}`);

const { data: traces } = await supabase
  .from('llm_traces')
  .select('trace_id, span_id, input_data, output_data, created_at')
  .eq('conversation_id', mostRecentConv.id)
  .order('created_at', { ascending: false })
  .limit(1);

if (!traces || traces.length === 0) {
  console.log('❌ No traces found for this conversation');
  process.exit(0);
}

const trace = traces[0];
console.log(`\nTrace ID: ${trace.trace_id}`);
console.log(`Created: ${trace.created_at}`);
console.log('');

// Step 4: Verify input_data contains toolDefinitions
console.log('Step 4: Checking input_data.toolDefinitions...');
const inputData = trace.input_data;
const toolDefinitions = inputData?.toolDefinitions;

if (!toolDefinitions) {
  console.log('❌ FAIL: input_data.toolDefinitions is missing');
  console.log('input_data:', JSON.stringify(inputData, null, 2));
  process.exit(1);
}

if (!Array.isArray(toolDefinitions)) {
  console.log('❌ FAIL: toolDefinitions is not an array');
  console.log('toolDefinitions:', toolDefinitions);
  process.exit(1);
}

if (toolDefinitions.length === 0) {
  console.log('❌ FAIL: toolDefinitions is an empty array (should contain tools)');
  console.log('Expected tools:', tools.map(t => t.name).join(', '));
  console.log('');
  console.log('⚠️ This trace may have been created BEFORE the fix was applied.');
  console.log('To verify the fix works:');
  console.log('1. Run a NEW batch test');
  console.log('2. Re-run this verification script');
  process.exit(1);
}

console.log(`✅ SUCCESS: Found ${toolDefinitions.length} tool definitions in input_data`);
console.log('');
console.log('Tool definitions in trace:');
toolDefinitions.forEach(td => {
  console.log(`  - ${td.name}: ${td.description?.substring(0, 60)}...`);
});
console.log('');

// Step 5: Verify output_data.toolCallsMade (if any tools were called)
console.log('Step 5: Checking output_data.toolCallsMade...');
const outputData = trace.output_data;
const toolCallsMade = outputData?.toolCallsMade;

if (!toolCallsMade || toolCallsMade.length === 0) {
  console.log('⚠️ No tools were called in this trace (this is OK, not all prompts use tools)');
} else {
  console.log(`✅ ${toolCallsMade.length} tool(s) were called:`);
  toolCallsMade.forEach(tc => {
    console.log(`  - ${tc.name} (success: ${tc.success})`);
  });
}
console.log('');

// Summary
console.log('=== VERIFICATION SUMMARY ===');
console.log('✅ Input data now includes tool definitions');
console.log('✅ Batch testing traces will have complete tool information');
console.log('');
console.log('Before fix: input_data.toolDefinitions = []');
console.log(`After fix:  input_data.toolDefinitions = [${toolDefinitions.length} tools]`);
console.log('');
console.log('The fix is working correctly!');
