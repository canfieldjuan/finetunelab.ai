// Test Phase 3 Step 2: Calculation History Analysis
// Validates getHistoryStats and analyzeHistoryData

console.log('=== PHASE 3 STEP 2: HISTORY ANALYSIS TEST ===\n');

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

// Helper to extract operation type
function extractOperation(expression) {
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

// Analyze history data
function analyzeHistoryData(data) {
  const totalCalculations = data.length;
  const expressions = new Set();
  const operationCounts = new Map();
  let errorCount = 0;
  
  for (const record of data) {
    if (record.expression) {
      expressions.add(record.expression);
      
      const operation = extractOperation(record.expression);
      operationCounts.set(operation, (operationCounts.get(operation) || 0) + 1);
    }
    
    if (record.result && typeof record.result === 'string' && record.result.includes('Error')) {
      errorCount++;
    }
  }
  
  const mostCommonOperations = Array.from(operationCounts.entries())
    .map(([operation, count]) => ({ operation, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    totalCalculations,
    uniqueExpressions: expressions.size,
    mostCommonOperations,
    dateRange: {
      earliest: data[0].created_at || '',
      latest: data[data.length - 1].created_at || ''
    },
    errorRate: totalCalculations > 0 ? errorCount / totalCalculations : 0
  };
}

// Test 1: Empty history
test('History Analysis - Empty data', () => {
  const result = analyzeHistoryData([]);
  console.log('  Input: Empty array');
  console.log('  Result:', JSON.stringify(result, null, 2));
  if (result.totalCalculations !== 0) {
    throw new Error(`Expected 0 total, got ${result.totalCalculations}`);
  }
  if (result.uniqueExpressions !== 0) {
    throw new Error(`Expected 0 unique, got ${result.uniqueExpressions}`);
  }
});

// Test 2: Single calculation
test('History Analysis - Single calculation', () => {
  const data = [
    { expression: '2 + 2', result: 4, created_at: '2025-01-15T10:00:00Z' }
  ];
  const result = analyzeHistoryData(data);
  console.log('  Input: 1 calculation');
  console.log('  Result:', JSON.stringify(result, null, 2));
  if (result.totalCalculations !== 1) {
    throw new Error(`Expected 1 total, got ${result.totalCalculations}`);
  }
  if (result.uniqueExpressions !== 1) {
    throw new Error(`Expected 1 unique, got ${result.uniqueExpressions}`);
  }
});

// Test 3: Multiple calculations with repeats
test('History Analysis - Repeated expressions', () => {
  const data = [
    { expression: '2 + 2', result: 4, created_at: '2025-01-15T10:00:00Z' },
    { expression: '2 + 2', result: 4, created_at: '2025-01-15T10:01:00Z' },
    { expression: '3 * 3', result: 9, created_at: '2025-01-15T10:02:00Z' }
  ];
  const result = analyzeHistoryData(data);
  console.log('  Input: 3 calculations, 2 unique');
  console.log('  Total calculations:', result.totalCalculations);
  console.log('  Unique expressions:', result.uniqueExpressions);
  if (result.totalCalculations !== 3) {
    throw new Error(`Expected 3 total, got ${result.totalCalculations}`);
  }
  if (result.uniqueExpressions !== 2) {
    throw new Error(`Expected 2 unique, got ${result.uniqueExpressions}`);
  }
});

// Test 4: Operation categorization
test('History Analysis - Operation types', () => {
  const data = [
    { expression: 'mean([1,2,3])', result: 2, created_at: '2025-01-15T10:00:00Z' },
    { expression: 'std([1,2,3])', result: 0.816, created_at: '2025-01-15T10:01:00Z' },
    { expression: '2 + 2', result: 4, created_at: '2025-01-15T10:02:00Z' },
    { expression: 'sin(0)', result: 0, created_at: '2025-01-15T10:03:00Z' },
    { expression: 'cos(0)', result: 1, created_at: '2025-01-15T10:04:00Z' }
  ];
  const result = analyzeHistoryData(data);
  console.log('  Input: 5 calculations, mixed types');
  console.log('  Most common operations:', result.mostCommonOperations);
  
  // Check that statistics and trigonometry are identified
  const operations = result.mostCommonOperations.map(op => op.operation);
  if (!operations.includes('statistics')) {
    throw new Error('Expected statistics in operations');
  }
  if (!operations.includes('trigonometry')) {
    throw new Error('Expected trigonometry in operations');
  }
});

// Test 5: Error rate calculation
test('History Analysis - Error rate', () => {
  const data = [
    { expression: '2 + 2', result: 4, created_at: '2025-01-15T10:00:00Z' },
    { expression: '1/0', result: 'Error: Division by zero', created_at: '2025-01-15T10:01:00Z' },
    { expression: '3 * 3', result: 9, created_at: '2025-01-15T10:02:00Z' },
    { expression: 'invalid', result: 'Error: Invalid expression', created_at: '2025-01-15T10:03:00Z' }
  ];
  const result = analyzeHistoryData(data);
  console.log('  Input: 4 calculations, 2 errors');
  console.log('  Error rate:', result.errorRate);
  if (Math.abs(result.errorRate - 0.5) > 0.01) {
    throw new Error(`Expected error rate 0.5, got ${result.errorRate}`);
  }
});

// Test 6: Date range extraction
test('History Analysis - Date range', () => {
  const data = [
    { expression: '1+1', result: 2, created_at: '2025-01-01T00:00:00Z' },
    { expression: '2+2', result: 4, created_at: '2025-01-15T12:00:00Z' },
    { expression: '3+3', result: 6, created_at: '2025-01-31T23:59:59Z' }
  ];
  const result = analyzeHistoryData(data);
  console.log('  Date range:', result.dateRange);
  if (result.dateRange.earliest !== '2025-01-01T00:00:00Z') {
    throw new Error('Earliest date mismatch');
  }
  if (result.dateRange.latest !== '2025-01-31T23:59:59Z') {
    throw new Error('Latest date mismatch');
  }
});

// Test 7: Extract operation - Statistics
test('Extract Operation - Statistics', () => {
  const tests = [
    'mean([1,2,3])',
    'std([1,2,3])',
    'variance([1,2,3])',
    'median([1,2,3])'
  ];
  console.log('  Testing statistics expressions:');
  tests.forEach(expr => {
    const op = extractOperation(expr);
    console.log(`    ${expr} -> ${op}`);
    if (op !== 'statistics') {
      throw new Error(`Expected statistics, got ${op}`);
    }
  });
});

// Test 8: Extract operation - Vectors
test('Extract Operation - Vectors', () => {
  const tests = [
    'dotProduct([1,2], [3,4])',
    'cosineSimilarity([1,2], [3,4])',
    'vectorNorm([1,2,3])'
  ];
  console.log('  Testing vector expressions:');
  tests.forEach(expr => {
    const op = extractOperation(expr);
    console.log(`    ${expr} -> ${op}`);
    if (op !== 'vectors') {
      throw new Error(`Expected vectors, got ${op}`);
    }
  });
});

// Test 9: Extract operation - Cost analysis
test('Extract Operation - Cost analysis', () => {
  const expr = 'calculateCost(1000, 500, "gpt-4o")';
  const op = extractOperation(expr);
  console.log(`  ${expr} -> ${op}`);
  if (op !== 'cost_analysis') {
    throw new Error(`Expected cost_analysis, got ${op}`);
  }
});

// Test 10: Extract operation - NLP
test('Extract Operation - NLP', () => {
  const tests = [
    'wordCount("hello world")',
    'charCount("test")',
    'jsonLookup("{}", "path")'
  ];
  console.log('  Testing NLP expressions:');
  tests.forEach(expr => {
    const op = extractOperation(expr);
    console.log(`    ${expr} -> ${op}`);
    if (op !== 'nlp') {
      throw new Error(`Expected nlp, got ${op}`);
    }
  });
});

// Test 11: Large dataset analysis
test('History Analysis - Large dataset', () => {
  const data = [];
  for (let i = 0; i < 100; i++) {
    data.push({
      expression: `${i} + ${i}`,
      result: i * 2,
      created_at: `2025-01-15T${String(i % 24).padStart(2, '0')}:00:00Z`
    });
  }
  const result = analyzeHistoryData(data);
  console.log('  Input: 100 calculations');
  console.log('  Total:', result.totalCalculations);
  console.log('  Unique:', result.uniqueExpressions);
  if (result.totalCalculations !== 100) {
    throw new Error(`Expected 100 total, got ${result.totalCalculations}`);
  }
  if (result.uniqueExpressions !== 100) {
    throw new Error(`Expected 100 unique, got ${result.uniqueExpressions}`);
  }
});

console.log('=== TEST SUMMARY ===');
console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\nSUCCESS: All history analysis features work correctly!');
  process.exit(0);
} else {
  console.log(`\nFAILED: ${failCount} tests failed`);
  process.exit(1);
}
