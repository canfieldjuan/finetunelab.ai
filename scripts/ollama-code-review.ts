#!/usr/bin/env npx tsx

/**
 * Local Ollama Code Review Script
 *
 * Uses Qwen 2.5 Coder 32B running LOCALLY on your GPU
 * Cost: $0 (runs on your RTX 3090)
 * Speed: 2-5 seconds (local GPU is FAST)
 * Privacy: 100% (never leaves your machine)
 *
 * Usage:
 *   # Review staged files
 *   npx tsx scripts/ollama-code-review.ts
 *
 *   # Review specific files
 *   npx tsx scripts/ollama-code-review.ts app/api/chat/route.ts lib/tracing/types.ts
 *
 *   # Use different model
 *   MODEL=qwen2.5-coder:7b npx tsx scripts/ollama-code-review.ts
 *
 *   # Skip syntax check (useful when project has unrelated TS errors)
 *   npx tsx scripts/ollama-code-review.ts --skip-syntax app/api/chat/route.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';

// Model selection (can override with MODEL env var)
const DEFAULT_MODEL = 'qwen2.5-coder:32b'; // Your 24GB VRAM can handle this!
const MODEL = process.env.MODEL || DEFAULT_MODEL;

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

async function callOllama(prompt: string): Promise<string> {
  console.log(`🚀 Running ${MODEL} locally...`);

  const requestBody = {
    model: MODEL,
    prompt: prompt,
    stream: false,
    options: {
      temperature: 0.3, // Lower temp for focused code review
      num_predict: 2000,
    },
  };

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data: OllamaResponse = await response.json();
    return data.response;

  } catch (error) {
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error('\n❌ Error: Ollama server not running');
      console.error('   Start it with: ollama serve');
      console.error('   Or run in background: systemctl start ollama (if installed as service)\n');
      process.exit(1);
    }
    throw error;
  }
}

async function getFilesToReview(): Promise<string[]> {
  const args = process.argv.slice(2);

  // Filter out flags from arguments
  const files = args.filter(arg => !arg.startsWith('--'));

  // If files specified on command line, use those
  if (files.length > 0) {
    return files;
  }

  // Otherwise, get staged files
  try {
    const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' })
      .split('\n')
      .filter(f => f.match(/\.(ts|tsx|js|jsx)$/));

    if (stagedFiles.length === 0) {
      console.log('ℹ️  No staged code files found. Add files with: git add <file>');
      process.exit(0);
    }

    return stagedFiles;
  } catch (error) {
    console.error('❌ Error getting staged files:', error);
    process.exit(1);
  }
}

async function readFileContent(filePath: string): Promise<string> {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.warn(`⚠️  Could not read ${filePath}:`, error);
    return '';
  }
}

async function checkOllamaServer(): Promise<void> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) {
      throw new Error('Ollama server not responding');
    }
  } catch (error) {
    console.error('\n❌ Error: Ollama server not running');
    console.error('   Start it with: ollama serve');
    console.error('   Or in background: systemctl start ollama\n');
    process.exit(1);
  }
}

async function checkModelExists(): Promise<void> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    const models = data.models || [];

    const modelExists = models.some((m: unknown) => m.name === MODEL);

    if (!modelExists) {
      console.error(`\n❌ Error: Model "${MODEL}" not found`);
      console.error(`   Available models: ${models.map((m: unknown) => m.name).join(', ')}`);
      console.error(`\n   Pull the model with: ollama pull ${MODEL}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error checking available models:', error);
    process.exit(1);
  }
}

async function main() {
  console.log(`🔍 Local Ollama Code Review - ${MODEL}`);
  console.log(`💾 Running on your RTX 3090 (24GB VRAM)\n`);

  // Check Ollama is running
  await checkOllamaServer();
  await checkModelExists();

  const files = await getFilesToReview();
  console.log(`📂 Reviewing ${files.length} file(s):\n   ${files.join('\n   ')}\n`);

  // Check for --skip-syntax flag
  const skipSyntax = process.argv.includes('--skip-syntax');

  if (skipSyntax) {
    console.log('⚠️  Skipping syntax check (--skip-syntax flag detected)\n');
  } else {
    // Check syntax first (fast!)
    console.log('⚡ Checking syntax first...');
    for (const file of files) {
      try {
        execSync(`npx tsx scripts/check-syntax.ts "${file}"`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        console.log(`  ✅ ${file}`);
      } catch (error: unknown) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`❌ SYNTAX ERROR IN: ${file}`);
        console.log('='.repeat(80));
        console.log(error.stdout || error.message);
        console.log('='.repeat(80));
        console.log('\n💡 Fix syntax errors before running AI review\n');
        process.exit(1);
      }
    }
    console.log('');
  }

  // Build review prompt
  let prompt = `You are an expert code reviewer. Analyze the following files for:

1. **Security Vulnerabilities**
   - SQL injection, XSS, authentication bypasses
   - Hardcoded secrets or credentials
   - Insecure API calls

2. **Performance Issues**
   - Inefficient algorithms (O(n²) when O(n) exists)
   - Memory leaks
   - Unnecessary re-renders (React)

3. **Type Safety**
   - Missing type annotations
   - Unsafe type assertions
   - Potential runtime errors

4. **Best Practices**
   - Code organization and readability
   - Error handling
   - Missing edge cases

For each issue, provide:
- File name and line number
- Severity (Critical/High/Medium/Low)
- Specific issue description
- Recommended fix

Files to review:

`;

  for (const file of files) {
    const content = await readFileContent(file);
    if (content) {
      // Truncate very large files to avoid context limits
      const truncated = content.length > 10000
        ? content.slice(0, 10000) + '\n\n[... truncated ...]'
        : content;

      prompt += `\n=== ${file} ===\n${truncated}\n`;
    }
  }

  try {
    const startTime = Date.now();
    const result = await callOllama(prompt);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(80));
    console.log('📋 CODE REVIEW RESULTS');
    console.log('='.repeat(80) + '\n');
    console.log(result);
    console.log('\n' + '='.repeat(80));
    console.log(`⚡ Completed in ${duration}s`);
    console.log(`💰 Cost: $0 (local GPU)`);
    console.log('='.repeat(80) + '\n');

    // Check if any critical issues found
    // Look for actual "Severity: Critical" or "**Severity**: Critical" patterns
    const criticalPattern = /\*\*Severity\*\*:\s*Critical/i;
    const hasCriticalIssues = criticalPattern.test(result);

    // Also check for explicit statements about critical issues
    const criticalStatements = [
      /critical.*security.*vulnerability/i,
      /severity:\s*critical/i,
      /\d+\s*critical\s*issue/i
    ];
    const hasCriticalStatement = criticalStatements.some(pattern => pattern.test(result));

    if (hasCriticalIssues || hasCriticalStatement) {
      console.log('⚠️  Critical issues found! Review carefully before committing.');
      process.exit(1);
    } else if (/\*\*Severity\*\*:\s*High/i.test(result)) {
      console.log('⚠️  High-severity issues found. Consider fixing before committing.');
    } else {
      console.log('✅ No critical issues detected.');
    }

  } catch (error) {
    console.error('\n❌ Error during code review:', error);
    process.exit(1);
  }
}

main();
