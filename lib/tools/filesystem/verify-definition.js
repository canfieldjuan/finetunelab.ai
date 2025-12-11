// Filesystem Tool - Definition Verification
// Verifies tool structure matches project patterns

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Tool Definition Verification');
console.log('=============================\n');

// Test 1: Verify ToolDefinition structure
console.log('Test 1: Checking ToolDefinition structure...');
const toolPath = join(__dirname, 'filesystem.tool.ts');
const toolContent = readFileSync(toolPath, 'utf8');

const checks = {
  'name property': /name:\s*['"]filesystem['"]/,
  'description property': /description:\s*['"].*['"]/,
  'version property': /version:\s*['"][\d.]+['"]/,
  'parameters.type': /parameters:\s*{\s*type:\s*['"]object['"]/,
  'parameters.properties': /properties:\s*{/,
  'parameters.required': /required:\s*\[/,
  'config property': /config:\s*{/,
  'config.enabled': /enabled:\s*(true|false)/,
  'execute method': /async\s+execute\s*\(/,
  'error throwing': /throw\s+new\s+Error\(/,
};

let allChecksPassed = true;
Object.entries(checks).forEach(([name, pattern]) => {
  const passed = pattern.test(toolContent);
  console.log(`  ${passed ? '✓' : '✗'} ${name}`);
  if (!passed) allChecksPassed = false;
});

if (allChecksPassed) {
  console.log('\n✅ Tool structure matches ToolDefinition interface\n');
} else {
  console.log('\n❌ Tool structure has issues\n');
  process.exit(1);
}

// Test 2: Verify error handling pattern
console.log('Test 2: Checking error handling pattern...');
const errorChecks = {
  'Uses [ToolName] prefix': /\[FileSystem\]/,
  'Throws on validation error': /throw\s+new\s+Error.*ValidationError/,
  'Throws on operation error': /throw\s+new\s+Error.*OperationError/,
  'Returns operation results': /return\s+await\s+defaultFilesystemTool/,
};

let errorHandlingOk = true;
Object.entries(errorChecks).forEach(([name, pattern]) => {
  const passed = pattern.test(toolContent);
  console.log(`  ${passed ? '✓' : '✗'} ${name}`);
  if (!passed) errorHandlingOk = false;
});

if (errorHandlingOk) {
  console.log('\n✅ Error handling matches project pattern\n');
} else {
  console.log('\n❌ Error handling pattern issues\n');
  process.exit(1);
}

// Test 3: Verify parameter schema
console.log('Test 3: Checking parameter schema...');
const paramChecks = {
  'operation parameter': /operation:\s*{[^}]*type:\s*['"]string['"]/,
  'path parameter': /path:\s*{[^}]*type:\s*['"]string['"]/,
  'enum for operation': /enum:\s*\[.*list_directory.*read_file.*file_info/,
  'required array': /required:\s*\[.*operation.*path/,
};

let paramSchemaOk = true;
Object.entries(paramChecks).forEach(([name, pattern]) => {
  const passed = pattern.test(toolContent);
  console.log(`  ${passed ? '✓' : '✗'} ${name}`);
  if (!passed) paramSchemaOk = false;
});

if (paramSchemaOk) {
  console.log('\n✅ Parameter schema is correct\n');
} else {
  console.log('\n❌ Parameter schema issues\n');
  process.exit(1);
}

console.log('=============================');
console.log('✨ All definition checks passed!');
console.log('Tool definition matches project patterns.');
