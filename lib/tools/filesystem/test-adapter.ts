// Test Filesystem Adapters
// Run with: npx ts-node lib/tools/filesystem/test-adapter.ts

import {  createFilesystemAdapter
} from './adapters';

async function testLocalMode() {
  console.log('\n=== Testing Local Mode ===\n');

  const adapter = createFilesystemAdapter({ mode: 'local' });

  try {
    console.log('1. Testing listDirectory...');
    const listResult = await adapter.listDirectory('/home/juan-canfield/Desktop/AI_Models', {
      maxItems: 5
    });
    console.log(`Found ${listResult.itemCount} items`);
    console.log('First item:', listResult.items[0]);
    console.log('SUCCESS\n');
  } catch (error: unknown) {
    console.error('FAILED:', error instanceof Error ? error.message : 'Unknown error', '\n');
  }

  try {
    console.log('2. Testing getFileInfo...');
    const infoResult = await adapter.getFileInfo('/home/juan-canfield/Desktop/AI_Models');
    console.log(`Path: ${infoResult.path}`);
    console.log(`Type: ${infoResult.type}`);
    console.log('SUCCESS\n');
  } catch (error: unknown) {
    console.error('FAILED:', error instanceof Error ? error.message : 'Unknown error', '\n');
  }
}

async function testRemoteMode() {
  console.log('\n=== Testing Remote Mode ===\n');

  const adapter = createFilesystemAdapter({
    mode: 'remote',
    remoteConfig: {
      baseUrl: 'http://localhost:8000',
      timeout: 10000
    }
  });

  try {
    console.log('1. Testing listDirectory...');
    const listResult = await adapter.listDirectory('/home/juan-canfield/Desktop/AI_Models', {
      maxItems: 5
    });
    console.log(`Found ${listResult.itemCount} items`);
    console.log('First item:', listResult.items[0]);
    console.log('SUCCESS\n');
  } catch (error: unknown) {
    console.error('FAILED:', error instanceof Error ? error.message : 'Unknown error', '\n');
  }

  try {
    console.log('2. Testing getFileInfo...');
    const infoResult = await adapter.getFileInfo('/home/juan-canfield/Desktop/AI_Models');
    console.log(`Path: ${infoResult.path}`);
    console.log(`Type: ${infoResult.type}`);
    console.log('SUCCESS\n');
  } catch (error: unknown) {
    console.error('FAILED:', error instanceof Error ? error.message : 'Unknown error', '\n');
  }

  try {
    console.log('3. Testing readFile (small file)...');
    const readResult = await adapter.readFile(
      '/home/juan-canfield/Desktop/AI_Models/README_MODEL_MANAGER.md',
      { encoding: 'utf8', maxSize: 100000 }
    );
    console.log(`Read ${readResult.size} bytes`);
    console.log(`Content preview: ${readResult.content.substring(0, 100)}...`);
    console.log('SUCCESS\n');
  } catch (error: unknown) {
    console.error('FAILED:', error instanceof Error ? error.message : 'Unknown error', '\n');
  }
}

async function main() {
  console.log('Filesystem Adapter Test Suite');
  console.log('==============================');

  await testLocalMode();
  await testRemoteMode();

  console.log('\n=== Test Suite Complete ===\n');
}

main().catch(console.error);
