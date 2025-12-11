# Calculator Tool

**Version:** 1.1.0
**Location:** `/lib/tools/calculator`
**Type:** Mathematical Computation
**Access:** COMPUTE + PERSIST

---

## Overview

The **Calculator Tool** provides comprehensive mathematical computation capabilities powered by mathjs, with specialized features for LLM evaluation, model cost analysis, and data science workflows. It supports everything from basic arithmetic to advanced calculus, linear algebra, statistics, and custom function definitions.

### Key Features

- **Full Math Library:** Arithmetic, algebra, trigonometry, calculus, complex numbers
- **Linear Algebra:** Matrices, determinants, inverse, linear systems
- **Statistics:** Mean, median, std, variance with array support
- **Vector Operations:** Dot product, norm (L1/L2/L-inf), cosine similarity
- **LLM Cost Calculation:** Pricing for OpenAI, Anthropic, and more
- **NLP Functions:** Word count, character count, JSON extraction
- **Custom Functions:** Define and call user-defined functions
- **Unit Conversions:** Automatic unit handling and conversion
- **Variable Support:** Assign and reuse variables across calculations
- **History Tracking:** Persistent calculation history in Supabase
- **History Analysis:** Statistical insights from calculation patterns
- **Export Capabilities:** JSON, CSV, Markdown formats

---

## What It Does

The calculator provides a single, powerful `evaluate` operation that handles all mathematical expressions:

**Main Operation:** Mathematical expression evaluation
- Basic math: `2 + 2`, `sqrt(16)`, `sin(45)`
- Statistics: `mean([1,2,3])`, `std([1,2,3,4,5])`
- Linear algebra: `det([[1,2],[3,4]])`, `inv([[1,2],[3,4]])`
- Calculus: `derivative('x^2', 'x')`, `simplify('2x + 3x')`
- Units: `5 cm to inch`, `100 mph to m/s`
- Variables: `x = 5; y = 10; x + y`

---

## Architecture

### File Structure

```
calculator/
├── index.ts                    # Tool definition and registration
├── calculator.config.ts        # Configuration and feature flags
├── calculator.service.ts       # Core computation engine
├── test-*.js/ts               # Comprehensive test suite
└── PHASE*_SUMMARY.md          # Development documentation
```

### Dependencies

- **mathjs:** Advanced mathematics library
- **Supabase Client:** History persistence and analytics
- **Node.js Math:** Built-in mathematical functions

### Database Schema

**calculator_history:**
```sql
CREATE TABLE calculator_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  expression TEXT NOT NULL,
  result TEXT NOT NULL,
  scope JSONB,
  unit TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calculator_history_user ON calculator_history(user_id);
CREATE INDEX idx_calculator_history_created ON calculator_history(created_at);
```

---

## How to Use

### Basic Usage

```typescript
import calculatorTool from '@/lib/tools/calculator';

// Simple arithmetic
const result = await calculatorTool.execute({
  expression: '2 + 2'
});
console.log(result.result);  // 4

// Advanced functions
const sqrt = await calculatorTool.execute({
  expression: 'sqrt(16)'
});
console.log(sqrt.result);  // 4

// Statistics
const avg = await calculatorTool.execute({
  expression: 'mean([1, 2, 3, 4, 5])'
});
console.log(avg.result);  // 3
```

### Direct Service Usage

```typescript
import { calculatorService } from '@/lib/tools/calculator/calculator.service';

// Evaluate with user ID for history tracking
const result = await calculatorService.evaluate('2 + 2', 'user-123');

console.log('Result:', result.result);
console.log('Expression:', result.expression);
console.log('Scope:', result.scope);
console.log('Steps:', result.steps);

// Get calculation history
const history = await calculatorService.getHistory('user-123', 20);
console.log('Recent calculations:', history);
```

---

## Capabilities

### 1. Basic Arithmetic

**Operations:** `+`, `-`, `*`, `/`, `^` (power), `%` (modulo)

```typescript
// Addition, subtraction
await calculatorTool.execute({ expression: '10 + 5 - 3' });  // 12

// Multiplication, division
await calculatorTool.execute({ expression: '4 * 5 / 2' });  // 10

// Power
await calculatorTool.execute({ expression: '2^10' });  // 1024

// Modulo
await calculatorTool.execute({ expression: '17 % 5' });  // 2

// Order of operations
await calculatorTool.execute({ expression: '2 + 3 * 4' });  // 14
```

---

### 2. Advanced Mathematics

**Functions:** sqrt, pow, abs, log, ln, exp, cbrt, ceil, floor, round

```typescript
// Square root
await calculatorTool.execute({ expression: 'sqrt(16)' });  // 4

// Power
await calculatorTool.execute({ expression: 'pow(2, 10)' });  // 1024

// Absolute value
await calculatorTool.execute({ expression: 'abs(-42)' });  // 42

// Logarithms
await calculatorTool.execute({ expression: 'log(100)' });  // 2 (log10)
await calculatorTool.execute({ expression: 'ln(2.718)' });  // ~1 (natural log)

// Exponential
await calculatorTool.execute({ expression: 'exp(1)' });  // ~2.718 (e)

// Rounding
await calculatorTool.execute({ expression: 'ceil(4.3)' });  // 5
await calculatorTool.execute({ expression: 'floor(4.9)' });  // 4
await calculatorTool.execute({ expression: 'round(4.5)' });  // 5
```

---

### 3. Trigonometry

**Functions:** sin, cos, tan, asin, acos, atan, sinh, cosh, tanh

**Default Mode:** Degrees (configurable to radians)

```typescript
// Sine, cosine, tangent
await calculatorTool.execute({ expression: 'sin(30)' });  // 0.5
await calculatorTool.execute({ expression: 'cos(60)' });  // 0.5
await calculatorTool.execute({ expression: 'tan(45)' });  // 1

// Inverse functions
await calculatorTool.execute({ expression: 'asin(0.5)' });  // 30
await calculatorTool.execute({ expression: 'acos(0.5)' });  // 60
await calculatorTool.execute({ expression: 'atan(1)' });  // 45

// Hyperbolic functions
await calculatorTool.execute({ expression: 'sinh(0)' });  // 0
await calculatorTool.execute({ expression: 'cosh(0)' });  // 1
```

---

### 4. Statistics

**Functions:** mean, median, std, variance, mode, sum, min, max

```typescript
// Mean (average)
await calculatorTool.execute({ expression: 'mean([1, 2, 3, 4, 5])' });  // 3

// Median (middle value)
await calculatorTool.execute({ expression: 'median([1, 2, 3, 4, 5])' });  // 3

// Standard deviation
await calculatorTool.execute({ expression: 'std([1, 2, 3, 4, 5])' });  // ~1.414

// Variance
await calculatorTool.execute({ expression: 'variance([1, 2, 3, 4, 5])' });  // 2

// Sum
await calculatorTool.execute({ expression: 'sum([1, 2, 3, 4, 5])' });  // 15

// Min and max
await calculatorTool.execute({ expression: 'min([5, 2, 8, 1, 9])' });  // 1
await calculatorTool.execute({ expression: 'max([5, 2, 8, 1, 9])' });  // 9
```

---

### 5. Linear Algebra

**Operations:** Matrices, determinants, inverse, multiplication, linear systems

```typescript
// Matrix determinant
await calculatorTool.execute({
  expression: 'det([[1, 2], [3, 4]])'
});  // -2

// Matrix inverse
await calculatorTool.execute({
  expression: 'inv([[1, 2], [3, 4]])'
});  // [[-2, 1], [1.5, -0.5]]

// Matrix multiplication
const result = await calculatorService.matrixMultiply(
  [[1, 2], [3, 4]],
  [[5, 6], [7, 8]]
);  // [[19, 22], [43, 50]]

// Solve linear system Ax = b
const solution = await calculatorService.solveLinearSystem(
  [[2, 1], [1, 3]],  // A
  [8, 11]            // b
);  // x = [3, 2]
```

---

### 6. Calculus

**Operations:** Derivative, simplification

```typescript
// Derivative
await calculatorTool.execute({
  expression: 'derivative("x^2", "x")'
});  // 2x

await calculatorTool.execute({
  expression: 'derivative("3x^2 + 2x + 1", "x")'
});  // 6x + 2

// Simplify expressions
await calculatorTool.execute({
  expression: 'simplify("2x + 3x")'
});  // 5x

await calculatorTool.execute({
  expression: 'simplify("x^2 - 1")'
});  // x^2 - 1
```

---

### 7. Vector Operations (LLM-Specific)

**Functions:** Dot product, norm, cosine similarity

```typescript
// Dot product (embedding similarity)
const dot = await calculatorService.dotProduct(
  [1, 2, 3],
  [4, 5, 6]
);  // 32

// Vector norm (magnitude)
const norm = await calculatorService.vectorNorm([3, 4]);  // 5 (L2 norm)
const l1 = await calculatorService.vectorNorm([3, 4], 1);  // 7 (L1 norm)
const linf = await calculatorService.vectorNorm([3, 4], 'inf');  // 4 (L-infinity)

// Cosine similarity (range: -1 to 1)
const similarity = await calculatorService.cosineSimilarity(
  [1, 2, 3],
  [4, 5, 6]
);  // 0.974...
```

**Use Cases:**
- Compare text embeddings
- Calculate semantic similarity
- Evaluate vector similarity
- Normalize embeddings

---

### 8. LLM Cost Calculation

**Models Supported:** OpenAI (GPT-4, GPT-3.5), Anthropic (Claude 3)

```typescript
// Calculate cost for GPT-4O
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
  breakdown: 'Input: 1000 tokens ($0.005000) + Output: 500 tokens ($0.007500) = $0.012500'
}
*/

// Compare models
const gpt4 = await calculatorService.calculateCost(10000, 5000, 'gpt-4');
const gpt4o = await calculatorService.calculateCost(10000, 5000, 'gpt-4o');
const claude = await calculatorService.calculateCost(10000, 5000, 'claude-3-sonnet');

console.log('GPT-4:', gpt4.totalCost);        // $0.60
console.log('GPT-4O:', gpt4o.totalCost);      // $0.125
console.log('Claude Sonnet:', claude.totalCost);  // $0.105
```

**Model Pricing (per 1M tokens):**

| Model | Input | Output |
|-------|-------|--------|
| GPT-4O | $5.00 | $15.00 |
| GPT-4O Mini | $0.15 | $0.60 |
| GPT-4 | $30.00 | $60.00 |
| GPT-3.5 Turbo | $0.50 | $1.50 |
| Claude 3.5 Sonnet | $3.00 | $15.00 |
| Claude 3 Opus | $15.00 | $75.00 |
| Claude 3 Haiku | $0.25 | $1.25 |

---

### 9. NLP Functions

**Functions:** Word count, character count, JSON lookup

```typescript
// Word count
const words = await calculatorService.wordCount('Hello world, how are you?');
console.log(words);  // 5

// Character count
const chars = await calculatorService.charCount('Hello world', true);  // 11 (with spaces)
const charsNoSpace = await calculatorService.charCount('Hello world', false);  // 10

// JSON lookup (extract values from JSON strings)
const data = '{"data": {"score": 95, "category": "A"}}';
const score = await calculatorService.jsonLookup(data, 'data.score');
console.log(score);  // 95

const category = await calculatorService.jsonLookup(data, 'data.category');
console.log(category);  // 'A'
```

**Use Cases:**
- Analyze LLM response length
- Extract metrics from structured outputs
- Count tokens (approximate)
- Parse JSON API responses

---

### 10. Unit Conversions

**Automatic unit handling and conversion**

```typescript
// Length conversions
await calculatorTool.execute({ expression: '5 cm to inch' });  // 1.968...
await calculatorTool.execute({ expression: '10 m to ft' });    // 32.808...
await calculatorTool.execute({ expression: '1 km to mile' });  // 0.621...

// Speed conversions
await calculatorTool.execute({ expression: '100 mph to m/s' });  // 44.704
await calculatorTool.execute({ expression: '60 km/h to mph' });  // 37.282

// Mass conversions
await calculatorTool.execute({ expression: '1 kg to lb' });  // 2.204...
await calculatorTool.execute({ expression: '16 oz to gram' });  // 453.592

// Temperature conversions
await calculatorTool.execute({ expression: '32 degF to degC' });  // 0
await calculatorTool.execute({ expression: '100 degC to degF' });  // 212

// Volume conversions
await calculatorTool.execute({ expression: '1 gallon to liter' });  // 3.785...
await calculatorTool.execute({ expression: '1000 ml to cup' });  // 4.226...
```

---

### 11. Variables and Scope

**Assign and reuse variables across calculations**

```typescript
// Variable assignment
const result1 = await calculatorService.evaluate('x = 5');
const result2 = await calculatorService.evaluate('y = 10');
const result3 = await calculatorService.evaluate('x + y');

console.log(result3.result);  // 15
console.log(result3.scope);   // { x: 5, y: 10 }

// Multi-line calculations
const expr = 'a = 10; b = 20; c = a * b; c + 100';
const result = await calculatorService.evaluate(expr);
console.log(result.result);  // 300

// Variables persist in the session scope
console.log(result.scope);  // { a: 10, b: 20, c: 200 }
```

---

### 12. Custom Functions

**Define, call, list, and remove user-defined functions**

```typescript
// Define a custom function
calculatorService.defineFunction(
  'f1Score',                    // Function name
  ['precision', 'recall'],      // Parameters
  '2 * precision * recall / (precision + recall)',  // Body
  'Calculate F1 score from precision and recall'    // Description (optional)
);

// Call the function
const f1 = calculatorService.callFunction('f1Score', [0.8, 0.9]);
console.log(f1);  // 0.847...

// List all custom functions
const functions = calculatorService.listCustomFunctions();
console.log(functions);
/*
[
  {
    name: 'f1Score',
    params: ['precision', 'recall'],
    body: '2 * precision * recall / (precision + recall)',
    description: 'Calculate F1 score from precision and recall'
  }
]
*/

// Remove a function
calculatorService.removeFunction('f1Score');
```

**Use Cases:**
- Define domain-specific metrics
- Create reusable calculation templates
- Build custom evaluation functions
- Simplify complex calculations

---

### 13. History Tracking

**Automatic persistence to Supabase**

```typescript
// Calculations are automatically saved when userId is provided
const result = await calculatorService.evaluate(
  'mean([85, 90, 92, 88])',
  'user-123'  // userId triggers history save
);

// Fetch calculation history
const history = await calculatorService.getHistory('user-123', 20);
console.log(history);
/*
[
  {
    id: 'uuid',
    user_id: 'user-123',
    expression: 'mean([85, 90, 92, 88])',
    result: '88.75',
    scope: '{}',
    unit: null,
    created_at: '2025-10-22T12:00:00Z'
  },
  ...
]
*/
```

---

### 14. History Analysis

**Statistical insights from calculation patterns**

```typescript
const stats = await calculatorService.getHistoryStats('user-123');

console.log(stats);
/*
{
  totalCalculations: 145,
  uniqueExpressions: 98,
  mostCommonOperations: [
    { operation: 'statistics', count: 45 },
    { operation: 'arithmetic', count: 38 },
    { operation: 'vectors', count: 22 },
    { operation: 'cost_analysis', count: 18 },
    { operation: 'trigonometry', count: 12 }
  ],
  dateRange: {
    earliest: '2025-10-01T10:30:00Z',
    latest: '2025-10-22T14:20:00Z'
  },
  errorRate: 0.034  // 3.4% of calculations resulted in errors
}
*/
```

**Operation Categories:**
- `statistics` - mean, std, variance, median
- `linear_algebra` - matrices, determinants
- `calculus` - derivatives, simplification
- `vectors` - dot product, cosine similarity, norms
- `cost_analysis` - LLM cost calculations
- `nlp` - word count, char count, JSON lookup
- `trigonometry` - sin, cos, tan
- `advanced_math` - log, exp, sqrt
- `arithmetic` - +, -, *, /
- `other` - everything else

---

### 15. Export Capabilities

**Export history in JSON, CSV, or Markdown formats**

```typescript
// Export as JSON
const json = await calculatorService.exportResults('user-123', 'json', 100);
console.log(json);  // JSON string with 100 most recent calculations

// Export as CSV (for Excel, Google Sheets)
const csv = await calculatorService.exportResults('user-123', 'csv', 50);
console.log(csv);
/*
id,user_id,expression,result,scope,unit,created_at
uuid1,user-123,2+2,4,{},null,2025-10-22T12:00:00Z
uuid2,user-123,sqrt(16),4,{},null,2025-10-22T12:01:00Z
...
*/

// Export as Markdown (for documentation)
const markdown = await calculatorService.exportResults('user-123', 'markdown', 20);
console.log(markdown);
/*
| id | user_id | expression | result | scope | unit | created_at |
| --- | --- | --- | --- | --- | --- | --- |
| uuid1 | user-123 | 2+2 | 4 | {} | null | 2025-10-22T12:00:00Z |
| uuid2 | user-123 | sqrt(16) | 4 | {} | null | 2025-10-22T12:01:00Z |
...
*/
```

**Use Cases:**
- Analytics and BI integration
- Audit trails
- Documentation generation
- Data export for external tools

---

## Configuration

### Environment Variables

```bash
# Tool Enable/Disable
CALCULATOR_ENABLED=true

# Precision and limits
CALCULATOR_PRECISION=10
CALCULATOR_MAX_EXPRESSION_LENGTH=10000
CALCULATOR_MAX_ITERATIONS=1000
CALCULATOR_MAX_RECURSION=10

# Angle mode for trigonometry
CALCULATOR_ANGLE_MODE=degrees  # or 'radians'

# Feature flags (all enabled by default)
CALCULATOR_COMPLEX_NUMBERS=true
CALCULATOR_MATRICES=true
CALCULATOR_SYMBOLIC=true
```

### Runtime Configuration

```typescript
import { calculatorConfig } from '@/lib/tools/calculator/calculator.config';

console.log('Precision:', calculatorConfig.precision);
console.log('Angle mode:', calculatorConfig.angleMode);
console.log('Max expression length:', calculatorConfig.maxExpressionLength);
```

---

## When to Use

### ✅ Use Calculator When:

1. **Mathematical Computations**
   - Basic to advanced math operations
   - Statistical calculations
   - Trigonometric functions
   - Algebraic simplification

2. **LLM Evaluation**
   - Calculate model costs
   - Compare embedding similarity
   - Analyze vector distances
   - Cost-benefit analysis

3. **Data Science**
   - Statistical analysis (mean, std, variance)
   - Linear algebra operations
   - Vector computations
   - Data transformations

4. **Unit Conversions**
   - Length, speed, mass conversions
   - Temperature conversions
   - Volume, area calculations

5. **NLP Tasks**
   - Count words and characters
   - Extract JSON values
   - Text metrics

6. **Custom Metrics**
   - Define domain-specific functions
   - Reusable calculations
   - Complex formulas

---

## When NOT to Use

### ❌ Do NOT Use Calculator When:

1. **Symbolic Equation Solving Needed**
   - **Limitation:** Derivative and simplify only, no solve()
   - **Alternative:** Use WolframAlpha API or SymPy
   - **Why:** mathjs doesn't support full symbolic solving

2. **High-Precision Financial Calculations**
   - **Limitation:** Floating-point arithmetic (IEEE 754)
   - **Alternative:** Use decimal.js or BigNumber libraries
   - **Why:** May have rounding errors for currency

3. **Integration/Advanced Calculus**
   - **Limitation:** Only derivatives supported
   - **Alternative:** Use WolframAlpha or numerical libraries
   - **Why:** mathjs doesn't support integration

4. **Graph Theory or Combinatorics**
   - **Limitation:** No graph algorithms
   - **Alternative:** Use specialized libraries (graph-js)
   - **Why:** Tool focused on numerical/analytical math

5. **Cryptographic Operations**
   - **Limitation:** Not designed for crypto
   - **Alternative:** Use crypto libraries
   - **Why:** Security-critical operations need dedicated tools

6. **3D Graphics/Transformations**
   - **Limitation:** Basic linear algebra only
   - **Alternative:** Use gl-matrix, three.js
   - **Why:** No quaternions, specialized 3D ops

---

## Common Workflows

### 1. LLM Cost Analysis

```typescript
async function analyzeLLMCosts() {
  // Compare costs across models
  const models = ['gpt-4', 'gpt-4o', 'claude-3-sonnet', 'gpt-4o-mini'];
  const inputTokens = 50000;
  const outputTokens = 10000;

  console.log('Cost comparison for 50k input + 10k output tokens:\n');

  for (const model of models) {
    const cost = await calculatorService.calculateCost(
      inputTokens,
      outputTokens,
      model
    );

    console.log(`${model}:`);
    console.log(`  Total: $${cost.totalCost}`);
    console.log(`  Breakdown: ${cost.breakdown}\n`);
  }

  // Monthly cost projection
  const dailyTokens = 100000;
  const monthlyTokens = dailyTokens * 30;

  const monthlyGPT4O = await calculatorService.calculateCost(
    monthlyTokens,
    monthlyTokens * 0.2,  // 20% output ratio
    'gpt-4o'
  );

  console.log(`Monthly projected cost (GPT-4O): $${monthlyGPT4O.totalCost}`);
}
```

---

### 2. Embedding Similarity Analysis

```typescript
async function compareEmbeddings() {
  const embedding1 = [0.1, 0.2, 0.3, 0.4, 0.5];  // Query embedding
  const embedding2 = [0.15, 0.25, 0.32, 0.38, 0.48];  // Document embedding
  const embedding3 = [0.9, 0.8, 0.1, 0.2, 0.3];  // Unrelated document

  // Calculate similarities
  const sim1 = await calculatorService.cosineSimilarity(embedding1, embedding2);
  const sim2 = await calculatorService.cosineSimilarity(embedding1, embedding3);

  console.log('Query vs Related Doc:', sim1.toFixed(3));      // High similarity
  console.log('Query vs Unrelated Doc:', sim2.toFixed(3));   // Low similarity

  // Threshold-based matching
  const SIMILARITY_THRESHOLD = 0.8;
  if (sim1 > SIMILARITY_THRESHOLD) {
    console.log('Document 1 is highly relevant');
  }
}
```

---

### 3. Statistical Data Analysis

```typescript
async function analyzeDataset() {
  const scores = [85, 90, 78, 92, 88, 95, 82, 89];

  // Calculate statistics
  const avg = await calculatorService.mean(scores);
  const med = await calculatorService.median(scores);
  const stdDev = await calculatorService.std(scores);
  const variance = await calculatorService.variance(scores);

  console.log('Dataset Analysis:');
  console.log(`  Mean: ${avg.toFixed(2)}`);
  console.log(`  Median: ${med.toFixed(2)}`);
  console.log(`  Std Dev: ${stdDev.toFixed(2)}`);
  console.log(`  Variance: ${variance.toFixed(2)}`);

  // Identify outliers (values > 2 std devs from mean)
  const outliers = scores.filter(score =>
    Math.abs(score - avg) > 2 * stdDev
  );

  console.log(`  Outliers: ${outliers.join(', ')}`);
}
```

---

### 4. Custom Evaluation Metrics

```typescript
async function setupCustomMetrics() {
  // Define F1 score
  calculatorService.defineFunction(
    'f1Score',
    ['precision', 'recall'],
    '2 * precision * recall / (precision + recall)',
    'F1 score for binary classification'
  );

  // Define accuracy
  calculatorService.defineFunction(
    'accuracy',
    ['tp', 'tn', 'fp', 'fn'],
    '(tp + tn) / (tp + tn + fp + fn)',
    'Classification accuracy'
  );

  // Use the functions
  const f1 = calculatorService.callFunction('f1Score', [0.85, 0.90]);
  const acc = calculatorService.callFunction('accuracy', [85, 90, 10, 5]);

  console.log('F1 Score:', f1.toFixed(3));
  console.log('Accuracy:', acc.toFixed(3));

  // List all custom functions
  const functions = calculatorService.listCustomFunctions();
  console.log('\nDefined Functions:');
  functions.forEach(fn => {
    console.log(`  ${fn.name}(${fn.params.join(', ')})`);
    console.log(`    ${fn.description}`);
  });
}
```

---

### 5. Unit Conversion Pipeline

```typescript
async function convertUnits() {
  const conversions = [
    { value: 100, from: 'km', to: 'mile' },
    { value: 5, from: 'kg', to: 'lb' },
    { value: 98.6, from: 'degF', to: 'degC' },
    { value: 1, from: 'gallon', to: 'liter' }
  ];

  console.log('Unit Conversions:');
  for (const conv of conversions) {
    const result = await calculatorTool.execute({
      expression: `${conv.value} ${conv.from} to ${conv.to}`
    });

    console.log(`  ${conv.value} ${conv.from} = ${result.result}`);
  }
}
```

---

## Troubleshooting

### Issue: "Expression exceeds maximum length"

**Error:** `ValidationError: Expression exceeds maximum length`

**Cause:** Expression longer than configured limit (default: 10,000 chars)

**Solution:**
```bash
# Increase limit
CALCULATOR_MAX_EXPRESSION_LENGTH=50000
```

---

### Issue: "Invalid mathematical expression"

**Error:** `ExecutionError: Invalid mathematical expression`

**Cause:** Syntax error or unsupported operation

**Solution:** Check expression syntax
```typescript
// ❌ Bad
{ expression: 'sin(' }  // Unclosed parenthesis

// ✅ Good
{ expression: 'sin(45)' }
```

---

### Issue: "Function X is not defined"

**Error:** `ExecutionError: Function "X" is not defined`

**Cause:** Calling custom function before defining it

**Solution:**
```typescript
// Define before calling
calculatorService.defineFunction('myFunc', ['x'], 'x^2 + 1');
const result = calculatorService.callFunction('myFunc', [5]);
```

---

### Issue: "Vectors must have same length"

**Error:** `ValidationError: Vectors must have same length for dot product`

**Cause:** Vector dimension mismatch

**Solution:**
```typescript
// Ensure vectors have same length
const vec1 = [1, 2, 3];
const vec2 = [4, 5, 6];  // Same length as vec1
const dot = await calculatorService.dotProduct(vec1, vec2);
```

---

### Issue: "Cannot convert to unit"

**Error:** `ExecutionError: Cannot convert to unit 'X'`

**Cause:** Invalid unit or incompatible conversion

**Solution:**
```typescript
// ❌ Bad - incompatible units
{ expression: '5 kg to meter' }  // Mass to length

// ✅ Good - compatible units
{ expression: '5 kg to lb' }     // Mass to mass
```

---

## Testing

```bash
# Run test suite
cd /lib/tools/calculator
node test-phase1.js        # Basic tests
node test-vectors.js       # Vector operations
node test-cost.js          # Cost calculations
node test-nlp.js           # NLP functions
node test-custom-functions.js  # Custom functions
node test-history.js       # History tracking
node test-export.js        # Export functionality
```

---

## Performance

| Operation Type | Typical Time | Notes |
|----------------|--------------|-------|
| Basic arithmetic | <1ms | Native JS math |
| Statistics (100 values) | 1-2ms | mathjs functions |
| Matrix operations (3x3) | 2-5ms | mathjs linear algebra |
| Vector similarity | 1-3ms | Dot product + norm |
| History save | 50-100ms | Supabase insert |
| History fetch (20 records) | 50-150ms | Supabase query |
| Export (100 records) | 100-300ms | Formatting overhead |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Oct 10, 2025 | Initial implementation with basic math |
| 1.1.0 | Oct 22, 2025 | Added vectors, cost calc, NLP, custom functions, history analysis, export |

---

**Last Updated:** October 22, 2025
**Maintained By:** FineTune Lab Development Team
