// Test script to verify mathjs statistical functions
// This validates that existing evaluate() method can handle stats

import {
  evaluate,
  std,
  variance,
  mean,
  median,
  mode,
  sum
} from 'mathjs';

console.log('=== Testing MathJS Statistical Functions ===\n');

const testData = [1, 2, 3, 4, 5];
console.log('Test Data:', testData);

try {
  // Test each statistical function
  console.log('\n1. Testing std() - Standard Deviation:');
  const stdResult = std(testData);
  console.log('   Result:', stdResult);
  console.log('   Via evaluate:', evaluate('std([1, 2, 3, 4, 5])'));

  console.log('\n2. Testing variance() - Variance:');
  const varResult = variance(testData);
  console.log('   Result:', varResult);
  console.log('   Via evaluate:', evaluate('variance([1, 2, 3, 4, 5])'));

  console.log('\n3. Testing mean() - Mean:');
  const meanResult = mean(testData);
  console.log('   Result:', meanResult);
  console.log('   Via evaluate:', evaluate('mean([1, 2, 3, 4, 5])'));

  console.log('\n4. Testing median() - Median:');
  const medianResult = median(testData);
  console.log('   Result:', medianResult);
  console.log('   Via evaluate:', evaluate('median([1, 2, 3, 4, 5])'));

  console.log('\n5. Testing mode() - Mode:');
  const modeTestData = [1, 2, 2, 3, 3, 3, 4];
  const modeResult = mode(modeTestData);
  console.log('   Result:', modeResult);
  console.log('   Via evaluate:', evaluate('mode([1, 2, 2, 3, 3, 3, 4])'));

  console.log('\n6. Testing sum() - Sum:');
  const sumResult = sum(testData);
  console.log('   Result:', sumResult);
  console.log('   Via evaluate:', evaluate('sum([1, 2, 3, 4, 5])'));

  console.log('\n=== All Statistical Functions Work! ===');
  console.log('Conclusion: The existing evaluate() method can handle all statistical functions.');
  
} catch (error) {
  console.error('\nERROR:', error.message);
  process.exit(1);
}
