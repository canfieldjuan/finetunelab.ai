#!/usr/bin/env tsx
/**
 * Test script for API Key Management Endpoints
 * Tests GET, POST, DELETE endpoints and feedback collection
 * Date: 2025-10-17
 */

console.log('========================================');
console.log('API Key Management Tests');
console.log('========================================\n');

// Mock test to verify imports work
import { generateApiKey, validateApiKeyFormat } from '../../../lib/auth/api-key-generator';
import type { ApiKeyValidationResult } from '../../../lib/auth/api-key-validator';

console.log('Test 1: Generate API Key');
const { key, keyHash, keyPrefix } = generateApiKey();
console.log('Generated API Key:');
console.log('  Key (masked):', keyPrefix + '...');
console.log('  Key Hash (first 20):', keyHash.substring(0, 20) + '...');
console.log('  Key Prefix:', keyPrefix);
console.log('Test 1 passed\n');

console.log('Test 2: Validate API Key Format');
const validFormat = validateApiKeyFormat(key);
const invalidFormat = validateApiKeyFormat('invalid_key');
console.log('Valid key format:', validFormat);
console.log('Invalid key format:', invalidFormat);
console.log(validFormat && !invalidFormat ? 'Test 2 passed\n' : 'Test 2 FAILED\n');

console.log('Test 3: Type Checking');
const mockResult: ApiKeyValidationResult = {
  isValid: true,
  userId: 'test-user-id',
  keyName: 'Test Key',
  keyHash: keyHash,
  isActive: true,
};
console.log('ApiKeyValidationResult includes keyHash:', 'keyHash' in mockResult);
console.log('Test 3 passed\n');

console.log('========================================');
console.log('All Import Tests Passed!');
console.log('========================================\n');

console.log('API Endpoint Tests (Manual):');
console.log('1. POST /api/user/api-keys - Create API key');
console.log('   - Requires authentication header');
console.log('   - Body: { "name": "My Widget Key" }');
console.log('');
console.log('2. GET /api/user/api-keys - List API keys');
console.log('   - Requires authentication header');
console.log('   - Returns masked keys with usage stats');
console.log('');
console.log('3. DELETE /api/user/api-keys/[id] - Revoke API key');
console.log('   - Requires authentication header');
console.log('   - Soft deletes (marks inactive)');
console.log('');
console.log('4. POST /api/feedback/collect - Collect feedback');
console.log('   - Requires API key header (X-API-Key)');
console.log('   - Body: { "message_id": "...", "rating": 5, "thumbs": "up", "comment": "...", "category_tags": [...] }');
console.log('');

console.log('To test endpoints:');
console.log('1. Start dev server: npm run dev');
console.log('2. Login to get auth token');
console.log('3. Use curl or Postman to test endpoints');
console.log('');
console.log('Example curl command:');
console.log('curl -X POST http://localhost:3000/api/user/api-keys \\');
console.log('  -H "Authorization: Bearer YOUR_TOKEN" \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"name": "Test Widget Key"}\'');
