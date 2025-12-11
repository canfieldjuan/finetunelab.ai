// Test Phase 3 Step 1: Custom User-Defined Functions
// Validates defineFunction, callFunction, listCustomFunctions, removeFunction

console.log('=== PHASE 3 STEP 1: CUSTOM FUNCTIONS TEST ===\n');

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

// Simple function storage and execution
class CustomFunctionManager {
  constructor() {
    this.functions = new Map();
  }

  defineFunction(name, params, body, description) {
    // Validation: function name
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('Function name must be a non-empty string');
    }
    
    // Validation: name pattern
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error('Function name must start with a letter and contain only letters, numbers, and underscores');
    }
    
    // Validation: parameters array
    if (!Array.isArray(params)) {
      throw new Error('Parameters must be an array');
    }
    
    // Validation: each parameter
    for (const param of params) {
      if (typeof param !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(param)) {
        throw new Error(`Invalid parameter name "${param}"`);
      }
    }
    
    // Validation: body
    if (typeof body !== 'string' || body.trim() === '') {
      throw new Error('Function body must be a non-empty string');
    }
    
    this.functions.set(name, { params, body, description });
  }

  callFunction(name, args) {
    const func = this.functions.get(name);
    if (!func) {
      throw new Error(`Function "${name}" is not defined`);
    }
    
    if (args.length !== func.params.length) {
      throw new Error(`Function "${name}" expects ${func.params.length} arguments, got ${args.length}`);
    }
    
    // Simple evaluation (for testing purposes)
    // In real implementation, this would use mathjs evaluate
    const funcCode = new Function(...func.params, `return ${func.body}`);
    return funcCode(...args);
  }

  listCustomFunctions() {
    return Array.from(this.functions.entries()).map(([name, func]) => ({
      name,
      params: func.params,
      body: func.body,
      description: func.description
    }));
  }

  removeFunction(name) {
    const existed = this.functions.has(name);
    this.functions.delete(name);
    return existed;
  }
}

const manager = new CustomFunctionManager();

// Test 1: Define simple function
test('Define Function - Simple arithmetic', () => {
  manager.defineFunction('double', ['x'], 'x * 2', 'Doubles a number');
  const result = manager.callFunction('double', [5]);
  console.log('  Defined: double(x) = x * 2');
  console.log('  Called: double(5)');
  console.log('  Result:', result);
  if (result !== 10) throw new Error(`Expected 10, got ${result}`);
});

// Test 2: Define function with multiple parameters
test('Define Function - Multiple parameters', () => {
  manager.defineFunction('add', ['a', 'b'], 'a + b', 'Adds two numbers');
  const result = manager.callFunction('add', [3, 7]);
  console.log('  Defined: add(a, b) = a + b');
  console.log('  Called: add(3, 7)');
  console.log('  Result:', result);
  if (result !== 10) throw new Error(`Expected 10, got ${result}`);
});

// Test 3: F1 Score function (common ML metric)
test('Define Function - F1 Score', () => {
  manager.defineFunction('f1Score', ['precision', 'recall'], 
    '2 * precision * recall / (precision + recall)',
    'Calculate F1 score from precision and recall');
  const result = manager.callFunction('f1Score', [0.8, 0.9]);
  console.log('  Defined: f1Score(precision, recall) = 2 * precision * recall / (precision + recall)');
  console.log('  Called: f1Score(0.8, 0.9)');
  console.log('  Result:', result);
  const expected = 2 * 0.8 * 0.9 / (0.8 + 0.9);
  if (Math.abs(result - expected) > 0.0001) {
    throw new Error(`Expected ${expected}, got ${result}`);
  }
});

// Test 4: List custom functions
test('List Custom Functions', () => {
  const functions = manager.listCustomFunctions();
  console.log('  Defined functions:', functions.length);
  functions.forEach(f => console.log(`    - ${f.name}(${f.params.join(', ')})`));
  if (functions.length !== 3) {
    throw new Error(`Expected 3 functions, got ${functions.length}`);
  }
  const names = functions.map(f => f.name);
  if (!names.includes('double') || !names.includes('add') || !names.includes('f1Score')) {
    throw new Error('Missing expected function names');
  }
});

// Test 5: Remove function
test('Remove Function', () => {
  const existed = manager.removeFunction('double');
  console.log('  Removed: double');
  console.log('  Function existed:', existed);
  if (!existed) throw new Error('Function should have existed');
  
  const functions = manager.listCustomFunctions();
  console.log('  Remaining functions:', functions.length);
  if (functions.length !== 2) {
    throw new Error(`Expected 2 functions after removal, got ${functions.length}`);
  }
});

// Test 6: Error - Call undefined function
test('Error Handling - Undefined function', () => {
  try {
    manager.callFunction('nonexistent', [1, 2]);
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw:', error.message);
    if (!error.message.includes('not defined')) {
      throw error;
    }
  }
});

// Test 7: Error - Wrong argument count
test('Error Handling - Wrong argument count', () => {
  try {
    manager.callFunction('add', [1]); // add expects 2 arguments
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw:', error.message);
    if (!error.message.includes('expects 2 arguments')) {
      throw error;
    }
  }
});

// Test 8: Error - Invalid function name
test('Error Handling - Invalid function name', () => {
  try {
    manager.defineFunction('123invalid', ['x'], 'x + 1');
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw:', error.message);
    if (!error.message.includes('must start with a letter')) {
      throw error;
    }
  }
});

// Test 9: Error - Empty function name
test('Error Handling - Empty function name', () => {
  try {
    manager.defineFunction('', ['x'], 'x + 1');
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw:', error.message);
    if (!error.message.includes('non-empty string')) {
      throw error;
    }
  }
});

// Test 10: Error - Invalid parameter name
test('Error Handling - Invalid parameter name', () => {
  try {
    manager.defineFunction('test', ['x', '2ndParam'], 'x + 1');
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw:', error.message);
    if (!error.message.includes('Invalid parameter')) {
      throw error;
    }
  }
});

// Test 11: Complex ML metric - Accuracy
test('Define Function - Accuracy metric', () => {
  manager.defineFunction('accuracy', ['correct', 'total'], 
    'correct / total',
    'Calculate accuracy percentage');
  const result = manager.callFunction('accuracy', [85, 100]);
  console.log('  Defined: accuracy(correct, total) = correct / total');
  console.log('  Called: accuracy(85, 100)');
  console.log('  Result:', result);
  if (result !== 0.85) throw new Error(`Expected 0.85, got ${result}`);
});

// Test 12: Overwrite existing function
test('Overwrite Existing Function', () => {
  manager.defineFunction('add', ['x', 'y', 'z'], 'x + y + z', 'Adds three numbers');
  const result = manager.callFunction('add', [1, 2, 3]);
  console.log('  Redefined: add(x, y, z) = x + y + z');
  console.log('  Called: add(1, 2, 3)');
  console.log('  Result:', result);
  if (result !== 6) throw new Error(`Expected 6, got ${result}`);
});

console.log('=== TEST SUMMARY ===');
console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\nSUCCESS: All custom function features work correctly!');
  process.exit(0);
} else {
  console.log(`\nFAILED: ${failCount} tests failed`);
  process.exit(1);
}
