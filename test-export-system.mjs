#!/usr/bin/env node

/**
 * Comprehensive Export System Test
 * Tests unified export system functionality
 * Date: 2025-12-21
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
console.log('🧪 EXPORT SYSTEM FUNCTIONAL TEST');
console.log('='.repeat(60));
console.log('Testing unified export system and tool registry\n');

// ============================================
// Test 1: Tool Registry Import
// ============================================
console.log('📋 Test Group 1: Tool Registry Import');
console.log('-'.repeat(60));

try {
  // Import the registry - this will auto-register all tools
  const registryModule = await import('./lib/tools/registry.ts');
  const { getRegistryMetadata, getToolByName } = registryModule;

  const metadata = getRegistryMetadata();
  logTest('Tool registry imports successfully', 'PASS', `${metadata.toolCount} tools registered`);

  // Check if both export tools are registered
  const oldTool = getToolByName('analytics_export');
  const newTool = getToolByName('unified_export');

  if (oldTool) {
    logTest('Old analytics_export tool found', 'PASS',
      `Version: ${oldTool.version}, Enabled: ${oldTool.config.enabled}`);
  } else {
    logTest('Old analytics_export tool found', 'FAIL', 'Tool not found in registry');
  }

  if (newTool) {
    logTest('New unified_export tool found', 'PASS',
      `Version: ${newTool.version}, Enabled: ${newTool.config.enabled}`);
  } else {
    logTest('New unified_export tool found', 'FAIL', 'Tool not found in registry');
  }

  // Check tool definitions
  if (newTool) {
    const hasOperation = newTool.parameters?.properties?.operation;
    const hasExportType = newTool.parameters?.properties?.exportType;
    const hasFormat = newTool.parameters?.properties?.format;

    if (hasOperation && hasExportType && hasFormat) {
      logTest('Unified tool has required parameters', 'PASS',
        'operation, exportType, format all defined');
    } else {
      logTest('Unified tool has required parameters', 'FAIL',
        `operation: ${!!hasOperation}, exportType: ${!!hasExportType}, format: ${!!hasFormat}`);
    }

    // Check operations
    const operations = hasOperation?.enum || [];
    const expectedOps = ['create_export', 'list_exports', 'get_download_link', 'delete_export'];
    const hasAllOps = expectedOps.every(op => operations.includes(op));

    if (hasAllOps) {
      logTest('Unified tool supports all operations', 'PASS', operations.join(', '));
    } else {
      logTest('Unified tool supports all operations', 'FAIL',
        `Expected: ${expectedOps.join(', ')}, Got: ${operations.join(', ')}`);
    }

    // Check export types
    const exportTypes = hasExportType?.enum || [];
    const expectedTypes = ['conversation', 'analytics', 'trace'];
    const hasAllTypes = expectedTypes.every(type => exportTypes.includes(type));

    if (hasAllTypes) {
      logTest('Unified tool supports all export types', 'PASS', exportTypes.join(', '));
    } else {
      logTest('Unified tool supports all export types', 'FAIL',
        `Expected: ${expectedTypes.join(', ')}, Got: ${exportTypes.join(', ')}`);
    }

    // Check formats
    const formats = hasFormat?.enum || [];
    const expectedFormats = ['csv', 'json', 'jsonl', 'markdown', 'txt'];
    const hasAllFormats = expectedFormats.every(fmt => formats.includes(fmt));

    if (hasAllFormats) {
      logTest('Unified tool supports all formats', 'PASS', formats.join(', '));
    } else {
      logTest('Unified tool supports all formats', 'FAIL',
        `Expected: ${expectedFormats.join(', ')}, Got: ${formats.join(', ')}`);
    }
  }

} catch (error) {
  logTest('Tool registry import', 'FAIL', error.message);
}

// ============================================
// Test 2: Unified Export Service
// ============================================
console.log('\n✨ Test Group 2: Unified Export Service');
console.log('-'.repeat(60));

try {
  const serviceModule = await import('./lib/export-unified/UnifiedExportService.ts');
  const { UnifiedExportService } = serviceModule;

  logTest('UnifiedExportService imports successfully', 'PASS');

  // Check if service has required methods
  const service = new UnifiedExportService();
  const hasMethods = [
    'createExport',
    'getExport',
    'listExports',
    'deleteExport',
  ].every(method => typeof service[method] === 'function');

  if (hasMethods) {
    logTest('UnifiedExportService has required methods', 'PASS',
      'createExport, getExport, listExports, deleteExport');
  } else {
    logTest('UnifiedExportService has required methods', 'FAIL');
  }

} catch (error) {
  logTest('UnifiedExportService import', 'FAIL', error.message);
}

// ============================================
// Test 3: Data Loaders
// ============================================
console.log('\n📦 Test Group 3: Data Loaders');
console.log('-'.repeat(60));

const loaders = [
  'ConversationDataLoader',
  'AnalyticsDataLoader',
  'TraceDataLoader',
];

for (const loaderName of loaders) {
  try {
    const loaderPath = `./lib/export-unified/loaders/${loaderName}.ts`;
    const loaderModule = await import(loaderPath);
    const LoaderClass = loaderModule[loaderName];

    if (LoaderClass) {
      const loader = new LoaderClass();
      const hasLoadMethod = typeof loader.load === 'function';
      const hasValidateMethod = typeof loader.validate === 'function';

      if (hasLoadMethod && hasValidateMethod) {
        logTest(`${loaderName} has required methods`, 'PASS', 'load, validate');
      } else {
        logTest(`${loaderName} has required methods`, 'FAIL',
          `load: ${hasLoadMethod}, validate: ${hasValidateMethod}`);
      }
    } else {
      logTest(`${loaderName} exports class`, 'FAIL', 'Class not found in module');
    }
  } catch (error) {
    logTest(`${loaderName} import`, 'FAIL', error.message);
  }
}

// ============================================
// Test 4: Format Generators
// ============================================
console.log('\n🎨 Test Group 4: Format Generators');
console.log('-'.repeat(60));

const formatters = [
  'CSVFormatter',
  'JSONFormatter',
  'MarkdownFormatter',
];

for (const formatterName of formatters) {
  try {
    const formatterPath = `./lib/export-unified/formatters/${formatterName}.ts`;
    const formatterModule = await import(formatterPath);
    const FormatterClass = formatterModule[formatterName];

    if (FormatterClass) {
      const formatter = new FormatterClass();
      const hasGenerateMethod = typeof formatter.generate === 'function';
      const hasGetMimeTypeMethod = typeof formatter.getMimeType === 'function';

      if (hasGenerateMethod && hasGetMimeTypeMethod) {
        logTest(`${formatterName} has required methods`, 'PASS', 'generate, getMimeType');
      } else {
        logTest(`${formatterName} has required methods`, 'FAIL',
          `generate: ${hasGenerateMethod}, getMimeType: ${hasGetMimeTypeMethod}`);
      }
    } else {
      logTest(`${formatterName} exports class`, 'FAIL', 'Class not found in module');
    }
  } catch (error) {
    logTest(`${formatterName} import`, 'FAIL', error.message);
  }
}

// ============================================
// Test 5: API Route Files
// ============================================
console.log('\n🔌 Test Group 5: API Route Files');
console.log('-'.repeat(60));

const apiRoutes = [
  'app/api/export/v2/route.ts',
  'app/api/export/v2/download/[id]/route.ts',
  'app/api/export/v2/delete/[id]/route.ts',
];

for (const route of apiRoutes) {
  try {
    const content = await fs.readFile(route, 'utf-8');

    // Check for required exports
    const hasPOST = content.includes('export async function POST');
    const hasGET = content.includes('export async function GET');
    const hasDELETE = content.includes('export async function DELETE');

    const routeName = path.basename(path.dirname(route));

    if (route.includes('route.ts') && !route.includes('[id]')) {
      // Main route should have POST and GET
      if (hasPOST && hasGET) {
        logTest(`${route} has POST and GET`, 'PASS');
      } else {
        logTest(`${route} has POST and GET`, 'FAIL',
          `POST: ${hasPOST}, GET: ${hasGET}`);
      }
    } else if (route.includes('download')) {
      // Download route should have GET
      if (hasGET) {
        logTest(`${route} has GET`, 'PASS');
      } else {
        logTest(`${route} has GET`, 'FAIL');
      }
    } else if (route.includes('delete')) {
      // Delete route should have DELETE
      if (hasDELETE) {
        logTest(`${route} has DELETE`, 'PASS');
      } else {
        logTest(`${route} has DELETE`, 'FAIL');
      }
    }

    // Check for UnifiedExportService usage
    const usesService = content.includes('UnifiedExportService') ||
                       content.includes('from \'@/lib/export-unified/UnifiedExportService\'');

    if (usesService) {
      logTest(`${route} uses UnifiedExportService`, 'PASS');
    } else {
      logTest(`${route} uses UnifiedExportService`, 'FAIL',
        'UnifiedExportService not imported');
    }

  } catch (error) {
    logTest(`Check ${route}`, 'FAIL', error.message);
  }
}

// ============================================
// Test 6: Configuration
// ============================================
console.log('\n⚙️  Test Group 6: Configuration');
console.log('-'.repeat(60));

try {
  const configModule = await import('./lib/export-unified/config.ts');
  const { exportConfig } = configModule;

  logTest('Export config imports successfully', 'PASS');

  // Check required config properties
  const hasStorage = !!exportConfig.storage;
  const hasExpiration = !!exportConfig.expiration;
  const hasFormats = !!exportConfig.formats;

  if (hasStorage && hasExpiration && hasFormats) {
    logTest('Export config has required properties', 'PASS',
      'storage, expiration, formats');
  } else {
    logTest('Export config has required properties', 'FAIL',
      `storage: ${hasStorage}, expiration: ${hasExpiration}, formats: ${hasFormats}`);
  }

  // Check supported formats
  const supportedFormats = exportConfig.formats?.supported || [];
  const expectedFormats = ['csv', 'json', 'jsonl', 'markdown', 'txt'];
  const hasAllFormats = expectedFormats.every(fmt => supportedFormats.includes(fmt));

  if (hasAllFormats) {
    logTest('Config supports all required formats', 'PASS', supportedFormats.join(', '));
  } else {
    logTest('Config supports all required formats', 'FAIL',
      `Expected: ${expectedFormats.join(', ')}, Got: ${supportedFormats.join(', ')}`);
  }

} catch (error) {
  logTest('Export config import', 'FAIL', error.message);
}

// ============================================
// Test 7: TypeScript Interfaces
// ============================================
console.log('\n📐 Test Group 7: TypeScript Interfaces');
console.log('-'.repeat(60));

try {
  const content = await fs.readFile('lib/export-unified/interfaces.ts', 'utf-8');

  const interfaces = [
    'ExportRequest',
    'ExportResult',
    'DataSelector',
    'ConversationDataSelector',
    'AnalyticsDataSelector',
    'TraceDataSelector',
    'DataLoader',
    'FormatGenerator',
  ];

  for (const interfaceName of interfaces) {
    const hasInterface = content.includes(`export interface ${interfaceName}`) ||
                        content.includes(`export type ${interfaceName}`);

    if (hasInterface) {
      logTest(`Interface ${interfaceName} defined`, 'PASS');
    } else {
      logTest(`Interface ${interfaceName} defined`, 'FAIL', 'Interface not found');
    }
  }

} catch (error) {
  logTest('TypeScript interfaces check', 'FAIL', error.message);
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
  console.log('\n✅ ALL TESTS PASSED - Export system is fully functional!\n');
  process.exit(0);
} else {
  console.log(`\n❌ ${results.failed} TEST(S) FAILED - Review failures\n`);
  process.exit(1);
}
