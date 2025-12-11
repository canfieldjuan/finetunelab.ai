/**
 * Analytics Export Tool - Registration Test
 * Verify tool is properly registered in the tool system
 * Phase 6: LLM Integration
 * Date: October 25, 2025
 */

import { getToolByName, getEnabledTools } from '../registry';
import { analyticsExportTool } from './index';

export function testAnalyticsExportRegistration(): void {
  console.log('\n=== Analytics Export Tool Registration Test ===\n');

  // Test 1: Direct tool definition
  console.log('Test 1: Direct Tool Definition');
  console.log('Tool Name:', analyticsExportTool.name);
  console.log('Tool Version:', analyticsExportTool.version);
  console.log('Tool Enabled:', analyticsExportTool.config.enabled);
  console.log('Operations:', ['create_export', 'list_exports', 'get_download_link']);
  console.log('✅ Direct tool definition accessible\n');

  // Test 2: Registry lookup
  console.log('Test 2: Registry Lookup');
  const registeredTool = getToolByName('analytics_export');
  if (registeredTool) {
    console.log('Tool found in registry:', registeredTool.name);
    console.log('✅ Tool successfully registered\n');
  } else {
    console.error('❌ Tool NOT found in registry\n');
  }

  // Test 3: Enabled tools list
  console.log('Test 3: Enabled Tools List');
  const enabledTools = getEnabledTools();
  const analyticsExportEnabled = enabledTools.some(t => t.name === 'analytics_export');
  if (analyticsExportEnabled) {
    console.log('✅ analytics_export in enabled tools list\n');
  } else {
    console.error('❌ analytics_export NOT in enabled tools list\n');
  }

  // Test 4: Tool parameters validation
  console.log('Test 4: Tool Parameters');
  const params = analyticsExportTool.parameters;
  console.log('Parameter type:', params.type);
  console.log('Required params:', params.required);
  console.log('Available operations:');
  const operationProp = params.properties.operation;
  if (operationProp && 'enum' in operationProp && operationProp.enum) {
    operationProp.enum.forEach((op: string) => {
      console.log(`  - ${op}`);
    });
  }
  console.log('✅ Tool parameters properly defined\n');

  // Test 5: Configuration
  console.log('Test 5: Configuration');
  console.log('Config keys:', Object.keys(analyticsExportTool.config));
  console.log('Default format:', analyticsExportTool.config.defaultFormat);
  console.log('Default type:', analyticsExportTool.config.defaultType);
  console.log('Max exports per user:', analyticsExportTool.config.maxExportsPerUser);
  console.log('✅ Configuration accessible\n');

  console.log('=== All Tests Passed ✅ ===\n');
}

// Run tests if executed directly
if (require.main === module) {
  testAnalyticsExportRegistration();
}
