#!/usr/bin/env npx tsx

/**
 * Fast Syntax Checker
 *
 * Runs TypeScript compiler to catch syntax errors before AI review
 * Much faster than AI (1-2 seconds vs 30-40 seconds)
 */

import { execSync } from 'child_process';
import fs from 'fs';

const files = process.argv.slice(2);

if (files.length === 0) {
  console.log('ℹ️  No files specified for syntax check');
  process.exit(0);
}

let hasErrors = false;

for (const file of files) {
  // Check file exists
  if (!fs.existsSync(file)) {
    console.log(`❌ File not found: ${file}`);
    hasErrors = true;
    continue;
  }

  try {
    // Run TypeScript compiler check with project config (doesn't emit files, just checks)
    // Note: We check all project files, not individual files, to resolve path mappings
    execSync(`npx tsc --noEmit --skipLibCheck --project tsconfig.json`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    console.log(`✅ ${file} - No syntax errors`);
  } catch (error: unknown) {
    hasErrors = true;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`❌ SYNTAX ERRORS IN: ${file}`);
    console.log('='.repeat(80));

    // Parse TypeScript error output
    const output = error.stdout || error.stderr || '';
    const lines = output.split('\n');

    for (const line of lines) {
      // Highlight error lines
      if (line.includes('error TS')) {
        console.log(`🔴 ${line}`);
      } else if (line.trim().length > 0 && !line.includes('npm ERR!')) {
        console.log(`   ${line}`);
      }
    }

    console.log('='.repeat(80));
    console.log(`\n💡 Fix syntax errors before running AI review\n`);
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log(`\n✅ All files passed syntax check\n`);
  process.exit(0);
}
