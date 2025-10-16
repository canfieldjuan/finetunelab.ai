#!/usr/bin/env node
// Dataset Manager Tool - Registration Verification
// Run: node scripts/verify-dataset-tool.js

const { getRegistryMetadata } = require('../lib/tools/registry');

console.log('Verifying Dataset Management Tool Registration...\n');

try {
  const metadata = getRegistryMetadata();
  
  console.log('Registry Status:');
  console.log(`- Total Tools: ${metadata.toolCount}`);
  console.log(`- Enabled Tools: ${metadata.enabledCount}`);
  console.log(`- Loaded At: ${metadata.loadedAt}\n`);
  
  console.log('Registered Tools:');
  metadata.tools.forEach((tool, index) => {
    const status = tool.enabled ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${tool.name} (v${tool.version})`);
  });
  
  const datasetTool = metadata.tools.find(t => t.name === 'dataset_manager');
  
  if (datasetTool) {
    console.log('\n✅ Dataset Manager Tool is registered!');
    console.log(`   Version: ${datasetTool.version}`);
    console.log(`   Enabled: ${datasetTool.enabled}`);
  } else {
    console.log('\n❌ Dataset Manager Tool NOT found in registry!');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
