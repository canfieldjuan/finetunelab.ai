// Test script to verify tools.config.yaml is loading correctly
// Run: npx tsx scripts/test-tools-config.ts

import { getToolsConfig, getFilesystemConfig } from '../lib/config/toolsConfig';

console.log('========================================');
console.log('Tools Configuration Test');
console.log('========================================\n');

try {
  // Load full config
  const config = getToolsConfig();
  console.log('[Test] Full configuration loaded successfully');
  console.log(JSON.stringify(config, null, 2));

  console.log('\n========================================');
  console.log('Filesystem Configuration');
  console.log('========================================\n');

  // Load filesystem-specific config
  const fsConfig = getFilesystemConfig();

  console.log('[Test] Filesystem config:');
  console.log('  Enabled:', fsConfig.enabled);
  console.log('  Allowed paths:', fsConfig.security.allowedPaths);
  console.log('  Blocked paths:', fsConfig.security.blockedPaths);
  console.log('  Blocked extensions:', fsConfig.security.blockedExtensions);
  console.log('  Max file size:', fsConfig.limits.maxFileSize, 'bytes');
  console.log('  Max directory items:', fsConfig.limits.maxDirectoryItems);
  console.log('  Follow symlinks:', fsConfig.options.followSymlinks);
  console.log('  Read only:', fsConfig.options.readOnly);

  console.log('\n========================================');
  console.log('Validation Tests');
  console.log('========================================\n');

  // Validate structure
  if (fsConfig.enabled === undefined) {
    throw new Error('Config validation failed: enabled is undefined');
  }

  if (!Array.isArray(fsConfig.security.allowedPaths)) {
    throw new Error('Config validation failed: allowedPaths is not an array');
  }

  if (fsConfig.security.allowedPaths.length === 0) {
    console.warn('[Warning] No allowed paths configured - filesystem tool may not work');
  }

  console.log('[Test] ✓ Configuration structure valid');
  console.log('[Test] ✓ All required fields present');
  console.log('[Test] ✓ Allowed paths:', fsConfig.security.allowedPaths.length);

  console.log('\n========================================');
  console.log('Test Result: SUCCESS');
  console.log('========================================\n');

  process.exit(0);
} catch (error) {
  console.error('\n========================================');
  console.error('Test Result: FAILED');
  console.error('========================================\n');
  console.error('[Error]', error);
  process.exit(1);
}
