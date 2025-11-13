// Calculator Tool - Configuration
// Phase 2.1: Calculator-specific configuration
// Date: October 10, 2025
// NOTE: This is a basic implementation - ready to be replaced with your sophisticated calculator

import { calculatorConfig as globalConfig } from '../config';

/**
 * Calculator-specific configuration
 * Users can extend this with their own sophisticated calculator config
 */
export const calculatorConfig = {
  ...globalConfig,
  
  // Additional calculator-specific settings
  precision: parseInt(process.env.CALCULATOR_PRECISION || '10'),
  angleMode: process.env.CALCULATOR_ANGLE_MODE || 'degrees', // or 'radians'
  
  // Safety limits
  maxIterations: parseInt(process.env.CALCULATOR_MAX_ITERATIONS || '1000'),
  maxRecursionDepth: parseInt(process.env.CALCULATOR_MAX_RECURSION || '10'),
  
  // Feature flags - Enhanced for Phase 1
  // Enabled by default to unlock full mathjs capabilities for LLM evaluation
  enableComplexNumbers: process.env.CALCULATOR_COMPLEX_NUMBERS !== 'false', // default: true
  enableMatrices: process.env.CALCULATOR_MATRICES !== 'false', // default: true
  enableSymbolic: process.env.CALCULATOR_SYMBOLIC !== 'false', // default: true
};

export type CalculatorConfig = typeof calculatorConfig;
