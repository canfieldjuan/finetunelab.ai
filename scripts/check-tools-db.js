#!/usr/bin/env node
/**
 * Check what tools are actually being sent to the LLM
 * Run this to see the exact tools payload
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-project-url';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTools() {
  console.log('='.repeat(60));
  console.log('TOOL DATABASE CHECK');
  console.log('='.repeat(60));
  
  // Get all tools
  const { data: allTools, error: allError } = await supabase
    .from('tools')
    .select('*')
    .order('name');
    
  if (allError) {
    console.error('❌ Error fetching all tools:', allError);
    return;
  }
  
  console.log('\n📋 ALL TOOLS IN DATABASE:');
  console.log(JSON.stringify(allTools, null, 2));
  
  // Get enabled tools only
  const { data: enabledTools, error: enabledError } = await supabase
    .from('tools')
    .select('*')
    .eq('is_enabled', true)
    .order('name');
    
  if (enabledError) {
    console.error('❌ Error fetching enabled tools:', enabledError);
    return;
  }
  
  console.log('\n✅ ENABLED TOOLS (sent to LLM):');
  console.log(`Found ${enabledTools.length} enabled tools:`);
  enabledTools.forEach(tool => {
    console.log(`  - ${tool.name} (builtin: ${tool.is_builtin})`);
  });
  
  console.log('\n📤 TOOLS AS SENT TO OPENAI API:');
  const apiFormat = enabledTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }
  }));
  console.log(JSON.stringify(apiFormat, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log(`SUMMARY: ${enabledTools.length} tools will be sent to the LLM`);
  console.log('='.repeat(60));
}

checkTools().catch(console.error);
