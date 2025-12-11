#!/usr/bin/env node
/**
 * Simple check of what the API route logs about tools
 * Just grep the route.ts file for tool-related logging
 */

const fs = require('fs');
const path = require('path');

const routePath = path.join(__dirname, '../app/api/chat/route.ts');
const content = fs.readFileSync(routePath, 'utf8');

console.log('='.repeat(60));
console.log('TOOL LOGGING IN API ROUTE');
console.log('='.repeat(60));

// Find lines with "tools" logging
const lines = content.split('\n');
const toolLines = lines
  .map((line, idx) => ({ line, num: idx + 1 }))
  .filter(({ line }) => line.includes('tools') && line.includes('console.log'));

console.log('\nFound tool-related console.log statements:\n');
toolLines.forEach(({ line, num }) => {
  console.log(`Line ${num}: ${line.trim()}`);
});

console.log('\n' + '='.repeat(60));
console.log('KEY FINDINGS:');
console.log('- Your terminal showed: "[API] Request with 118 messages, 2 tools"');
console.log('- Expected: 3 tools (calculator, datetime, web_search)');
console.log('- Hypothesis: web_search might be disabled (is_enabled = false)');
console.log('='.repeat(60));
