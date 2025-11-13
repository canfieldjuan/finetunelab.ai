// Filesystem Tool - Test Suite
// Phase 2: Core Operations Testing
// Date: October 13, 2025

import { defaultFilesystemTool } from './index';
import { filesystemTool } from './filesystem.tool';

/**
 * Basic test functions for filesystem tool validation
 */

async function testListDirectory() {
  console.log('\n=== Testing list_directory ===');
  
  try {
    // Test listing current directory
    const result = await defaultFilesystemTool.listDirectory('.');
    console.log('✅ List directory test passed');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testFileInfo() {
  console.log('\n=== Testing file_info ===');
  
  try {
    // Test getting info for current directory
    const result = await defaultFilesystemTool.getFileInfo('.');
    console.log('✅ File info test passed');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testToolDefinition() {
  console.log('\n=== Testing tool definition ===');
  
  try {
    // Test the tool definition execute method
    const result = await filesystemTool.execute({
      operation: 'file_info',
      path: '.'
    });
    
    console.log('✅ Tool definition test passed');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testSecurityValidation() {
  console.log('\n=== Testing security validation ===');
  
  try {
    // Test path traversal prevention - should throw error
    const result = await defaultFilesystemTool.listDirectory('../../../etc');
    console.error('❌ Security test failed - dangerous path allowed!');
    console.error('Result:', result);
  } catch (error) {
    console.log('✅ Security test passed - exception thrown for dangerous path');
    if (error instanceof Error) {
      console.log('Security message:', error.message);
    }
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Filesystem Tool Test Suite');
  console.log('============================');
  
  await testListDirectory();
  await testFileInfo();
  await testToolDefinition();
  await testSecurityValidation();
  
  console.log('\n✨ Test suite completed!');
}

// Export for use in other modules
export { runTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}
