// Test Phase 2 Step 1: Vector/Embedding Functions
// Validates dot product, norm, and cosine similarity

import { CalculatorService } from './calculator.service';

console.log('=== PHASE 2 STEP 1: VECTOR FUNCTIONS TEST ===\n');

const calculator = new CalculatorService();
let passCount = 0;
let failCount = 0;

function test(name, testFn) {
  try {
    testFn();
    console.log(`PASS: ${name}\n`);
    passCount++;
    return true;
  } catch (error) {
    console.log(`FAIL: ${name}`);
    console.log(`  Error: ${error.message}\n`);
    failCount++;
    return false;
  }
}

// Test 1: Dot Product
test('Dot Product - Basic', () => {
  const result = calculator.dotProduct([1, 2, 3], [4, 5, 6]);
  console.log('  Input: [1, 2, 3] · [4, 5, 6]');
  console.log('  Result:', result);
  console.log('  Expected: 32');
  if (result !== 32) throw new Error(`Expected 32, got ${result}`);
});

test('Dot Product - Zero Vector', () => {
  const result = calculator.dotProduct([1, 2, 3], [0, 0, 0]);
  console.log('  Input: [1, 2, 3] · [0, 0, 0]');
  console.log('  Result:', result);
  console.log('  Expected: 0');
  if (result !== 0) throw new Error(`Expected 0, got ${result}`);
});

// Test 2: Vector Norm
test('Vector Norm - L2 (Euclidean)', () => {
  const result = calculator.vectorNorm([3, 4], 2);
  console.log('  Input: norm([3, 4], L2)');
  console.log('  Result:', result);
  console.log('  Expected: 5');
  if (result !== 5) throw new Error(`Expected 5, got ${result}`);
});

test('Vector Norm - L1 (Manhattan)', () => {
  const result = calculator.vectorNorm([3, 4], 1);
  console.log('  Input: norm([3, 4], L1)');
  console.log('  Result:', result);
  console.log('  Expected: 7');
  if (result !== 7) throw new Error(`Expected 7, got ${result}`);
});

test('Vector Norm - L-infinity (Max)', () => {
  const result = calculator.vectorNorm([3, 4, -5], 'inf');
  console.log('  Input: norm([3, 4, -5], Linf)');
  console.log('  Result:', result);
  console.log('  Expected: 5');
  if (result !== 5) throw new Error(`Expected 5, got ${result}`);
});

// Test 3: Cosine Similarity
test('Cosine Similarity - Identical Vectors', () => {
  const result = calculator.cosineSimilarity([1, 2, 3], [1, 2, 3]);
  console.log('  Input: cosSim([1, 2, 3], [1, 2, 3])');
  console.log('  Result:', result);
  console.log('  Expected: 1.0');
  if (Math.abs(result - 1.0) > 0.0001) throw new Error(`Expected 1.0, got ${result}`);
});

test('Cosine Similarity - Orthogonal Vectors', () => {
  const result = calculator.cosineSimilarity([1, 0, 0], [0, 1, 0]);
  console.log('  Input: cosSim([1, 0, 0], [0, 1, 0])');
  console.log('  Result:', result);
  console.log('  Expected: 0.0');
  if (Math.abs(result) > 0.0001) throw new Error(`Expected 0.0, got ${result}`);
});

test('Cosine Similarity - Similar Vectors', () => {
  const result = calculator.cosineSimilarity([1, 2, 3], [2, 4, 6]);
  console.log('  Input: cosSim([1, 2, 3], [2, 4, 6])');
  console.log('  Result:', result);
  console.log('  Expected: 1.0 (scaled vectors)');
  if (Math.abs(result - 1.0) > 0.0001) throw new Error(`Expected 1.0, got ${result}`);
});

// Test 4: Error Handling
test('Dot Product - Length Mismatch Error', () => {
  try {
    calculator.dotProduct([1, 2], [1, 2, 3]);
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw error:', error.message);
    if (!error.message.includes('same length')) throw error;
  }
});

test('Cosine Similarity - Length Mismatch Error', () => {
  try {
    calculator.cosineSimilarity([1, 2], [1, 2, 3]);
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw error:', error.message);
    if (!error.message.includes('same length')) throw error;
  }
});

console.log('=== TEST SUMMARY ===');
console.log(`Total Tests: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\nALL TESTS PASSED - Phase 2 Step 1 is complete!');
  process.exit(0);
} else {
  console.log(`\n${failCount} TESTS FAILED`);
  process.exit(1);
}
