// Calculator Tool - Main Export
// Phase 2.3: Tool definition and registration
// Date: October 10, 2025

import { ToolDefinition } from '../types';
import { calculatorConfig } from './calculator.config';
import { calculatorService } from './calculator.service';

/**
 * Calculator Tool Definition
 * This module can be completely replaced with a sophisticated calculator implementation
 */
const calculatorTool: ToolDefinition = {
  name: 'calculator',
  description: 'Evaluate mathematical EXPRESSIONS with full precision. IMPORTANT: This tool EVALUATES expressions (like "2+2", "sqrt(16)"), NOT solves equations (like "x+1=5"). For equation solving, break down the problem or guide the user. Supports: arithmetic, algebra, trigonometry, calculus (derivatives), linear algebra (matrices, determinants), statistics (mean, median, std, variance), symbolic math (simplify), complex numbers, and unit conversions. Use function notation: sqrt() for square root, abs() for absolute value. Arrays for statistics: mean([1,2,3]).',
  version: '1.2.0',

  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (NOT an equation to solve). Must use function notation. Valid: "sqrt(16)", "abs(-5)", "sin(45)", "mean([1,2,3])", "derivative(\'x^2\', \'x\')". Invalid: "√16", "|x+1|", "x+1=5" (equations not supported). Do not include = signs unless part of assignment like "x = 5".',
      },
    },
    required: ['expression'],
  },
  
  config: {
    enabled: calculatorConfig.enabled,
    maxExpressionLength: calculatorConfig.maxExpressionLength,
    timeout: calculatorConfig.timeout,
  },
  
  /**
   * Execute calculator operation
   */
  async execute(params: Record<string, unknown>) {
    const { expression } = params;
    
    if (!expression || typeof expression !== 'string') {
      throw new Error('[Calculator] Parameter validation failed: expression is required and must be a string');
    }
    
    return calculatorService.evaluate(expression);
  },
};

export default calculatorTool;
