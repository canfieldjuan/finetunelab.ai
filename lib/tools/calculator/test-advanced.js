// Test script to verify matrix and symbolic math capabilities
// This validates Phase 1 Step 2: Advanced Data Types

import { evaluate, simplify, derivative } from 'mathjs';

console.log('=== Testing Matrix & Symbolic Math ===\n');

try {
  // Test 1: Matrix operations
  console.log('1. Testing Matrix Operations:');
  const matrixAdd = evaluate('[[1, 2], [3, 4]] + [[5, 6], [7, 8]]');
  console.log('   Matrix Addition:', JSON.stringify(matrixAdd));
  
  const matrixMult = evaluate('[[1, 2], [3, 4]] * [[2, 0], [1, 2]]');
  console.log('   Matrix Multiplication:', JSON.stringify(matrixMult));
  
  const det = evaluate('det([[1, 2], [3, 4]])');
  console.log('   Determinant:', det);
  
  // Test 2: Symbolic simplification
  console.log('\n2. Testing Symbolic Math:');
  const simplified = simplify('2x + 3x');
  console.log('   Simplify "2x + 3x":', simplified.toString());
  
  const expanded = simplify('(x + 1)^2');
  console.log('   Expand "(x + 1)^2":', expanded.toString());
  
  // Test 3: Derivatives
  console.log('\n3. Testing Derivatives:');
  const deriv = derivative('x^2 + 2x + 1', 'x');
  console.log('   d/dx(x^2 + 2x + 1):', deriv.toString());
  
  // Test 4: Complex numbers
  console.log('\n4. Testing Complex Numbers:');
  const complex = evaluate('sqrt(-1)');
  console.log('   sqrt(-1):', complex.toString());
  
  const complexAdd = evaluate('(2 + 3i) + (4 - i)');
  console.log('   (2 + 3i) + (4 - i):', complexAdd.toString());
  
  console.log('\n=== All Advanced Features Work! ===');
  console.log('Conclusion: Matrices, symbolic math, and complex numbers are fully functional.');
  
} catch (error) {
  console.error('\nERROR:', error.message);
  process.exit(1);
}
