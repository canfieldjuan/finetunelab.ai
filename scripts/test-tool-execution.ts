// Test if web_search tool can be executed
// Run with: npx tsx scripts/test-tool-execution.ts

import { config } from 'dotenv';
config();

import { getToolByName } from '../lib/tools/registry';

console.log('[Test] Testing web_search tool execution...\n');

// Check if tool is in registry
const tool = getToolByName('web_search');

if (!tool) {
  console.error('[Test] ❌ web_search tool NOT FOUND in registry');
  console.log('[Test] This means the tool is not being loaded at startup');
  process.exit(1);
}

console.log('[Test] ✅ web_search tool found in registry');
console.log('[Test] Tool name:', tool.name);
console.log('[Test] Tool version:', tool.version);
console.log('[Test] Tool enabled:', tool.config.enabled);
console.log('[Test] Parameters:', Object.keys(tool.parameters.properties || {}));

// Check if enabled
if (!tool.config.enabled) {
  console.log('\n[Test] ⚠️  Tool is registered but DISABLED');
  console.log('[Test] Check TOOL_WEBSEARCH_ENABLED in .env');
  console.log('[Test] Current value:', process.env.TOOL_WEBSEARCH_ENABLED);
  process.exit(1);
}

console.log('\n[Test] ✅ Tool is enabled and ready to execute');

// Try a simple execution
async function testExecution() {
  console.log('\n[Test] Attempting simple execution with query "test"...');

  if (!tool) {
    console.error('[Test] ❌ Tool not initialized');
    return;
  }

  try {
    const result = await tool.execute({ query: 'test' });
    console.log('[Test] ✅ Execution successful');
    console.log('[Test] Result type:', typeof result);
    console.log('[Test] Has results:', result && typeof result === 'object' && 'results' in result);
  } catch (error) {
    console.error('[Test] ❌ Execution failed:', error instanceof Error ? error.message : error);
  }
}

testExecution().catch(console.error);
