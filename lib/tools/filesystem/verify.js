// Filesystem Tool - Simple Verification Script
// Tests basic functionality without complex TypeScript types

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('Filesystem Tool Verification');
console.log('============================\n');

// Test 1: Check if tool files exist
console.log('Test 1: Checking file structure...');
const requiredFiles = [
  'index.ts',
  'filesystem.tool.ts',
  'security/pathValidator.ts',
  'security/permissionCheck.ts',
  'security/sanitizer.ts'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const fullPath = join(__dirname, file);
  const exists = existsSync(fullPath);
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (allFilesExist) {
  console.log('\n✅ All required files exist\n');
} else {
  console.log('\n❌ Some files are missing\n');
  process.exit(1);
}

// Test 2: Verify registry integration
console.log('Test 2: Checking registry integration...');
const registryPath = join(__dirname, '../registry.ts');
const registryContent = readFileSync(registryPath, 'utf8');

if (registryContent.includes('filesystemTool')) {
  console.log('  ✓ Filesystem tool registered in registry\n');
  console.log('✅ Registry integration verified\n');
} else {
  console.log('  ✗ Filesystem tool not found in registry\n');
  console.log('❌ Registry integration failed\n');
  process.exit(1);
}

// Test 3: Check TypeScript compilation
console.log('Test 3: Verifying TypeScript syntax...');
console.log('  (Run "npm run build" or "tsc" to verify compilation)\n');

console.log('============================');
console.log('✨ Basic verification complete!');
console.log('');
console.log('Next steps:');
console.log('  1. Run TypeScript compiler to verify no errors');
console.log('  2. Test filesystem operations in development');
console.log('  3. Verify security restrictions work correctly');
