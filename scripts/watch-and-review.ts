#!/usr/bin/env npx tsx

/**
 * Real-time AI Code Review File Watcher
 *
 * Watches for file changes and automatically runs AI code review
 *
 * Usage:
 *   # Watch current directory
 *   npx tsx scripts/watch-and-review.ts
 *
 *   # Watch specific directory
 *   npx tsx scripts/watch-and-review.ts app/api
 *
 *   # Watch multiple directories
 *   npx tsx scripts/watch-and-review.ts app lib components
 *
 * Features:
 *   - Auto-reviews on file save
 *   - Debounced (waits 2s after last change)
 *   - Only reviews .ts, .tsx, .js, .jsx files
 *   - Ignores node_modules, .next, dist
 */

import { watch } from 'fs';
import { execSync, spawn } from 'child_process';
import path from 'path';

const MODEL = process.env.MODEL || 'qwen2.5-coder:32b';
const DEBOUNCE_MS = 2000; // Wait 2 seconds after last change

// Directories to watch (from command line or default)
const watchDirs = process.argv.slice(2);
if (watchDirs.length === 0) {
  watchDirs.push('.'); // Default to current directory
}

// Directories to ignore
const ignoreDirs = ['node_modules', '.next', 'dist', '.git', 'build', 'out'];

// File extensions to review
const validExtensions = ['.ts', '.tsx', '.js', '.jsx'];

// Debounce timer
let debounceTimer: NodeJS.Timeout | null = null;
const pendingFiles = new Set<string>();

function spawnFixer(filePath: string, errorLog: string) {
  console.log('🔧 Spawning background fixer...');
  const child = spawn('npx', ['tsx', 'scripts/generate-fix.ts', filePath, errorLog], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

function shouldReview(filePath: string): boolean {
  // Check if file has valid extension
  const ext = path.extname(filePath);
  if (!validExtensions.includes(ext)) {
    return false;
  }

  // Check if file is in ignored directory
  for (const ignoreDir of ignoreDirs) {
    if (filePath.includes(`/${ignoreDir}/`) || filePath.includes(`\\${ignoreDir}\\`)) {
      return false;
    }
  }

  return true;
}

async function reviewFile(filePath: string): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Reviewing: ${filePath}`);
  console.log('='.repeat(80));

  // Step 1: Linting
  console.log('🧹 Step 1/3: Linting...');
  try {
    // Run eslint on the specific file with max-warnings=0
    execSync(`npx eslint "${filePath}" --max-warnings=0`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log('✅ Lint passed');
  } catch (error: any) {
    const errorOutput = error.stdout || error.message;
    console.log(errorOutput);
    console.log('\n❌ Fix lint errors before proceeding');
    spawnFixer(filePath, errorOutput);
    console.log('\n');
    console.log('='.repeat(80));
    return;
  }

  // Step 2: Check syntax first (fast!)
  console.log('⚡ Step 2/3: Checking syntax (TypeScript)...');
  try {
    const syntaxOutput = execSync(
      `npx tsx scripts/check-syntax.ts "${filePath}"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    console.log(syntaxOutput.trim());
  } catch (error: any) {
    // Syntax errors found - don't run AI review
    const errorOutput = error.stdout || error.message;
    console.log(errorOutput);
    console.log('\n❌ Fix syntax errors before AI review can run');
    spawnFixer(filePath, errorOutput);
    console.log('\n');
    console.log('='.repeat(80));
    return;
  }

  // Step 3: Run AI review (only if syntax is valid)
  console.log('🤖 Step 3/3: Running AI code review...');
  try {
    const output = execSync(
      `npx tsx scripts/ollama-code-review.ts "${filePath}"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    console.log(output);

    // Check if critical issues found
    if (output.toLowerCase().includes('critical')) {
      console.log('\n⚠️  Critical issues found! Review the output above.\n');
    } else if (output.toLowerCase().includes('high')) {
      console.log('\n⚠️  High-severity issues found. Consider addressing them.\n');
    } else {
      console.log('\n✅ No critical issues detected.\n');
    }
  } catch (error: any) {
    // execSync throws if exit code is non-zero (which happens for critical issues)
    console.log(error.stdout || error.message);
  }

  console.log('='.repeat(80));
}

function scheduleReview(filePath: string): void {
  pendingFiles.add(filePath);

  // Clear existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Set new timer
  debounceTimer = setTimeout(async () => {
    const files = Array.from(pendingFiles);
    pendingFiles.clear();

    console.log(`\n💡 ${files.length} file(s) changed, running review...`);

    for (const file of files) {
      await reviewFile(file);
    }
  }, DEBOUNCE_MS);
}

console.log(`🚀 Real-time AI Code Review - ${MODEL}`);
console.log(`👀 Watching: ${watchDirs.join(', ')}`);
console.log(`⏱️  Debounce: ${DEBOUNCE_MS}ms`);
console.log(`📝 File types: ${validExtensions.join(', ')}`);
console.log(`🚫 Ignoring: ${ignoreDirs.join(', ')}\n`);
console.log('Waiting for file changes...\n');

// Start watching
for (const dir of watchDirs) {
  try {
    watch(
      dir,
      { recursive: true },
      (eventType, filename) => {
        if (!filename) return;

        const filePath = path.join(dir, filename);

        // Check if we should review this file
        if (!shouldReview(filePath)) {
          return;
        }

        // Only review on "change" events (file saved)
        if (eventType === 'change') {
          console.log(`📝 Detected change: ${filePath}`);
          scheduleReview(filePath);
        }
      }
    );

    console.log(`✅ Watching: ${dir}`);
  } catch (error) {
    console.error(`❌ Failed to watch ${dir}:`, error);
  }
}

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping file watcher...');
  process.exit(0);
});
