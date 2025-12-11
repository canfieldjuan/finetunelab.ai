# Calculator Tool - Quick Start Guide

**For developers who need to use the tool immediately.**

## What It Does

Comprehensive mathematical computation powered by mathjs: arithmetic, statistics, linear algebra, calculus, trigonometry, vector operations, LLM cost analysis, NLP functions, custom functions, history tracking, and more.

## Import

```typescript
import calculatorTool from '@/lib/tools/calculator';
// Or use service directly
import { calculatorService } from '@/lib/tools/calculator/calculator.service';
```

## Basic Usage

```typescript
// Simple calculation
const result = await calculatorTool.execute({
  expression: '2 + 2'
});
console.log(result.result);  // 4

// With history tracking
const result = await calculatorService.evaluate('sqrt(16)', 'user-123');
console.log(result.result);  // 4
console.log(result.steps);   // Step-by-step breakdown
```

## Quick Examples

### Arithmetic

```typescript
await calculatorTool.execute({ expression: '10 + 5 - 3' });  // 12
await calculatorTool.execute({ expression: '4 * 5 / 2' });   // 10
await calculatorTool.execute({ expression: '2^10' });        // 1024
await calculatorTool.execute({ expression: '17 % 5' });      // 2
```

### Advanced Math

```typescript
await calculatorTool.execute({ expression: 'sqrt(16)' });     // 4
await calculatorTool.execute({ expression: 'pow(2, 10)' });   // 1024
await calculatorTool.execute({ expression: 'abs(-42)' });     // 42
await calculatorTool.execute({ expression: 'log(100)' });     // 2
await calculatorTool.execute({ expression: 'ln(2.718)' });    // ~1
```

### Trigonometry (Degrees by default)

```typescript
await calculatorTool.execute({ expression: 'sin(30)' });   // 0.5
await calculatorTool.execute({ expression: 'cos(60)' });   // 0.5
await calculatorTool.execute({ expression: 'tan(45)' });   // 1
await calculatorTool.execute({ expression: 'asin(0.5)' }); // 30
```

### Statistics

```typescript
await calculatorTool.execute({ expression: 'mean([1,2,3,4,5])' });      // 3
await calculatorTool.execute({ expression: 'median([1,2,3,4,5])' });    // 3
await calculatorTool.execute({ expression: 'std([1,2,3,4,5])' });       // ~1.414
await calculatorTool.execute({ expression: 'variance([1,2,3,4,5])' });  // 2
await calculatorTool.execute({ expression: 'sum([1,2,3,4,5])' });       // 15
```

### Linear Algebra

```typescript
// Matrix determinant
await calculatorTool.execute({ expression: 'det([[1,2],[3,4]])' });  // -2

// Matrix inverse
await calculatorTool.execute({ expression: 'inv([[1,2],[3,4]])' });
// [[-2, 1], [1.5, -0.5]]

// Solve linear system
const solution = await calculatorService.solveLinearSystem(
  [[2, 1], [1, 3]],  // A
  [8, 11]            // b
);  // [3, 2]
```

### Calculus

```typescript
// Derivatives
await calculatorTool.execute({ expression: 'derivative("x^2", "x")' });
// 2x

await calculatorTool.execute({ expression: 'derivative("3x^2 + 2x + 1", "x")' });
// 6x + 2

// Simplify
await calculatorTool.execute({ expression: 'simplify("2x + 3x")' });
// 5x
```

### Unit Conversions

```typescript
await calculatorTool.execute({ expression: '5 cm to inch' });      // 1.968...
await calculatorTool.execute({ expression: '100 mph to m/s' });    // 44.704
await calculatorTool.execute({ expression: '1 kg to lb' });        // 2.204...
await calculatorTool.execute({ expression: '32 degF to degC' });   // 0
await calculatorTool.execute({ expression: '1 gallon to liter' }); // 3.785...
```

### Variables

```typescript
const r1 = await calculatorService.evaluate('x = 5');
const r2 = await calculatorService.evaluate('y = 10');
const r3 = await calculatorService.evaluate('x + y');

console.log(r3.result);  // 15
console.log(r3.scope);   // { x: 5, y: 10 }
```

## LLM-Specific Features

### Vector Operations

```typescript
// Dot product
const dot = await calculatorService.dotProduct([1,2,3], [4,5,6]);
// 32

// Vector norm
const norm = await calculatorService.vectorNorm([3, 4]);    // 5 (L2)
const l1 = await calculatorService.vectorNorm([3, 4], 1);   // 7 (L1)

// Cosine similarity (embeddings)
const similarity = await calculatorService.cosineSimilarity(
  [1, 2, 3],
  [4, 5, 6]
);  // 0.974...
```

### LLM Cost Calculation

```typescript
const cost = await calculatorService.calculateCost(
  1000,      // input tokens
  500,       // output tokens
  'gpt-4o'
);

console.log(cost);
/*
{
  inputCost: 0.005,
  outputCost: 0.0075,
  totalCost: 0.0125,
  model: 'gpt-4o',
  breakdown: 'Input: 1000 tokens ($0.005) + Output: 500 tokens ($0.0075) = $0.0125'
}
*/
```

**Supported Models:**
- OpenAI: `gpt-4`, `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`
- Anthropic: `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`, `claude-3-5-sonnet-20241022`

### NLP Functions

```typescript
// Word count
const words = await calculatorService.wordCount('Hello world, how are you?');
// 5

// Character count
const chars = await calculatorService.charCount('Hello world', true);
// 11 (with spaces)

// JSON extraction
const data = '{"data": {"score": 95}}';
const score = await calculatorService.jsonLookup(data, 'data.score');
// 95
```

## Custom Functions

```typescript
// Define
calculatorService.defineFunction(
  'f1Score',
  ['precision', 'recall'],
  '2 * precision * recall / (precision + recall)',
  'F1 score calculation'
);

// Call
const f1 = calculatorService.callFunction('f1Score', [0.8, 0.9]);
// 0.847...

// List all
const functions = calculatorService.listCustomFunctions();

// Remove
calculatorService.removeFunction('f1Score');
```

## History Tracking

```typescript
// Automatic save with userId
const result = await calculatorService.evaluate('mean([85,90,92,88])', 'user-123');

// Fetch history
const history = await calculatorService.getHistory('user-123', 20);

// Get statistics
const stats = await calculatorService.getHistoryStats('user-123');
console.log(stats);
/*
{
  totalCalculations: 145,
  uniqueExpressions: 98,
  mostCommonOperations: [
    { operation: 'statistics', count: 45 },
    { operation: 'arithmetic', count: 38 }
  ],
  dateRange: { earliest: '...', latest: '...' },
  errorRate: 0.034
}
*/
```

## Export

```typescript
// JSON
const json = await calculatorService.exportResults('user-123', 'json', 100);

// CSV
const csv = await calculatorService.exportResults('user-123', 'csv', 50);

// Markdown
const markdown = await calculatorService.exportResults('user-123', 'markdown', 20);
```

## Common Patterns

### 1. Cost Comparison

```typescript
async function compareCosts() {
  const models = ['gpt-4', 'gpt-4o', 'claude-3-sonnet'];
  const input = 50000;
  const output = 10000;

  for (const model of models) {
    const cost = await calculatorService.calculateCost(input, output, model);
    console.log(`${model}: $${cost.totalCost}`);
  }
}
```

### 2. Embedding Similarity

```typescript
async function findSimilar() {
  const query = [0.1, 0.2, 0.3, 0.4, 0.5];
  const docs = [
    [0.15, 0.25, 0.32, 0.38, 0.48],
    [0.9, 0.8, 0.1, 0.2, 0.3]
  ];

  for (let i = 0; i < docs.length; i++) {
    const sim = await calculatorService.cosineSimilarity(query, docs[i]);
    console.log(`Doc ${i}: ${sim.toFixed(3)}`);
  }
}
```

### 3. Statistical Analysis

```typescript
async function analyzeScores() {
  const scores = [85, 90, 78, 92, 88, 95, 82, 89];

  const avg = await calculatorService.mean(scores);
  const med = await calculatorService.median(scores);
  const sd = await calculatorService.std(scores);

  console.log('Mean:', avg.toFixed(2));
  console.log('Median:', med.toFixed(2));
  console.log('Std Dev:', sd.toFixed(2));

  // Outliers (> 2 std devs)
  const outliers = scores.filter(s => Math.abs(s - avg) > 2 * sd);
  console.log('Outliers:', outliers);
}
```

### 4. Custom Metrics

```typescript
// Define F1 score
calculatorService.defineFunction(
  'f1',
  ['p', 'r'],
  '2 * p * r / (p + r)'
);

// Define accuracy
calculatorService.defineFunction(
  'acc',
  ['tp', 'tn', 'fp', 'fn'],
  '(tp + tn) / (tp + tn + fp + fn)'
);

// Use them
const f1 = calculatorService.callFunction('f1', [0.85, 0.90]);
const accuracy = calculatorService.callFunction('acc', [85, 90, 10, 5]);

console.log('F1:', f1.toFixed(3));
console.log('Accuracy:', accuracy.toFixed(3));
```

### 5. Unit Conversion Pipeline

```typescript
async function convertAll() {
  const conversions = [
    '100 km to mile',
    '5 kg to lb',
    '98.6 degF to degC',
    '1 gallon to liter'
  ];

  for (const expr of conversions) {
    const result = await calculatorTool.execute({ expression: expr });
    console.log(`${expr} = ${result.result}`);
  }
}
```

## Configuration

```bash
# Tool settings
CALCULATOR_ENABLED=true
CALCULATOR_PRECISION=10
CALCULATOR_MAX_EXPRESSION_LENGTH=10000

# Angle mode
CALCULATOR_ANGLE_MODE=degrees  # or 'radians'

# Feature flags
CALCULATOR_COMPLEX_NUMBERS=true
CALCULATOR_MATRICES=true
CALCULATOR_SYMBOLIC=true
```

## Supported Operations

### Basic
- Arithmetic: `+`, `-`, `*`, `/`, `^`, `%`
- Constants: `pi`, `e`
- Functions: `sqrt`, `pow`, `abs`, `log`, `ln`, `exp`

### Trigonometry
- Functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`
- Hyperbolic: `sinh`, `cosh`, `tanh`

### Statistics (arrays)
- `mean`, `median`, `std`, `variance`, `mode`
- `sum`, `min`, `max`

### Linear Algebra (matrices)
- `det` - Determinant
- `inv` - Inverse
- Matrix multiplication (service method)
- Solve linear systems (service method)

### Calculus
- `derivative(expr, var)` - Differentiation
- `simplify(expr)` - Simplification

### Vectors
- Dot product (service method)
- Norm: L1, L2, L-infinity (service method)
- Cosine similarity (service method)

### LLM Features
- Cost calculation (service method)
- Word count (service method)
- Character count (service method)
- JSON lookup (service method)

### Custom
- Define functions (service method)
- Call functions (service method)
- List functions (service method)
- Remove functions (service method)

## Response Format

```typescript
{
  result: number | string,
  expression: string,
  scope: Record<string, unknown>,
  unit?: string,
  steps?: string[]
}
```

## Error Handling

```typescript
try {
  const result = await calculatorTool.execute({
    expression: '2 + 2'
  });
  console.log('Result:', result.result);
} catch (error) {
  console.error('Error:', error.message);

  // Common errors:
  // - "ValidationError: Expression cannot be empty"
  // - "ValidationError: Expression exceeds maximum length"
  // - "ExecutionError: Invalid mathematical expression"
  // - "ValidationError: Vectors must have same length"
  // - "ExecutionError: Function X is not defined"
}
```

## Quick Tips

1. **Use arrays for statistics:** `mean([1,2,3])` not `mean(1,2,3)`
2. **Angle mode:** Default is degrees, change with `CALCULATOR_ANGLE_MODE=radians`
3. **Variables persist:** Once set, variables remain in scope
4. **Unit conversions:** Use `value unit to target_unit` format
5. **Complex numbers:** Enabled by default: `sqrt(-1)` works
6. **History tracking:** Provide userId to save calculations
7. **Custom functions:** Session-specific, not persisted
8. **Export limits:** Max 10,000 records per export

## Limitations

❌ **Not Supported:**
- Symbolic equation solving (e.g., `solve(x^2 = 4, x)`)
- Integration (only derivatives)
- Graph theory / combinatorics
- Cryptographic operations
- High-precision decimal arithmetic

✅ **Supported:**
- All basic and advanced math
- Statistics and linear algebra
- Derivatives and simplification
- Unit conversions
- Vector operations
- Custom functions

## Real-World Examples

### Example 1: Model Cost Analysis

```typescript
async function monthlyBudget() {
  const dailyTokens = 100000;
  const monthlyInput = dailyTokens * 30;
  const monthlyOutput = monthlyInput * 0.2;  // 20% output ratio

  const cost = await calculatorService.calculateCost(
    monthlyInput,
    monthlyOutput,
    'gpt-4o'
  );

  console.log('Monthly Budget (GPT-4O):');
  console.log(`  Input: ${monthlyInput.toLocaleString()} tokens`);
  console.log(`  Output: ${monthlyOutput.toLocaleString()} tokens`);
  console.log(`  Total Cost: $${cost.totalCost.toFixed(2)}`);

  if (cost.totalCost > 1000) {
    console.log('⚠️ Monthly budget exceeds $1000!');
  }
}
```

### Example 2: Evaluation Metrics

```typescript
async function evaluationReport() {
  // Define metrics
  calculatorService.defineFunction(
    'precision',
    ['tp', 'fp'],
    'tp / (tp + fp)'
  );

  calculatorService.defineFunction(
    'recall',
    ['tp', 'fn'],
    'tp / (tp + fn)'
  );

  calculatorService.defineFunction(
    'f1',
    ['p', 'r'],
    '2 * p * r / (p + r)'
  );

  // Calculate from confusion matrix
  const tp = 85, fp = 10, fn = 5, tn = 90;

  const p = calculatorService.callFunction('precision', [tp, fp]);
  const r = calculatorService.callFunction('recall', [tp, fn]);
  const f1 = calculatorService.callFunction('f1', [p, r]);

  console.log('Model Evaluation:');
  console.log(`  Precision: ${(p * 100).toFixed(1)}%`);
  console.log(`  Recall: ${(r * 100).toFixed(1)}%`);
  console.log(`  F1 Score: ${f1.toFixed(3)}`);
}
```

### Example 3: Dataset Statistics

```typescript
async function datasetSummary() {
  const dataset = {
    train: 1000,
    validation: 200,
    test: 300
  };

  const total = await calculatorTool.execute({
    expression: 'sum([1000, 200, 300])'
  });

  const trainPct = (dataset.train / total.result) * 100;
  const valPct = (dataset.validation / total.result) * 100;
  const testPct = (dataset.test / total.result) * 100;

  console.log('Dataset Split:');
  console.log(`  Train: ${dataset.train} (${trainPct.toFixed(1)}%)`);
  console.log(`  Validation: ${dataset.validation} (${valPct.toFixed(1)}%)`);
  console.log(`  Test: ${dataset.test} (${testPct.toFixed(1)}%)`);
  console.log(`  Total: ${total.result}`);
}
```

## Need More Details?

See full documentation: `/lib/tools/calculator/README.md`

## Test It

```bash
# Run tests
node test-phase1.js
node test-vectors.js
node test-cost.js
node test-custom-functions.js
node test-history.js
```
