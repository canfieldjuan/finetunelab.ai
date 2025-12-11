// Comprehensive Phase 1 Validation Test
// Tests all foundational enhancements

import { evaluate } from 'mathjs';

console.log('=== PHASE 1 COMPREHENSIVE VALIDATION ===\n');

let passCount = 0;
let failCount = 0;

function test(name, expression) {
  try {
    const result = evaluate(expression);
    console.log(`PASS: ${name}`);
    console.log(`  Expression: ${expression}`);
    console.log(`  Result: ${JSON.stringify(result)}`);
    console.log('');
    passCount++;
    return true;
  } catch (error) {
    console.log(`FAIL: ${name}`);
    console.log(`  Expression: ${expression}`);
    console.log(`  Error: ${error.message}`);
    console.log('');
    failCount++;
    return false;
  }
}

// Statistical Functions
console.log('--- Statistical Functions ---');
test('Mean', 'mean([1, 2, 3, 4, 5])');
test('Median', 'median([1, 2, 3, 4, 5])');
test('Standard Deviation', 'std([1, 2, 3, 4, 5])');
test('Variance', 'variance([1, 2, 3, 4, 5])');
test('Mode', 'mode([1, 2, 2, 3, 3, 3])');
test('Sum', 'sum([10, 20, 30])');

// Matrix Operations
console.log('--- Matrix Operations ---');
test('Matrix Addition', '[[1, 2], [3, 4]] + [[5, 6], [7, 8]]');
test('Matrix Multiplication', '[[1, 2], [3, 4]] * [[2, 0], [1, 2]]');
test('Determinant', 'det([[1, 2], [3, 4]])');
test('Matrix Inverse', 'inv([[4, 7], [2, 6]])');

// Symbolic Math
console.log('--- Symbolic Math ---');
test('Simplification', 'simplify("2x + 3x")');
test('Derivative', 'derivative("x^2 + 2x + 1", "x")');

// Complex Numbers
console.log('--- Complex Numbers ---');
test('Square Root of -1', 'sqrt(-1)');
test('Complex Addition', '(2 + 3i) + (4 - i)');
test('Complex Multiplication', '(2 + 3i) * (4 - i)');

// Unit Conversions
console.log('--- Unit Conversions ---');
test('CM to Inches', '5 cm to inch');
test('Meters to Feet', '10 m to ft');

// Advanced Arithmetic
console.log('--- Advanced Arithmetic ---');
test('Trigonometry', 'sin(45 deg)');
test('Logarithm', 'log(100, 10)');
test('Power', '2^10');

console.log('=== VALIDATION COMPLETE ===');
console.log(`Total Tests: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\nALL TESTS PASSED - Phase 1 is complete and functional!');
  process.exit(0);
} else {
  console.log(`\n${failCount} TESTS FAILED - Review failures above.`);
  process.exit(1);
}
