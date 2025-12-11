#!/usr/bin/env node
// Debug script to check if tools are being sent to the API

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkToolSetup() {
  console.log('\n=== TOOL USAGE DIAGNOSTIC ===\n');
  
  // 1. Check calculator tool in database
  console.log('1. Checking calculator tool in database...');
  const { data: calcTool, error } = await supabase
    .from('tools')
    .select('*')
    .eq('name', 'calculator')
    .single();
  
  if (error) {
    console.log('   ERROR:', error.message);
    return;
  }
  
  console.log('   Name:', calcTool.name);
  console.log('   Enabled:', calcTool.enabled);
  console.log('   Description:', calcTool.description);
  console.log('   Parameters:', JSON.stringify(calcTool.parameters, null, 2));
  
  // 2. Check if description is directive enough
  console.log('\n2. Checking if description has directive keywords...');
  const directives = ['ALWAYS', 'MUST', 'use this tool', 'instead of'];
  const hasDirectives = directives.some(d => 
    calcTool.description.toLowerCase().includes(d.toLowerCase())
  );
  
  if (hasDirectives) {
    console.log('   ✓ Description has directive keywords');
  } else {
    console.log('   ✗ Description lacks directive keywords (LLM may choose not to use it)');
    console.log('   Recommendation: Update description to be more directive');
    console.log('   Example: "ALWAYS use this tool for mathematical calculations instead of approximating."');
  }
  
  // 3. Check recent tool executions
  console.log('\n3. Checking recent tool executions...');
  const { data: executions } = await supabase
    .from('tool_executions')
    .select('*')
    .eq('tool_name', 'calculator')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (executions && executions.length > 0) {
    console.log(`   Found ${executions.length} recent executions:`);
    executions.forEach((exec, i) => {
      console.log(`   ${i + 1}. ${exec.created_at}: ${exec.params} -> ${exec.result}`);
    });
  } else {
    console.log('   ✗ No recent executions found');
    console.log('   This suggests the LLM is not calling the calculator tool');
  }
  
  console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
  console.log('TROUBLESHOOTING STEPS:');
  console.log('1. Open browser DevTools console');
  console.log('2. Send: "Calculate 23% of 456"');
  console.log('3. Look for these logs:');
  console.log('   - "[Chat] Loaded tools: 2"');
  console.log('   - "[API] Request with X messages, 2 tools"');
  console.log('   - "[API] Using non-streaming tool-aware path"');
  console.log('   - "[OpenAI ToolCall Debug] Full OpenAI response:"');
  console.log('   - "[Calculator Tool] Evaluating: ..."');
  console.log('\n4. If you see "Using non-streaming" but NO "Calculator Tool" log:');
  console.log('   -> LLM chose not to use the tool (description not directive enough)');
  console.log('\n5. If you do NOT see "Using non-streaming":');
  console.log('   -> Tools array not being sent to API (frontend issue)');
}

checkToolSetup().catch(console.error);
