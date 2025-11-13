// Test Phase 2 Step 2: Cost Calculation Function
// Validates LLM cost calculation for different models

console.log('=== PHASE 2 STEP 2: COST CALCULATION TEST ===\n');

let passCount = 0;
let failCount = 0;

function test(name, testFn) {
  try {
    testFn();
    console.log(`PASS: ${name}\n`);
    passCount++;
    return true;
  } catch (error) {
    console.log(`FAIL: ${name}`);
    console.log(`  Error: ${error.message}\n`);
    failCount++;
    return false;
  }
}

// Model pricing (per 1M tokens)
const MODEL_PRICING = {
  'gpt-4o': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.150, output: 0.600 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'default': { input: 1.00, output: 2.00 }
};

function calculateCost(inputTokens, outputTokens, modelName) {
  if (typeof inputTokens !== 'number' || inputTokens < 0) {
    throw new Error('inputTokens must be a non-negative number');
  }
  if (typeof outputTokens !== 'number' || outputTokens < 0) {
    throw new Error('outputTokens must be a non-negative number');
  }
  
  const normalizedModel = modelName.toLowerCase().trim();
  const pricing = MODEL_PRICING[normalizedModel] || MODEL_PRICING['default'];
  
  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  const totalCost = inputCost + outputCost;
  
  return {
    inputCost: Number(inputCost.toFixed(6)),
    outputCost: Number(outputCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6)),
    model: modelName,
    breakdown: `In: ${inputTokens} tok ($${inputCost.toFixed(6)}) + Out: ${outputTokens} tok ($${outputCost.toFixed(6)}) = $${totalCost.toFixed(6)}`
  };
}

// Test 1: GPT-4o cost calculation
test('GPT-4o - 1000 input, 500 output tokens', () => {
  const result = calculateCost(1000, 500, 'gpt-4o');
  console.log('  Model: gpt-4o');
  console.log('  Input: 1000 tokens, Output: 500 tokens');
  console.log('  Total Cost:', result.totalCost);
  const expected = (1000/1000000 * 5.00) + (500/1000000 * 15.00);
  if (Math.abs(result.totalCost - expected) > 0.000001) {
    throw new Error(`Expected ${expected}, got ${result.totalCost}`);
  }
});

// Test 2: GPT-4o-mini cost calculation
test('GPT-4o-mini - 10000 input, 5000 output tokens', () => {
  const result = calculateCost(10000, 5000, 'gpt-4o-mini');
  console.log('  Model: gpt-4o-mini');
  console.log('  Input: 10000 tokens, Output: 5000 tokens');
  console.log('  Total Cost:', result.totalCost);
  const expected = (10000/1000000 * 0.150) + (5000/1000000 * 0.600);
  if (Math.abs(result.totalCost - expected) > 0.000001) {
    throw new Error(`Expected ${expected}, got ${result.totalCost}`);
  }
});

// Test 3: Claude model
test('Claude 3.5 Sonnet - 5000 input, 2000 output tokens', () => {
  const result = calculateCost(5000, 2000, 'claude-3-5-sonnet-20241022');
  console.log('  Model: claude-3-5-sonnet-20241022');
  console.log('  Input: 5000 tokens, Output: 2000 tokens');
  console.log('  Total Cost:', result.totalCost);
  const expected = (5000/1000000 * 3.00) + (2000/1000000 * 15.00);
  if (Math.abs(result.totalCost - expected) > 0.000001) {
    throw new Error(`Expected ${expected}, got ${result.totalCost}`);
  }
});

// Test 4: Unknown model falls back to default
test('Unknown model - uses default pricing', () => {
  const result = calculateCost(1000, 1000, 'unknown-model');
  console.log('  Model: unknown-model (falls back to default)');
  console.log('  Input: 1000 tokens, Output: 1000 tokens');
  console.log('  Total Cost:', result.totalCost);
  const expected = (1000/1000000 * 1.00) + (1000/1000000 * 2.00);
  if (Math.abs(result.totalCost - expected) > 0.000001) {
    throw new Error(`Expected ${expected}, got ${result.totalCost}`);
  }
});

// Test 5: Zero tokens
test('Zero tokens - returns $0', () => {
  const result = calculateCost(0, 0, 'gpt-4o');
  console.log('  Model: gpt-4o');
  console.log('  Input: 0 tokens, Output: 0 tokens');
  console.log('  Total Cost:', result.totalCost);
  if (result.totalCost !== 0) {
    throw new Error(`Expected 0, got ${result.totalCost}`);
  }
});

// Test 6: Case insensitivity
test('Case insensitive model name', () => {
  const result = calculateCost(1000, 1000, 'GPT-4O');
  console.log('  Model: GPT-4O (uppercase)');
  console.log('  Total Cost:', result.totalCost);
  const expected = (1000/1000000 * 5.00) + (1000/1000000 * 15.00);
  if (Math.abs(result.totalCost - expected) > 0.000001) {
    throw new Error(`Expected ${expected}, got ${result.totalCost}`);
  }
});

// Test 7: Error handling - negative tokens
test('Error: Negative input tokens', () => {
  try {
    calculateCost(-1000, 500, 'gpt-4o');
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw:', error.message);
    if (!error.message.includes('non-negative')) throw error;
  }
});

console.log('=== TEST SUMMARY ===');
console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\nSUCCESS: Cost calculation function works correctly!');
  process.exit(0);
} else {
  console.log(`\nFAILED: ${failCount} tests failed`);
  process.exit(1);
}
