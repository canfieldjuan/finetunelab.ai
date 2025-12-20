import { config } from 'dotenv';
import { resolve } from 'path';

// Load env BEFORE importing anything
config({ path: resolve(process.cwd(), '.env.local') });

import { generateSessionTag } from './lib/session-tagging/generator';

async function test() {
  const userId = 'test-user-id-123';

  console.log('🧪 Testing session tag generation...\n');

  // Test 1: Model name (not UUID)
  console.log('Test 1: Model name (claude-sonnet-4-5-20250929)');
  const tag1 = await generateSessionTag(userId, 'claude-sonnet-4-5-20250929');
  console.log('Result:', tag1);
  console.log('');

  // Test 2: Model UUID
  console.log('Test 2: Model UUID (dc0bf3de-7a33-448f-b4c5-041c5fdaa034)');
  const tag2 = await generateSessionTag(userId, 'dc0bf3de-7a33-448f-b4c5-041c5fdaa034');
  console.log('Result:', tag2);
  console.log('');

  // Test 3: Non-existent model (should use fallback)
  console.log('Test 3: Non-existent model (fake-model-123)');
  const tag3 = await generateSessionTag(userId, 'fake-model-123');
  console.log('Result:', tag3);
  console.log('');

  // Test 4: Null/undefined
  console.log('Test 4: Null model');
  const tag4 = await generateSessionTag(userId, null);
  console.log('Result:', tag4);
  console.log('');

  console.log('✅ Tests complete!');
}

test().catch(console.error);
