import { describe, expect, it } from 'vitest';
import { CalculatorService } from '../calculator.service';

describe('CalculatorService expression evaluation', () => {
  it.each([
    ['sqrt(144)', 12],
    ['abs(-5)', 5],
    ['pow(2, 3)', 8],
    ['Math.sqrt(81)', 9],
    ['23% of 456', 104.88],
    ['23 percent of 456', 104.88],
  ])('evaluates documented scalar function %s', async (expression, expected) => {
    const calculator = new CalculatorService();

    const result = await calculator.evaluate(expression);

    expect(result.expression).toBe(expression);
    expect(Number(result.result)).toBeCloseTo(expected, 10);
  });

  it('evaluates trig functions in degrees by default', async () => {
    const calculator = new CalculatorService();

    const result = await calculator.evaluate('sin(45)');

    expect(result.result).toBeCloseTo(Math.SQRT1_2, 10);
  });
});
