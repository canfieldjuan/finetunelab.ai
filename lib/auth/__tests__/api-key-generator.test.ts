// Test file for API Key Generator
// Run with: npx tsx lib/auth/__tests__/api-key-generator.test.ts

import {
  generateApiKey,
  validateApiKeyFormat,
  verifyApiKeyHash,
  logApiKeyDebug,
  type GeneratedApiKey
} from '../api-key-generator';

console.log('========================================');
console.log('API Key Generator Tests');
console.log('========================================\n');

// Test 1: Generate API Key
console.log('Test 1: Generate API Key');
console.log('----------------------------------------');
const apiKeyResult: GeneratedApiKey = generateApiKey();
console.log('Generated API Key:');
console.log('  Key (full):', apiKeyResult.key);
console.log('  Key Hash:', apiKeyResult.keyHash.substring(0, 50) + '...');
console.log('  Key Prefix:', apiKeyResult.keyPrefix);
console.log('✓ Test 1 passed\n');

// Test 2: Validate API Key Format
console.log('Test 2: Validate API Key Format');
console.log('----------------------------------------');
const validKey = apiKeyResult.key;
const invalidKeys = [
  '',
  'invalid',
  'wak_',
  'wak_short',
  'wrong_prefix123456789012345678901234567890',
  'wak_1234567890123456789012345678901234567890', // too long
];

console.log('Valid key:', validateApiKeyFormat(validKey));
if (!validateApiKeyFormat(validKey)) {
  throw new Error('Valid key failed validation!');
}

invalidKeys.forEach((key, index) => {
  const isValid = validateApiKeyFormat(key);
  console.log(`Invalid key ${index + 1}:`, isValid, `(${key.substring(0, 20)}...)`);
  if (isValid) {
    throw new Error(`Invalid key ${index + 1} passed validation!`);
  }
});
console.log('✓ Test 2 passed\n');

// Test 3: Verify API Key Hash
console.log('Test 3: Verify API Key Hash');
console.log('----------------------------------------');
const testKey = apiKeyResult.key;
const testHash = apiKeyResult.keyHash;

console.log('Verifying correct key against hash...');
const correctVerification = verifyApiKeyHash(testKey, testHash);
console.log('Result:', correctVerification);
if (!correctVerification) {
  throw new Error('Correct key failed verification!');
}

console.log('\nVerifying wrong key against hash...');
const wrongKey = 'wak_wrongkeywrongkeywrongkeywrongkey';
const wrongVerification = verifyApiKeyHash(wrongKey, testHash);
console.log('Result:', wrongVerification);
if (wrongVerification) {
  throw new Error('Wrong key passed verification!');
}
console.log('✓ Test 3 passed\n');

// Test 4: Multiple Key Generation (ensure uniqueness)
console.log('Test 4: Multiple Key Generation');
console.log('----------------------------------------');
const keys: Set<string> = new Set();
const hashes: Set<string> = new Set();
const iterations = 10;

for (let i = 0; i < iterations; i++) {
  const result = generateApiKey();
  keys.add(result.key);
  hashes.add(result.keyHash);
}

console.log('Generated', iterations, 'keys');
console.log('Unique keys:', keys.size);
console.log('Unique hashes:', hashes.size);

if (keys.size !== iterations) {
  throw new Error('Duplicate keys generated!');
}
if (hashes.size !== iterations) {
  throw new Error('Duplicate hashes generated!');
}
console.log('✓ Test 4 passed\n');

// Test 5: Hash Consistency
console.log('Test 5: Hash Consistency');
console.log('----------------------------------------');
const { key: consistentKey, keyHash: hash1 } = generateApiKey();
console.log('First verification:', verifyApiKeyHash(consistentKey, hash1));
console.log('Second verification:', verifyApiKeyHash(consistentKey, hash1));
console.log('Third verification:', verifyApiKeyHash(consistentKey, hash1));

if (!verifyApiKeyHash(consistentKey, hash1)) {
  throw new Error('Hash verification inconsistent!');
}
console.log('✓ Test 5 passed\n');

// Test 6: Debug Logging
console.log('Test 6: Debug Logging');
console.log('----------------------------------------');
logApiKeyDebug(apiKeyResult.key);
logApiKeyDebug('wak_1234567890123456789012345678901234567890');
logApiKeyDebug('');
console.log('✓ Test 6 passed\n');

// Test 7: Key Prefix Extraction
console.log('Test 7: Key Prefix Extraction');
console.log('----------------------------------------');
const { key, keyPrefix } = generateApiKey();
console.log('Full key:', key);
console.log('Prefix:', keyPrefix);
console.log('Expected prefix:', key.substring(0, 12));

if (keyPrefix !== key.substring(0, 12)) {
  throw new Error('Key prefix extraction failed!');
}
console.log('✓ Test 7 passed\n');

console.log('========================================');
console.log('All Tests Passed! ✓');
console.log('========================================');
