#!/usr/bin/env npx tsx

/**
 * Replicate Ollama Code Review Script
 *
 * Uses Qwen 2.5 Coder 70B via Replicate for code analysis
 * Cost: ~$0.0013/second (~$4.68/hour of active inference)
 *
 * Usage:
 *   # Review staged files
 *   npx tsx scripts/replicate-code-review.ts
 *
 *   # Review specific files
 *   npx tsx scripts/replicate-code-review.ts app/api/chat/route.ts lib/tracing/types.ts
 *
 *   # Custom prompt
 *   npx tsx scripts/replicate-code-review.ts --prompt "Find performance issues in these files"
 */

import { execSync } from 'child_process';
import fs from 'fs';

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
  console.error('❌ Error: REPLICATE_API_TOKEN environment variable not set');
  console.error('   Get your token at: https://replicate.com/account/api-tokens');
  console.error('   Then: export REPLICATE_API_TOKEN=your_token');
  process.exit(1);
}

interface ReplicateRequest {
  version: string;
  input: {
    prompt: string;
    max_tokens?: number;
    temperature?: number;
  };
}

interface ReplicateResponse {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed';
  output?: string[];
  error?: string;
  urls: {
    get: string;
  };
}

async function callReplicate(prompt: string): Promise<string> {
  // Choose your model:
  // Option 1: Qwen 2.5 Coder 32B (RECOMMENDED) - Best all-around, $2.34/hr
  const modelVersion = 'qwen/qwen2.5-coder-32b-instruct';

  // Option 2: DeepSeek Coder V2 Lite - Faster & cheaper, $1.08/hr
  // const modelVersion = 'deepseek-ai/deepseek-coder-v2-lite-instruct';

  // Option 3: CodeLlama 34B - Good for architecture, $2.50/hr
  // const modelVersion = 'meta/codellama-34b-instruct';

  const request: ReplicateRequest = {
    version: modelVersion,
    input: {
      prompt,
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more focused code review
    },
  };

  console.log('🚀 Sending request to Replicate...');

  // Create prediction
  const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!createResponse.ok) {
    throw new Error(`Replicate API error: ${createResponse.statusText}`);
  }

  let prediction: ReplicateResponse = await createResponse.json();
  console.log(`⏳ Prediction started: ${prediction.id}`);

  // Poll for completion
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pollResponse = await fetch(prediction.urls.get, {
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      },
    });

    prediction = await pollResponse.json();
    process.stdout.write('.');
  }

  console.log(''); // New line after dots

  if (prediction.status === 'failed') {
    throw new Error(`Prediction failed: ${prediction.error}`);
  }

  return prediction.output?.join('') || '';
}

async function getFilesToReview(): Promise<string[]> {
  const args = process.argv.slice(2);

  // If files specified on command line, use those
  if (args.length > 0 && !args[0].startsWith('--')) {
    return args;
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

async function main() {
  console.log('🔍 Replicate Code Review - Qwen 2.5 Coder 70B\n');

  const files = await getFilesToReview();
  console.log(`📂 Reviewing ${files.length} file(s):\n   ${files.join('\n   ')}\n`);

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
      // Truncate very large files to avoid token limits
      const truncated = content.length > 10000
        ? content.slice(0, 10000) + '\n\n[... truncated ...]'
        : content;

      prompt += `\n=== ${file} ===\n${truncated}\n`;
    }
  }

  try {
    const result = await callReplicate(prompt);

    console.log('\n' + '='.repeat(80));
    console.log('📋 CODE REVIEW RESULTS');
    console.log('='.repeat(80) + '\n');
    console.log(result);
    console.log('\n' + '='.repeat(80));

    // Check if any critical issues found
    if (result.toLowerCase().includes('critical')) {
      console.log('\n⚠️  Critical issues found! Review carefully before committing.');
      process.exit(1);
    } else if (result.toLowerCase().includes('high')) {
      console.log('\n⚠️  High-severity issues found. Consider fixing before committing.');
    } else {
      console.log('\n✅ No critical issues detected.');
    }

  } catch (error) {
    console.error('\n❌ Error during code review:', error);
    process.exit(1);
  }
}

main();
