// Test Phase 2 Step 3: NLP Score Functions
// Validates word count, character count, and JSON lookup

console.log('=== PHASE 2 STEP 3: NLP FUNCTIONS TEST ===\n');

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

// Word count function
function wordCount(text) {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  const words = trimmed.split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

// Character count function
function charCount(text, includeSpaces = true) {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }
  return includeSpaces ? text.length : text.replace(/\s/g, '').length;
}

// JSON lookup function
function jsonLookup(jsonString, path) {
  if (typeof jsonString !== 'string') {
    throw new Error('First argument must be a JSON string');
  }
  if (typeof path !== 'string') {
    throw new Error('Path must be a string');
  }
  
  const data = JSON.parse(jsonString);
  const pathParts = path.split('.');
  
  let result = data;
  for (const part of pathParts) {
    if (result === null || result === undefined) {
      throw new Error(`Path "${path}" not found: "${part}" is undefined`);
    }
    if (typeof result === 'object' && part in result) {
      result = result[part];
    } else {
      throw new Error(`Path "${path}" not found: property "${part}" does not exist`);
    }
  }
  return result;
}

// Word Count Tests
test('Word Count - Simple sentence', () => {
  const result = wordCount('Hello world!');
  console.log('  Input: "Hello world!"');
  console.log('  Result:', result);
  if (result !== 2) throw new Error(`Expected 2, got ${result}`);
});

test('Word Count - Multiple spaces', () => {
  const result = wordCount('Hello    world    test');
  console.log('  Input: "Hello    world    test"');
  console.log('  Result:', result);
  if (result !== 3) throw new Error(`Expected 3, got ${result}`);
});

test('Word Count - Empty string', () => {
  const result = wordCount('');
  console.log('  Input: ""');
  console.log('  Result:', result);
  if (result !== 0) throw new Error(`Expected 0, got ${result}`);
});

test('Word Count - Single word', () => {
  const result = wordCount('Hello');
  console.log('  Input: "Hello"');
  console.log('  Result:', result);
  if (result !== 1) throw new Error(`Expected 1, got ${result}`);
});

// Character Count Tests
test('Character Count - With spaces', () => {
  const result = charCount('Hello world', true);
  console.log('  Input: "Hello world" (with spaces)');
  console.log('  Result:', result);
  if (result !== 11) throw new Error(`Expected 11, got ${result}`);
});

test('Character Count - Without spaces', () => {
  const result = charCount('Hello world', false);
  console.log('  Input: "Hello world" (without spaces)');
  console.log('  Result:', result);
  if (result !== 10) throw new Error(`Expected 10, got ${result}`);
});

test('Character Count - Empty string', () => {
  const result = charCount('');
  console.log('  Input: ""');
  console.log('  Result:', result);
  if (result !== 0) throw new Error(`Expected 0, got ${result}`);
});

// JSON Lookup Tests
test('JSON Lookup - Simple property', () => {
  const json = '{"name": "John", "age": 30}';
  const result = jsonLookup(json, 'name');
  console.log('  JSON:', json);
  console.log('  Path: "name"');
  console.log('  Result:', result);
  if (result !== 'John') throw new Error(`Expected "John", got ${result}`);
});

test('JSON Lookup - Nested property', () => {
  const json = '{"user": {"name": "Alice", "score": 95}}';
  const result = jsonLookup(json, 'user.score');
  console.log('  JSON:', json);
  console.log('  Path: "user.score"');
  console.log('  Result:', result);
  if (result !== 95) throw new Error(`Expected 95, got ${result}`);
});

test('JSON Lookup - Deep nesting', () => {
  const json = '{"data": {"metrics": {"accuracy": 0.92}}}';
  const result = jsonLookup(json, 'data.metrics.accuracy');
  console.log('  JSON:', json);
  console.log('  Path: "data.metrics.accuracy"');
  console.log('  Result:', result);
  if (result !== 0.92) throw new Error(`Expected 0.92, got ${result}`);
});

test('JSON Lookup - Array value', () => {
  const json = '{"scores": [85, 90, 95]}';
  const result = jsonLookup(json, 'scores');
  console.log('  JSON:', json);
  console.log('  Path: "scores"');
  console.log('  Result:', JSON.stringify(result));
  if (!Array.isArray(result) || result.length !== 3) {
    throw new Error('Expected array with 3 elements');
  }
});

test('JSON Lookup - Error: Invalid JSON', () => {
  try {
    jsonLookup('invalid json', 'name');
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw:', error.message);
    if (!error.message.includes('JSON') && !error.message.includes('Unexpected')) {
      throw error;
    }
  }
});

test('JSON Lookup - Error: Path not found', () => {
  try {
    const json = '{"name": "John"}';
    jsonLookup(json, 'age');
    throw new Error('Should have thrown error');
  } catch (error) {
    console.log('  Correctly threw:', error.message);
    if (!error.message.includes('not found') && !error.message.includes('does not exist')) {
      throw error;
    }
  }
});

console.log('=== TEST SUMMARY ===');
console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\nSUCCESS: All NLP functions work correctly!');
  process.exit(0);
} else {
  console.log(`\nFAILED: ${failCount} tests failed`);
  process.exit(1);
}
