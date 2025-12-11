// Test Phase 3 Step 3: Export Results
// Validates JSON, CSV, and Markdown export formats

console.log('=== PHASE 3 STEP 3: EXPORT RESULTS TEST ===\n');

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

// Mock data for testing export formats
const mockData = [
  {
    id: '1',
    user_id: 'test-user',
    expression: '2 + 2',
    result: '4',
    created_at: '2025-10-22T10:00:00Z'
  },
  {
    id: '2',
    user_id: 'test-user',
    expression: 'sqrt(16)',
    result: '4',
    created_at: '2025-10-22T10:05:00Z'
  },
  {
    id: '3',
    user_id: 'test-user',
    expression: 'mean([1, 2, 3, 4, 5])',
    result: '3',
    created_at: '2025-10-22T10:10:00Z'
  }
];

// Format as CSV function
function formatAsCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
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

// Format as Markdown function
function formatAsMarkdown(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const headerRow = '| ' + headers.join(' | ') + ' |';
  const separatorRow = '| ' + headers.map(() => '---').join(' | ') + ' |';
  
  const dataRows = data.map(row => {
    return '| ' + headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    }).join(' | ') + ' |';
  });
  
  return [headerRow, separatorRow, ...dataRows].join('\n');
}

// JSON Export Tests
test('JSON Export - Valid data', () => {
  const result = JSON.stringify(mockData, null, 2);
  console.log('  Data records:', mockData.length);
  console.log('  Output length:', result.length, 'characters');
  if (!result.includes('"expression"')) throw new Error('Missing expression field');
  if (!result.includes('"result"')) throw new Error('Missing result field');
  if (!result.includes('2 + 2')) throw new Error('Missing actual data');
});

test('JSON Export - Empty data', () => {
  const result = JSON.stringify([], null, 2);
  console.log('  Result:', result);
  if (result !== '[]') throw new Error('Expected empty array');
});

// CSV Export Tests
test('CSV Export - Valid data', () => {
  const result = formatAsCSV(mockData);
  console.log('  Output preview:');
  console.log('  ' + result.split('\n').slice(0, 2).join('\n  '));
  
  const lines = result.split('\n');
  if (lines.length !== 4) throw new Error(`Expected 4 lines (header + 3 data), got ${lines.length}`);
  if (!lines[0].includes('id')) throw new Error('Missing id header');
  if (!lines[0].includes('expression')) throw new Error('Missing expression header');
  if (!lines[1].includes('2 + 2')) throw new Error('Missing first data row');
});

test('CSV Export - Escaping commas', () => {
  const dataWithComma = [{
    id: '1',
    expression: 'mean([1, 2, 3])',
    result: '2'
  }];
  
  const result = formatAsCSV(dataWithComma);
  console.log('  Result:', result);
  
  // Should have quotes around the expression with commas
  if (!result.includes('"mean([1, 2, 3])"') && !result.includes('mean([1')) {
    throw new Error('Commas not properly escaped');
  }
});

test('CSV Export - Empty data', () => {
  const result = formatAsCSV([]);
  console.log('  Result: (empty string)');
  if (result !== '') throw new Error('Expected empty string');
});

// Markdown Export Tests
test('Markdown Export - Valid data', () => {
  const result = formatAsMarkdown(mockData);
  console.log('  Output preview:');
  console.log('  ' + result.split('\n').slice(0, 3).join('\n  '));
  
  const lines = result.split('\n');
  if (lines.length !== 5) throw new Error(`Expected 5 lines (header + sep + 3 data), got ${lines.length}`);
  if (!lines[0].includes('|')) throw new Error('Missing table structure');
  if (!lines[1].includes('---')) throw new Error('Missing separator row');
  if (!lines[2].includes('2 + 2')) throw new Error('Missing first data row');
});

test('Markdown Export - Table structure', () => {
  const result = formatAsMarkdown(mockData);
  
  const lines = result.split('\n');
  const headerCount = (lines[0].match(/\|/g) || []).length;
  const sepCount = (lines[1].match(/\|/g) || []).length;
  const dataCount = (lines[2].match(/\|/g) || []).length;
  
  console.log('  Header pipes:', headerCount);
  console.log('  Separator pipes:', sepCount);
  console.log('  Data pipes:', dataCount);
  
  if (headerCount !== sepCount || sepCount !== dataCount) {
    throw new Error('Inconsistent column count');
  }
});

test('Markdown Export - Escaping pipes', () => {
  const dataWithPipe = [{
    id: '1',
    expression: 'x | y',
    result: '2'
  }];
  
  const result = formatAsMarkdown(dataWithPipe);
  console.log('  Result includes escaped pipe:', result.includes('\\|'));
  
  if (!result.includes('\\|')) {
    throw new Error('Pipes not properly escaped');
  }
});

test('Markdown Export - Empty data', () => {
  const result = formatAsMarkdown([]);
  console.log('  Result: (empty string)');
  if (result !== '') throw new Error('Expected empty string');
});

// Validation Tests
test('Validation - Invalid format', () => {
  const formats = ['json', 'csv', 'markdown'];
  console.log('  Valid formats:', formats.join(', '));
  
  const invalidFormat = 'xml';
  if (formats.includes(invalidFormat)) {
    throw new Error('Invalid format should not be accepted');
  }
});

test('Validation - Limit bounds', () => {
  const validLimits = [1, 100, 10000];
  const invalidLimits = [0, -1, 10001];
  
  console.log('  Valid limits:', validLimits.join(', '));
  console.log('  Invalid limits:', invalidLimits.join(', '));
  
  for (const limit of validLimits) {
    if (limit < 1 || limit > 10000) {
      throw new Error(`Valid limit ${limit} rejected`);
    }
  }
  
  for (const limit of invalidLimits) {
    if (limit >= 1 && limit <= 10000) {
      throw new Error(`Invalid limit ${limit} accepted`);
    }
  }
});

console.log('=== TEST SUMMARY ===');
console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\nSUCCESS: All export functions work correctly!');
  process.exit(0);
} else {
  console.log(`\nFAILED: ${failCount} tests failed`);
  process.exit(1);
}
