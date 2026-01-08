#!/usr/bin/env node
/**
 * Phase 1: Scan for TypeScript Errors
 * Runs tsc --noEmit and parses errors into structured format
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

console.log('🔍 Scanning for TypeScript errors...\n');

try {
  // Run TypeScript compiler
  const tscOutput = execSync('npx tsc --noEmit 2>&1', {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large output
  }).toString();

  // If we get here, no errors found
  console.log('✅ No TypeScript errors found!\n');
  process.exit(0);
} catch (error) {
  // tsc returns non-zero exit code when errors exist
  const tscOutput = error.stdout || error.stderr || '';

  // Parse errors
  const errorPattern = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
  const errors = [];
  let match;

  while ((match = errorPattern.exec(tscOutput)) !== null) {
    const [, file, line, col, code, message] = match;
    errors.push({
      file: file.trim(),
      line: parseInt(line),
      column: parseInt(col),
      code: code,
      message: message.trim(),
      context: null, // Will be filled in next step
    });
  }

  if (errors.length === 0) {
    console.log('❌ TypeScript compilation failed but no errors were parsed.');
    console.log('Raw output:\n', tscOutput);
    process.exit(1);
  }

  console.log(`Found ${errors.length} TypeScript errors\n`);

  // Read file context for each error (5 lines before, 5 after)
  for (const error of errors) {
    try {
      const content = await fs.readFile(error.file, 'utf8');
      const lines = content.split('\n');
      const startLine = Math.max(0, error.line - 6); // -6 because line numbers are 1-indexed
      const endLine = Math.min(lines.length, error.line + 5);

      error.context = {
        before: lines.slice(startLine, error.line - 1),
        errorLine: lines[error.line - 1],
        after: lines.slice(error.line, endLine)
      };
    } catch (e) {
      console.warn(`⚠️  Could not read context for ${error.file}:${error.line}`);
    }
  }

  // Save to file
  const outputDir = 'scripts/ts-error-pipeline/output';
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'errors.json'),
    JSON.stringify(errors, null, 2)
  );

  console.log(`✅ Saved ${errors.length} errors to output/errors.json\n`);

  // Summary by error code
  const summary = errors.reduce((acc, err) => {
    acc[err.code] = (acc[err.code] || 0) + 1;
    return acc;
  }, {});

  console.log('Error Summary:');
  Object.entries(summary)
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });

  console.log('\n📝 Next step: npm run ts:categorize\n');
}
