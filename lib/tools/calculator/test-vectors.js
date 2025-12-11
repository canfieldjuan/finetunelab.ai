// Direct test of vector functions
// Tests dot product, norm, and cosine similarity

console.log('=== PHASE 2 STEP 1: VECTOR FUNCTIONS TEST ===\n');

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

// Implement vector functions to test
function dotProduct(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
    throw new Error('Both inputs must be arrays');
  }
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have same length');
  }
  return vectorA.reduce((sum, val, idx) => sum + val * vectorB[idx], 0);
}

function vectorNorm(vector, normType = 2) {
  if (!Array.isArray(vector)) {
    throw new Error('Input must be an array');
  }
  
  if (normType === 2) {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  } else if (normType === 1) {
    return vector.reduce((sum, val) => sum + Math.abs(val), 0);
  } else if (normType === 'inf') {
    return Math.max(...vector.map(Math.abs));
  }
  throw new Error('Invalid norm type');
}

function cosineSimilarity(vectorA, vectorB) {
  const dotProd = dotProduct(vectorA, vectorB);
  const normA = vectorNorm(vectorA, 2);
  const normB = vectorNorm(vectorB, 2);
  
  if (normA === 0 || normB === 0) {
    throw new Error('Cannot compute cosine similarity with zero vector');
  }
  
  return dotProd / (normA * normB);
}

// Run Tests
test('Dot Product - Basic', () => {
  const result = dotProduct([1, 2, 3], [4, 5, 6]);
  console.log('  [1, 2, 3] · [4, 5, 6] = ' + result);
  console.log('  Expected: 32');
  if (result !== 32) throw new Error(`Expected 32, got ${result}`);
});

test('Dot Product - Zero', () => {
  const result = dotProduct([1, 2, 3], [0, 0, 0]);
  console.log('  [1, 2, 3] · [0, 0, 0] = ' + result);
  if (result !== 0) throw new Error(`Expected 0, got ${result}`);
});

test('Vector Norm - L2', () => {
  const result = vectorNorm([3, 4], 2);
  console.log('  norm([3, 4], L2) = ' + result);
  if (result !== 5) throw new Error(`Expected 5, got ${result}`);
});

test('Vector Norm - L1', () => {
  const result = vectorNorm([3, 4], 1);
  console.log('  norm([3, 4], L1) = ' + result);
  if (result !== 7) throw new Error(`Expected 7, got ${result}`);
});

test('Vector Norm - Linf', () => {
  const result = vectorNorm([3, 4, -5], 'inf');
  console.log('  norm([3, 4, -5], Linf) = ' + result);
  if (result !== 5) throw new Error(`Expected 5, got ${result}`);
});

test('Cosine Similarity - Identical', () => {
  const result = cosineSimilarity([1, 2, 3], [1, 2, 3]);
  console.log('  cosSim([1, 2, 3], [1, 2, 3]) = ' + result);
  if (Math.abs(result - 1.0) > 0.0001) throw new Error(`Expected 1.0, got ${result}`);
});

test('Cosine Similarity - Orthogonal', () => {
  const result = cosineSimilarity([1, 0, 0], [0, 1, 0]);
  console.log('  cosSim([1, 0, 0], [0, 1, 0]) = ' + result);
  if (Math.abs(result) > 0.0001) throw new Error(`Expected 0.0, got ${result}`);
});

test('Cosine Similarity - Scaled', () => {
  const result = cosineSimilarity([1, 2, 3], [2, 4, 6]);
  console.log('  cosSim([1, 2, 3], [2, 4, 6]) = ' + result);
  if (Math.abs(result - 1.0) > 0.0001) throw new Error(`Expected 1.0, got ${result}`);
});

test('Error: Dot Product Length Mismatch', () => {
  try {
    dotProduct([1, 2], [1, 2, 3]);
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw: ' + error.message);
    if (!error.message.includes('same length')) throw error;
  }
});

console.log('=== TEST SUMMARY ===');
console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\nSUCCESS: All vector functions work correctly!');
  process.exit(0);
} else {
  console.log(`\nFAILED: ${failCount} tests failed`);
  process.exit(1);
}
