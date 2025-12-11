// Calculator Tool - Service Implementation
// Phase 2.2: Basic calculator implementation
// Date: October 10, 2025
// NOTE: This is a BASIC implementation - Replace with your sophisticated calculator

import { calculatorConfig } from './calculator.config';
import { evaluate, parse, simplify, derivative, lsolve, det, inv, multiply, mean, median, std, variance } from 'mathjs';
import { supabase } from '../../supabaseClient';

/**
 * Calculator Service
 * This is a basic implementation - users should replace this with their sophisticated calculator
 */
export class CalculatorService {
  private config = calculatorConfig;
  private scope: Record<string, unknown> = {};
  // Phase 3: Custom user-defined functions storage (session-specific)
  private customFunctions: Map<string, { params: string[]; body: string; description?: string }> = new Map();

  /**
   * Evaluate a mathematical expression with variable support
   * Persists calculation to Supabase history
   */
  async evaluate(expression: string, userId?: string): Promise<{ result: number | string; expression: string; scope: Record<string, unknown>; unit?: string; steps?: string[] }> {
    console.log(`[CalculatorService] Evaluating expression: "${expression}" for user: ${userId || 'anonymous'}`);

    // Validate expression length
    if (expression.length > this.config.maxExpressionLength) {
      throw new Error(`[Calculator] ValidationError: Expression exceeds maximum length of ${this.config.maxExpressionLength} characters`);
    }

    // Remove whitespace
    const cleanExpression = expression.trim();

    if (!cleanExpression) {
      console.error('[CalculatorService] Validation Error: Expression cannot be empty');
      throw new Error('[Calculator] ValidationError: Expression cannot be empty');
    }

    // Reject symbolic equations (contains = sign)
    if (cleanExpression.includes('=') && !cleanExpression.includes('==')) {
      console.error('[CalculatorService] Validation Error: Equation solving not supported');
      throw new Error(
        '[Calculator] ValidationError: This calculator evaluates expressions, not equations. ' +
        'Please provide an expression to evaluate (e.g., "2+2", "sin(45)") rather than an equation to solve (e.g., "x+1=5"). ' +
        'For equation solving, please describe what you want to solve in natural language.'
      );
    }

    // Check for unsupported special characters that might cause parsing issues
    const unsupportedChars = /[√|{}[\]]/;
    if (unsupportedChars.test(cleanExpression)) {
      console.error('[CalculatorService] Validation Error: Unsupported characters detected');
      throw new Error(
        '[Calculator] ValidationError: Expression contains unsupported characters (√, |, {}, []). ' +
        'Please use function notation instead: sqrt() for square root, abs() for absolute value. ' +
        'Example: "abs(x + sqrt(1-x^2))" instead of "|x+√(1-x²)|"'
      );
    }

    try {
      console.log(`[CalculatorService] Cleaned expression: "${cleanExpression}"`);
      // Check for output unit conversion pattern (e.g., 'to mm')
      const toMatch = /(.+)\s+to\s+([a-zA-Z0-9/*^ -]+)/i.exec(cleanExpression);
      let convertToUnit: string | undefined = undefined;
      let exprForEval = cleanExpression;
      if (toMatch) {
        exprForEval = toMatch[1].trim();
        convertToUnit = toMatch[2].trim();
      }
      // Convert expression to safe format
      const safeExpression = this.preparExpression(exprForEval);
      // Use mathjs parse to support variables, units, and functions
      const node = parse(safeExpression);
      console.log('[CalculatorService] Parsed expression node:', node.toString());
      let result = node.evaluate(this.scope);
      console.log('[CalculatorService] Evaluation result:', result);
      let output: number | string = Number(result);
      let unit: string | undefined = undefined;
      // If the result is a function (function assignment), return a message
      if (typeof result === 'function') {
        output = 'Function defined';
      } else if (result && typeof result === 'object' && result.isUnit) {
        if (convertToUnit) {
          try {
            result = result.to(convertToUnit);
          } catch (e) {
            throw new Error(`[Calculator] ExecutionError: Cannot convert to unit '${convertToUnit}': ${e instanceof Error ? e.message : e}`);
          }
        }
        output = result.toString();
        unit = result.formatUnits();
      } else {
        output = Number(result);
      }
      console.log(`[CalculatorService] Final output: ${output}, Unit: ${unit || 'none'}`);
      // Step-by-step breakdown
      const steps: string[] = [];
      node.traverse(function (n) {
        if (n.type === 'OperatorNode') {
          steps.push(`Compute: ${n.toString()}`);
        } else if (n.type === 'FunctionNode') {
          steps.push(`Evaluate function: ${n.toString()}`);
        } else if (n.type === 'AssignmentNode') {
          steps.push(`Assign: ${n.toString()}`);
        }
      });
      console.log('[CalculatorService] Generated steps:', steps);
      // Persist calculation to Supabase if userId is provided
      if (userId) {
        await supabase.from('calculator_history').insert({
          user_id: userId,
          expression: cleanExpression,
          result: String(output),
          scope: JSON.stringify(this.scope),
          unit: unit || null
        });
        console.log('[CalculatorService] Calculation persisted to Supabase history.');
      }
      return {
        result: output,
        expression: cleanExpression,
        scope: { ...this.scope },
        unit: unit,
        steps
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Evaluation failed';
      console.error(`[CalculatorService] Execution Error for expression "${expression}":`, message);
      throw new Error(`[Calculator] ExecutionError: ${message}`);
    }
  }

  /**
   * Fetch calculation history for a user
   */
  async getHistory(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error('[Calculator] ExecutionError: Failed to fetch history - ' + error.message);
    return data;
  }

  /**
   * Prepare expression for evaluation
   * Replace function names with Math equivalents
   */
  private preparExpression(expr: string): string {
    let prepared = expr;

    // Convert angle to radians if needed
    const angleMultiplier = this.config.angleMode === 'degrees' ? ' * Math.PI / 180' : '';

    // Replace allowed functions
    if (this.config.allowedFunctions.includes('sqrt')) {
      prepared = prepared.replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)');
    }
    if (this.config.allowedFunctions.includes('pow')) {
      prepared = prepared.replace(/pow\(([^,]+),([^)]+)\)/g, 'Math.pow($1,$2)');
    }
    if (this.config.allowedFunctions.includes('abs')) {
      prepared = prepared.replace(/abs\(([^)]+)\)/g, 'Math.abs($1)');
    }
    
    // Trigonometric functions
    if (this.config.allowedFunctions.includes('sin')) {
      prepared = prepared.replace(/sin\(([^)]+)\)/g, `Math.sin($1${angleMultiplier})`);
    }
    if (this.config.allowedFunctions.includes('cos')) {
      prepared = prepared.replace(/cos\(([^)]+)\)/g, `Math.cos($1${angleMultiplier})`);
    }
    if (this.config.allowedFunctions.includes('tan')) {
      prepared = prepared.replace(/tan\(([^)]+)\)/g, `Math.tan($1${angleMultiplier})`);
    }

    // Constants
    prepared = prepared.replace(/\bpi\b/gi, 'Math.PI');
    prepared = prepared.replace(/\be\b(?![a-z])/gi, 'Math.E');

    return prepared;
  }

  /**
   * Safe eval with validation
   * SECURITY NOTE: This is basic - use a proper parser in production
   */
  private safeEval(expr: string): number {
    // Use mathjs for robust and safe evaluation
    try {
      const result = evaluate(expr);
      if (typeof result !== 'number') {
        throw new Error('[Calculator] ExecutionError: Expression did not return a number');
      }
      return result;
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Invalid mathematical expression - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Simplify an algebraic expression
   */
  simplifyExpression(expr: string): string {
    try {
      return simplify(expr).toString();
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Simplify failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Differentiate an expression with respect to a variable
   */
  differentiate(expr: string, variable: string): string {
    try {
      return derivative(expr, variable).toString();
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Derivative calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Solve an equation for a variable
   * (Symbolic equation solving is not supported by mathjs, so this is disabled)
   */
  // solveEquation(equation: string, variable: string): string {
  //   try {
  //     const solutions = solve(equation, variable);
  //     return Array.isArray(solutions) ? solutions.map(format).join(', ') : format(solutions);
  //   } catch (error) {
  //     throw new Error('[Calculator] ExecutionError: Solve failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
  //   }
  // }

  /**
   * Solve a linear system of equations (numeric)
   * Accepts an array of equations in matrix form: Ax = b
   */
  solveLinearSystem(A: number[][], b: number[]): number[] {
    try {
      // lsolve returns MathArray<MathNumericType>[]
      const solution = lsolve(A, b) as (number[] | number)[];
      return solution.map((arr) => Array.isArray(arr) ? arr[0] : arr as number);
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Linear system solve failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Compute the determinant of a matrix
   */
  matrixDeterminant(matrix: number[][]): number {
    try {
      return det(matrix);
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Determinant calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Compute the inverse of a matrix
   */
  matrixInverse(matrix: number[][]): number[][] {
    try {
      return inv(matrix) as number[][];
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Matrix inverse calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Multiply two matrices
   */
  matrixMultiply(A: number[][], B: number[][]): number[][] {
    try {
      return multiply(A, B) as number[][];
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Matrix multiplication failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Compute the mean of a list of numbers
   */
  mean(values: number[]): number {
    try {
      return mean(values) as number;
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Mean calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Compute the median of a list of numbers
   */
  median(values: number[]): number {
    try {
      return median(values) as number;
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Median calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Compute the standard deviation of a list of numbers
   */
  std(values: number[]): number {
    try {
      const result = std(values);
      const value = Array.isArray(result) ? result[0] : result;
      return typeof value === 'number' ? value : Number(value);
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Standard deviation calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Compute the variance of a list of numbers
   */
  variance(values: number[]): number {
    try {
      const result = variance(values);
      const value = Array.isArray(result) ? result[0] : result;
      return typeof value === 'number' ? value : Number(value);
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Variance calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // ============================================================================
  // Phase 2: LLM-Specific Evaluation Functions
  // Vector/Embedding Operations for Model Evaluation
  // ============================================================================

  /**
   * Calculate dot product of two vectors
   * Used for: embedding similarity, vector projections
   * Example: dot([1, 2, 3], [4, 5, 6]) = 32
   */
  dotProduct(vectorA: number[], vectorB: number[]): number {
    console.log('[CalculatorService] Computing dot product:', { vectorA, vectorB });
    
    if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
      throw new Error('[Calculator] ValidationError: Both inputs must be arrays for dot product');
    }
    
    if (vectorA.length !== vectorB.length) {
      throw new Error('[Calculator] ValidationError: Vectors must have same length for dot product');
    }
    
    try {
      const result = vectorA.reduce((sum, val, idx) => sum + val * vectorB[idx], 0);
      console.log('[CalculatorService] Dot product result:', result);
      return result;
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Dot product calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Calculate the norm (magnitude/length) of a vector
   * Used for: normalizing embeddings, distance calculations
   * Example: norm([3, 4]) = 5 (L2 norm)
   */
  vectorNorm(vector: number[], normType: 2 | 1 | 'inf' = 2): number {
    console.log('[CalculatorService] Computing vector norm:', { vector, normType });
    
    if (!Array.isArray(vector)) {
      throw new Error('[Calculator] ValidationError: Input must be an array for norm calculation');
    }
    
    try {
      let result: number;
      
      if (normType === 2) {
        // L2 norm (Euclidean)
        result = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      } else if (normType === 1) {
        // L1 norm (Manhattan)
        result = vector.reduce((sum, val) => sum + Math.abs(val), 0);
      } else if (normType === 'inf') {
        // L-infinity norm (Maximum)
        result = Math.max(...vector.map(Math.abs));
      } else {
        throw new Error('[Calculator] ValidationError: Invalid norm type. Use 2, 1, or "inf"');
      }
      
      console.log('[CalculatorService] Vector norm result:', result);
      return result;
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Norm calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * Used for: comparing embeddings, semantic similarity
   * Range: -1 (opposite) to 1 (identical)
   * Example: cosineSimilarity([1, 2, 3], [4, 5, 6]) = 0.974...
   */
  cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    console.log('[CalculatorService] Computing cosine similarity:', { vectorA, vectorB });
    
    if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
      throw new Error('[Calculator] ValidationError: Both inputs must be arrays for cosine similarity');
    }
    
    if (vectorA.length !== vectorB.length) {
      throw new Error('[Calculator] ValidationError: Vectors must have same length for cosine similarity');
    }
    
    try {
      const dotProd = this.dotProduct(vectorA, vectorB);
      const normA = this.vectorNorm(vectorA, 2);
      const normB = this.vectorNorm(vectorB, 2);
      
      if (normA === 0 || normB === 0) {
        throw new Error('[Calculator] ExecutionError: Cannot compute cosine similarity with zero vector');
      }
      
      const result = dotProd / (normA * normB);
      console.log('[CalculatorService] Cosine similarity result:', result);
      return result;
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Cosine similarity calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // ============================================================================
  // Model Cost Calculation
  // Pricing data for various LLM providers (as of Oct 2025)
  // ============================================================================

  /**
   * Calculate cost for LLM API usage
   * Used for: cost analysis, model comparison, budget tracking
   * Example: calculateCost(1000, 500, 'gpt-4o') = $0.0125
   */
  calculateCost(inputTokens: number, outputTokens: number, modelName: string): {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    model: string;
    breakdown: string;
  } {
    console.log('[CalculatorService] Calculating cost:', { inputTokens, outputTokens, modelName });
    
    if (typeof inputTokens !== 'number' || inputTokens < 0) {
      throw new Error('[Calculator] ValidationError: inputTokens must be a non-negative number');
    }
    
    if (typeof outputTokens !== 'number' || outputTokens < 0) {
      throw new Error('[Calculator] ValidationError: outputTokens must be a non-negative number');
    }
    
    try {
      const normalizedModel = modelName.toLowerCase().trim();
      const pricing = this.MODEL_PRICING[normalizedModel] || this.MODEL_PRICING['default'];
      
      const inputCost = (inputTokens / 1000000) * pricing.input;
      const outputCost = (outputTokens / 1000000) * pricing.output;
      const totalCost = inputCost + outputCost;
      
      const result = {
        inputCost: Number(inputCost.toFixed(6)),
        outputCost: Number(outputCost.toFixed(6)),
        totalCost: Number(totalCost.toFixed(6)),
        model: modelName,
        breakdown: `Input: ${inputTokens} tokens ($${inputCost.toFixed(6)}) + Output: ${outputTokens} tokens ($${outputCost.toFixed(6)}) = $${totalCost.toFixed(6)}`
      };
      
      console.log('[CalculatorService] Cost calculation result:', result);
      return result;
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Cost calculation failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private readonly MODEL_PRICING: Record<string, { input: number; output: number; unit: string }> = {
    // OpenAI Models (per 1M tokens)
    'gpt-4o': { input: 5.00, output: 15.00, unit: '1M tokens' },
    'gpt-4o-mini': { input: 0.150, output: 0.600, unit: '1M tokens' },
    'gpt-4-turbo': { input: 10.00, output: 30.00, unit: '1M tokens' },
    'gpt-4': { input: 30.00, output: 60.00, unit: '1M tokens' },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50, unit: '1M tokens' },
    
    // Anthropic Models (per 1M tokens)
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00, unit: '1M tokens' },
    'claude-3-opus': { input: 15.00, output: 75.00, unit: '1M tokens' },
    'claude-3-sonnet': { input: 3.00, output: 15.00, unit: '1M tokens' },
    'claude-3-haiku': { input: 0.25, output: 1.25, unit: '1M tokens' },
    
    // Generic fallback
    'default': { input: 1.00, output: 2.00, unit: '1M tokens' }
  };

  // ============================================================================
  // NLP Scoring Functions
  // Basic text analysis for model output evaluation
  // ============================================================================

  /**
   * Count words in a text string
   * Used for: response length metrics, verbosity analysis
   * Example: wordCount("Hello world!") = 2
   */
  wordCount(text: string): number {
    console.log('[CalculatorService] Counting words in text');
    
    if (typeof text !== 'string') {
      throw new Error('[Calculator] ValidationError: Input must be a string for word count');
    }
    
    try {
      const trimmed = text.trim();
      if (trimmed === '') return 0;
      
      const words = trimmed.split(/\s+/).filter(word => word.length > 0);
      const count = words.length;
      
      console.log('[CalculatorService] Word count result:', count);
      return count;
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Word count failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Count characters in a text string
   * Used for: token estimation, character limits
   * Example: charCount("Hello") = 5
   */
  charCount(text: string, includeSpaces: boolean = true): number {
    console.log('[CalculatorService] Counting characters');
    
    if (typeof text !== 'string') {
      throw new Error('[Calculator] ValidationError: Input must be a string for character count');
    }
    
    try {
      const count = includeSpaces ? text.length : text.replace(/\s/g, '').length;
      console.log('[CalculatorService] Character count result:', count);
      return count;
    } catch (error) {
      throw new Error('[Calculator] ExecutionError: Character count failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Extract value from JSON string using path
   * Used for: parsing structured LLM outputs, extracting metrics
   * Example: jsonLookup('{"data": {"score": 95}}', 'data.score') = 95
   */
  jsonLookup(jsonString: string, path: string): unknown {
    console.log('[CalculatorService] JSON lookup:', { path });
    
    if (typeof jsonString !== 'string') {
      throw new Error('[Calculator] ValidationError: First argument must be a JSON string');
    }
    
    if (typeof path !== 'string') {
      throw new Error('[Calculator] ValidationError: Path must be a string');
    }
    
    try {
      const data = JSON.parse(jsonString);
      const pathParts = path.split('.');
      
      let result: unknown = data;
      for (const part of pathParts) {
        if (result === null || result === undefined) {
          throw new Error(`Path "${path}" not found: "${part}" is undefined`);
        }
        
        if (typeof result === 'object' && part in (result as Record<string, unknown>)) {
          result = (result as Record<string, unknown>)[part];
        } else {
          throw new Error(`Path "${path}" not found: property "${part}" does not exist`);
        }
      }
      
      console.log('[CalculatorService] JSON lookup result:', result);
      return result;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('[Calculator] ExecutionError: Invalid JSON string - ' + error.message);
      }
      throw new Error('[Calculator] ExecutionError: JSON lookup failed - ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Phase 3 Step 1: Define a custom function
   * Allows LLMs to create temporary, session-specific functions
   * Example: defineFunction('f1Score', ['precision', 'recall'], '2 * precision * recall / (precision + recall)')
   */
  defineFunction(name: string, params: string[], body: string, description?: string): void {
    console.log('[CalculatorService] Defining custom function:', { name, params, body });
    
    // Validation: function name
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('[Calculator] ValidationError: Function name must be a non-empty string');
    }
    
    // Validation: name pattern (alphanumeric + underscore, must start with letter)
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error('[Calculator] ValidationError: Function name must start with a letter and contain only letters, numbers, and underscores');
    }
    
    // Validation: parameters array
    if (!Array.isArray(params)) {
      throw new Error('[Calculator] ValidationError: Parameters must be an array');
    }
    
    // Validation: each parameter must be valid identifier
    for (const param of params) {
      if (typeof param !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(param)) {
        throw new Error(`[Calculator] ValidationError: Invalid parameter name "${param}"`);
      }
    }
    
    // Validation: body must be non-empty string
    if (typeof body !== 'string' || body.trim() === '') {
      throw new Error('[Calculator] ValidationError: Function body must be a non-empty string');
    }
    
    // Store the function definition
    this.customFunctions.set(name, { params, body, description });
    console.log('[CalculatorService] Custom function defined successfully:', name);
  }

  /**
   * Phase 3 Step 1: Call a custom-defined function
   * Executes a previously defined custom function with provided arguments
   * Example: callFunction('f1Score', [0.8, 0.9]) returns F1 score
   */
  callFunction(name: string, args: number[]): number {
    console.log('[CalculatorService] Calling custom function:', { name, args });
    
    // Validation: function must exist
    const func = this.customFunctions.get(name);
    if (!func) {
      throw new Error(`[Calculator] ExecutionError: Function "${name}" is not defined. Use defineFunction() first.`);
    }
    
    // Validation: argument count must match parameter count
    if (args.length !== func.params.length) {
      throw new Error(`[Calculator] ExecutionError: Function "${name}" expects ${func.params.length} arguments, got ${args.length}`);
    }
    
    // Build a temporary scope with parameter values
    const funcScope: Record<string, unknown> = { ...this.scope };
    for (let i = 0; i < func.params.length; i++) {
      funcScope[func.params[i]] = args[i];
    }
    
    try {
      // Evaluate function body with parameter scope
      const result = evaluate(func.body, funcScope);
      console.log('[CalculatorService] Custom function result:', result);
      return typeof result === 'number' ? result : parseFloat(String(result));
    } catch (error) {
      throw new Error(`[Calculator] ExecutionError: Failed to execute function "${name}" - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Phase 3 Step 1: List all defined custom functions
   * Returns array of function metadata for inspection
   */
  listCustomFunctions(): Array<{ name: string; params: string[]; body: string; description?: string }> {
    console.log('[CalculatorService] Listing custom functions');
    const functions = Array.from(this.customFunctions.entries()).map(([name, func]) => ({
      name,
      params: func.params,
      body: func.body,
      description: func.description
    }));
    console.log('[CalculatorService] Found custom functions:', functions.length);
    return functions;
  }

  /**
   * Phase 3 Step 1: Remove a custom function definition
   * Deletes a previously defined function from memory
   */
  removeFunction(name: string): boolean {
    console.log('[CalculatorService] Removing custom function:', name);
    const existed = this.customFunctions.has(name);
    this.customFunctions.delete(name);
    console.log('[CalculatorService] Function removed:', existed);
    return existed;
  }

  /**
   * Phase 3 Step 2: Analyze calculation history
   * Provides statistical insights from user's calculation history
   * Returns: total calculations, unique operations, most common operations, time range
   */
  async getHistoryStats(userId: string): Promise<{
    totalCalculations: number;
    uniqueExpressions: number;
    mostCommonOperations: Array<{ operation: string; count: number }>;
    dateRange: { earliest: string; latest: string };
    errorRate: number;
  }> {
    console.log('[CalculatorService] Analyzing history for user:', userId);
    
    if (!userId || typeof userId !== 'string') {
      throw new Error('[Calculator] ValidationError: userId must be a non-empty string');
    }
    
    // Fetch all history for the user
    const { data, error } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (error) {
      throw new Error('[Calculator] ExecutionError: Failed to fetch history - ' + error.message);
    }
    
    if (!data || data.length === 0) {
      console.log('[CalculatorService] No history found for user');
      return {
        totalCalculations: 0,
        uniqueExpressions: 0,
        mostCommonOperations: [],
        dateRange: { earliest: '', latest: '' },
        errorRate: 0
      };
    }
    
    console.log('[CalculatorService] Processing history records:', data.length);
    return this.analyzeHistoryData(data);
  }

  /**
   * Phase 3 Step 2: Process history data for statistics
   * Helper method to extract insights from history records
   */
  private analyzeHistoryData(data: unknown[]): {
    totalCalculations: number;
    uniqueExpressions: number;
    mostCommonOperations: Array<{ operation: string; count: number }>;
    dateRange: { earliest: string; latest: string };
    errorRate: number;
  } {
    const totalCalculations = data.length;
    const expressions = new Set<string>();
    const operationCounts = new Map<string, number>();
    let errorCount = 0;
    
    for (const record of data) {
      const entry = record as { expression?: string; result?: unknown; created_at?: string };
      
      if (entry.expression) {
        expressions.add(entry.expression);
        
        // Extract operation type (basic heuristic)
        const operation = this.extractOperation(entry.expression);
        operationCounts.set(operation, (operationCounts.get(operation) || 0) + 1);
      }
      
      // Check if result indicates an error
      if (entry.result && typeof entry.result === 'string' && entry.result.includes('Error')) {
        errorCount++;
      }
    }
    
    // Sort operations by count
    const mostCommonOperations = Array.from(operationCounts.entries())
      .map(([operation, count]) => ({ operation, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 operations
    
    // Extract date range
    const firstRecord = data[0] as { created_at?: string };
    const lastRecord = data[data.length - 1] as { created_at?: string };
    
    const result = {
      totalCalculations,
      uniqueExpressions: expressions.size,
      mostCommonOperations,
      dateRange: {
        earliest: firstRecord.created_at || '',
        latest: lastRecord.created_at || ''
      },
      errorRate: totalCalculations > 0 ? errorCount / totalCalculations : 0
    };
    
    console.log('[CalculatorService] History analysis complete:', result);
    return result;
  }

  /**
   * Phase 3 Step 2: Extract operation type from expression
   * Helper to categorize calculations for history analysis
   */
  private extractOperation(expression: string): string {
    // Check for common operations in order of specificity
    if (/std|variance|mean|median|mode/i.test(expression)) return 'statistics';
    if (/matrix|det|inv|lsolve/i.test(expression)) return 'linear_algebra';
    if (/derivative|simplify/i.test(expression)) return 'calculus';
    if (/dotProduct|cosineSimilarity|vectorNorm/i.test(expression)) return 'vectors';
    if (/calculateCost/i.test(expression)) return 'cost_analysis';
    if (/wordCount|charCount|jsonLookup/i.test(expression)) return 'nlp';
    if (/sin|cos|tan|asin|acos|atan/i.test(expression)) return 'trigonometry';
    if (/log|ln|exp|sqrt|pow/i.test(expression)) return 'advanced_math';
    if (/[\+\-\*\/\^%]/.test(expression)) return 'arithmetic';
    return 'other';
  }

  /**
   * Phase 3 Step 3: Export calculation history in structured format
   * Supports JSON, CSV, and Markdown formats for analytics/BI integration
   * @param userId - User identifier for fetching history
   * @param format - Output format: 'json', 'csv', or 'markdown'
   * @param limit - Maximum number of records to export (default: 100)
   * @returns Formatted string ready for export/download
   */
  async exportResults(
    userId: string, 
    format: 'json' | 'csv' | 'markdown' = 'json',
    limit: number = 100
  ): Promise<string> {
    console.log('[CalculatorService] Exporting results:', { userId, format, limit });
    
    if (!userId || typeof userId !== 'string') {
      throw new Error('[Calculator] ValidationError: userId must be a non-empty string');
    }
    
    if (!['json', 'csv', 'markdown'].includes(format)) {
      throw new Error('[Calculator] ValidationError: format must be json, csv, or markdown');
    }
    
    if (limit < 1 || limit > 10000) {
      throw new Error('[Calculator] ValidationError: limit must be between 1 and 10000');
    }
    
    // Fetch history data
    const { data, error } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[CalculatorService] Export fetch error:', error);
      throw new Error(`[Calculator] Failed to fetch history: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log('[CalculatorService] No data to export');
      return format === 'json' ? '[]' : '';
    }
    
    console.log('[CalculatorService] Exporting records:', data.length);
    
    // Format based on requested type
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    
    if (format === 'csv') {
      return this.formatAsCSV(data);
    }
    
    if (format === 'markdown') {
      return this.formatAsMarkdown(data);
    }
    
    throw new Error('[Calculator] Unsupported format');
  }

  /**
   * Phase 3 Step 3: Format data as CSV
   * Helper for exportResults
   */
  private formatAsCSV(data: Record<string, unknown>[]): string {
    console.log('[CalculatorService] Formatting as CSV');
    
    if (data.length === 0) return '';
    
    // Get headers from first record
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    // Convert each row to CSV
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Phase 3 Step 3: Format data as Markdown table
   * Helper for exportResults
   */
  private formatAsMarkdown(data: Record<string, unknown>[]): string {
    console.log('[CalculatorService] Formatting as Markdown');
    
    if (data.length === 0) return '';
    
    // Get headers
    const headers = Object.keys(data[0]);
    const headerRow = '| ' + headers.join(' | ') + ' |';
    const separatorRow = '| ' + headers.map(() => '---').join(' | ') + ' |';
    
    // Convert each row
    const dataRows = data.map(row => {
      return '| ' + headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      }).join(' | ') + ' |';
    });
    
    return [headerRow, separatorRow, ...dataRows].join('\n');
  }
}

// Export singleton instance
export const calculatorService = new CalculatorService();
