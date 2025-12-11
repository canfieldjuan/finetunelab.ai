import { CalculatorService } from './calculator.service.js';

async function testCalculator() {
  console.log('--- Starting Calculator Service Test ---');
  const calculator = new CalculatorService();
  const userId = 'test-user-id';

  const expressions = [
    // Phase 1: Statistical Functions
    'mean([1, 5, 10, 15])',
    'std([1, 2, 3, 4, 5])',
    'variance([1, 2, 3, 4, 5])',
    'mode([1, 2, 2, 3, 4, 4, 4])',
    'sum([10, 20, 30])',

    // Phase 1: Advanced Data Types (Matrices & Symbolic)
    'det([[1, 2], [3, 4]])',
    'inv([[1, 2], [3, 4]])',
    'simplify("2x + 3x - x")',
    'derivative("x^2", "x")',

    // Existing functionality
    '2 + 2',
    '5 cm to inch',
    'a = 5',
    'a * 10'
  ];

  for (const exp of expressions) {
    try {
      console.log(`\n[Test] Evaluating: "${exp}"`);
      const result = await calculator.evaluate(exp, userId);
      console.log(`[Test] SUCCESS: Result for "${exp}" is`, result);
    } catch (error) {
      console.error(`[Test] FAILED: Error evaluating "${exp}":`, error);
    }
  }

  console.log('\n--- Calculator Service Test Finished ---');
}

testCalculator();
