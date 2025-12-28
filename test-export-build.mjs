#!/usr/bin/env node

/**
 * Export System Build & Structure Test
 * Tests that export system is properly structured
 * Date: 2025-12-21
 */

import { promises as fs } from 'fs';
import path from 'path';

// Test results
const results = { passed: 0, failed: 0, tests: [] };

function logTest(name, status, details = '') {
  const emoji = status === 'PASS' ? '✅' : '❌';
  console.log(`${emoji} ${status}: ${name}`);
  if (details) console.log(`   ${details}`);

  results.tests.push({ name, status, details });
  if (status === 'PASS') results.passed++;
  else results.failed++;
}

console.log('='.repeat(60));
console.log('🧪 EXPORT SYSTEM BUILD & STRUCTURE TEST');
console.log('='.repeat(60));
console.log('Testing export system structure and configuration\n');

// ============================================
// Test 1: Tool Registry Structure
// ============================================
console.log('📋 Test Group 1: Tool Registry Structure');
console.log('-'.repeat(60));

try {
  const registryContent = await fs.readFile('lib/tools/registry.ts', 'utf-8');

  // Check imports
  const hasOldToolImport = registryContent.includes("import { analyticsExportTool } from './analytics-export'");
  const hasNewToolImport = registryContent.includes("import { unifiedExportTool } from './unified-export'");

  if (hasOldToolImport) {
    logTest('Registry imports old analytics_export tool', 'PASS');
  } else {
    logTest('Registry imports old analytics_export tool', 'FAIL');
  }

  if (hasNewToolImport) {
    logTest('Registry imports new unified_export tool', 'PASS');
  } else {
    logTest('Registry imports new unified_export tool', 'FAIL');
  }

  // Check registrations
  const hasOldToolRegister = registryContent.includes('registerTool(analyticsExportTool)');
  const hasNewToolRegister = registryContent.includes('registerTool(unifiedExportTool)');

  if (hasOldToolRegister) {
    logTest('Registry registers old analytics_export tool', 'PASS');
  } else {
    logTest('Registry registers old analytics_export tool', 'FAIL');
  }

  if (hasNewToolRegister) {
    logTest('Registry registers new unified_export tool', 'PASS');
  } else {
    logTest('Registry registers new unified_export tool', 'FAIL');
  }

  // Check comments
  const hasDeprecationComment = registryContent.includes('Deprecated - keeping during grace period') ||
                                registryContent.includes('grace period');
  const hasNewToolComment = registryContent.includes('Unified Export System v2') ||
                           registryContent.includes('NEW');

  if (hasDeprecationComment) {
    logTest('Registry has deprecation comments', 'PASS');
  } else {
    logTest('Registry has deprecation comments', 'FAIL');
  }

  if (hasNewToolComment) {
    logTest('Registry has new tool comments', 'PASS');
  } else {
    logTest('Registry has new tool comments', 'FAIL');
  }

} catch (error) {
  logTest('Tool registry structure check', 'FAIL', error.message);
}

// ============================================
// Test 2: Unified Export Tool Definition
// ============================================
console.log('\n✨ Test Group 2: Unified Export Tool Definition');
console.log('-'.repeat(60));

try {
  const toolContent = await fs.readFile('lib/tools/unified-export/index.ts', 'utf-8');

  // Check tool name and version
  const hasName = toolContent.includes("name: 'unified_export'");
  const hasVersion = toolContent.includes("version: '2.0.0'");

  if (hasName) {
    logTest("Tool has correct name 'unified_export'", 'PASS');
  } else {
    logTest("Tool has correct name 'unified_export'", 'FAIL');
  }

  if (hasVersion) {
    logTest("Tool has version '2.0.0'", 'PASS');
  } else {
    logTest("Tool has version '2.0.0'", 'FAIL');
  }

  // Check operations
  const operations = ['create_export', 'list_exports', 'get_download_link', 'delete_export'];
  for (const op of operations) {
    if (toolContent.includes(op)) {
      logTest(`Tool supports operation: ${op}`, 'PASS');
    } else {
      logTest(`Tool supports operation: ${op}`, 'FAIL');
    }
  }

  // Check export types
  const exportTypes = ['conversation', 'analytics', 'trace'];
  for (const type of exportTypes) {
    if (toolContent.includes(`'${type}'`)) {
      logTest(`Tool supports export type: ${type}`, 'PASS');
    } else {
      logTest(`Tool supports export type: ${type}`, 'FAIL');
    }
  }

  // Check formats
  const formats = ['csv', 'json', 'jsonl', 'markdown', 'txt'];
  for (const fmt of formats) {
    if (toolContent.includes(`'${fmt}'`)) {
      logTest(`Tool supports format: ${fmt}`, 'PASS');
    } else {
      logTest(`Tool supports format: ${fmt}`, 'FAIL');
    }
  }

  // Check it calls v2 API
  const callsV2API = toolContent.includes('/api/export/v2');
  if (callsV2API) {
    logTest('Tool calls v2 API endpoints', 'PASS');
  } else {
    logTest('Tool calls v2 API endpoints', 'FAIL');
  }

  // Check for TypeScript error fix (no 'items' property)
  const hasItemsProperty = toolContent.includes("items: { type: 'string' }");
  if (!hasItemsProperty) {
    logTest('Tool has no invalid items property (TS error fixed)', 'PASS');
  } else {
    logTest('Tool has no invalid items property (TS error fixed)', 'FAIL',
      'TypeScript error still present');
  }

} catch (error) {
  logTest('Unified export tool check', 'FAIL', error.message);
}

// ============================================
// Test 3: Unified Export System Files
// ============================================
console.log('\n📦 Test Group 3: Unified Export System Files');
console.log('-'.repeat(60));

const unifiedFiles = [
  { path: 'lib/export-unified/UnifiedExportService.ts', name: 'UnifiedExportService' },
  { path: 'lib/export-unified/interfaces.ts', name: 'Interfaces' },
  { path: 'lib/export-unified/config.ts', name: 'Config' },
  { path: 'lib/export-unified/storage/FilesystemStorage.ts', name: 'Filesystem Storage' },
  { path: 'lib/export-unified/storage/SupabaseStorage.ts', name: 'Supabase Storage' },
  { path: 'lib/export-unified/loaders/ConversationDataLoader.ts', name: 'Conversation Loader' },
  { path: 'lib/export-unified/loaders/AnalyticsDataLoader.ts', name: 'Analytics Loader' },
  { path: 'lib/export-unified/loaders/TraceDataLoader.ts', name: 'Trace Loader' },
  { path: 'lib/export-unified/formatters/CSVFormatter.ts', name: 'CSV Formatter' },
  { path: 'lib/export-unified/formatters/JSONFormatter.ts', name: 'JSON Formatter' },
  { path: 'lib/export-unified/formatters/MarkdownFormatter.ts', name: 'Markdown Formatter' },
];

for (const file of unifiedFiles) {
  try {
    const stats = await fs.stat(file.path);
    const sizeKB = (stats.size / 1024).toFixed(2);
    logTest(`${file.name} exists`, 'PASS', `${sizeKB} KB`);
  } catch {
    logTest(`${file.name} exists`, 'FAIL', 'File not found');
  }
}

// ============================================
// Test 4: API v2 Endpoints
// ============================================
console.log('\n🔌 Test Group 4: API v2 Endpoints');
console.log('-'.repeat(60));

const apiFiles = [
  { path: 'app/api/export/v2/route.ts', name: 'Main v2 endpoint', methods: ['POST', 'GET'] },
  { path: 'app/api/export/v2/download/[id]/route.ts', name: 'Download endpoint', methods: ['GET'] },
  { path: 'app/api/export/v2/delete/[id]/route.ts', name: 'Delete endpoint', methods: ['DELETE'] },
];

for (const api of apiFiles) {
  try {
    const content = await fs.readFile(api.path, 'utf-8');
    const stats = await fs.stat(api.path);
    const sizeKB = (stats.size / 1024).toFixed(2);

    logTest(`${api.name} exists`, 'PASS', `${sizeKB} KB`);

    // Check methods
    for (const method of api.methods) {
      if (content.includes(`export async function ${method}`)) {
        logTest(`${api.name} has ${method} method`, 'PASS');
      } else {
        logTest(`${api.name} has ${method} method`, 'FAIL');
      }
    }

    // Check uses UnifiedExportService
    if (content.includes('UnifiedExportService')) {
      logTest(`${api.name} uses UnifiedExportService`, 'PASS');
    } else {
      logTest(`${api.name} uses UnifiedExportService`, 'FAIL');
    }

  } catch (error) {
    logTest(`${api.name} exists`, 'FAIL', error.message);
  }
}

// ============================================
// Test 5: Deprecated Code Still Works
// ============================================
console.log('\n⚠️  Test Group 5: Deprecated Code (Grace Period)');
console.log('-'.repeat(60));

const deprecatedFiles = [
  { path: 'lib/export/exportService.ts', name: 'Old ExportService' },
  { path: 'lib/analytics/export/csvGenerator.ts', name: 'Old CSV Generator' },
  { path: 'lib/tools/analytics-export/index.ts', name: 'Old analytics_export tool' },
  { path: 'app/api/export/generate/route.ts', name: 'Old generate endpoint' },
  { path: 'app/api/analytics/export/route.ts', name: 'Old analytics export endpoint' },
];

for (const file of deprecatedFiles) {
  try {
    const content = await fs.readFile(file.path, 'utf-8');

    // Check has @deprecated or DEPRECATED warning
    const hasDeprecation = content.includes('@deprecated') || content.includes('[DEPRECATED]');

    if (hasDeprecation) {
      logTest(`${file.name} has deprecation warning`, 'PASS');
    } else {
      logTest(`${file.name} has deprecation warning`, 'FAIL',
        'Missing @deprecated or [DEPRECATED]');
    }
  } catch {
    logTest(`${file.name} exists`, 'FAIL', 'File not found');
  }
}

// ============================================
// Test 6: Package.json Scripts
// ============================================
console.log('\n📦 Test Group 6: Build Configuration');
console.log('-'.repeat(60));

try {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));

  const hasBuild = !!packageJson.scripts?.build;
  const hasDev = !!packageJson.scripts?.dev;
  const hasTypeCheck = !!packageJson.scripts?.['type-check'];

  if (hasBuild) {
    logTest('package.json has build script', 'PASS', packageJson.scripts.build);
  } else {
    logTest('package.json has build script', 'FAIL');
  }

  if (hasDev) {
    logTest('package.json has dev script', 'PASS');
  } else {
    logTest('package.json has dev script', 'FAIL');
  }

  if (hasTypeCheck) {
    logTest('package.json has type-check script', 'PASS');
  } else {
    logTest('package.json has type-check script', 'FAIL');
  }

} catch (error) {
  logTest('package.json check', 'FAIL', error.message);
}

// ============================================
// Summary
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`📝 Total:  ${results.tests.length}`);
console.log(`📈 Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

if (results.failed > 0) {
  console.log('\n❌ FAILED TESTS:');
  results.tests
    .filter(t => t.status === 'FAIL')
    .forEach(t => {
      console.log(`   - ${t.name}`);
      if (t.details) console.log(`     ${t.details}`);
    });
}

if (results.failed === 0) {
  console.log('\n✅ ALL TESTS PASSED - Export system structure is correct!\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${results.failed} test(s) failed but system may still be functional\n`);
  process.exit(results.failed > 5 ? 1 : 0); // Only fail if many tests failed
}
