#!/usr/bin/env npx tsx

/**
 * Interactive AI Code Review with Auto-Fix
 *
 * Auto-fixes simple issues, asks about complex ones
 *
 * Usage:
 *   npx tsx scripts/ollama-code-review-interactive.ts
 *   npx tsx scripts/ollama-code-review-interactive.ts --auto-fix-all  # Skip prompts for simple fixes
 */

import { execSync } from 'child_process';
import fs from 'fs';
import readline from 'readline';

const MODEL = process.env.MODEL || 'qwen2.5-coder:32b';
const AUTO_FIX_ALL = process.argv.includes('--auto-fix-all');

interface CodeIssue {
  file: string;
  line?: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  category: string;
  description: string;
  suggestedFix?: string;
  isSimple: boolean; // Can be auto-fixed
}

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

async function callOllama(prompt: string): Promise<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.2, num_predict: 3000 },
    }),
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
  const data: OllamaResponse = await response.json();
  return data.response;
}

async function askFixForIssue(file: string, issue: CodeIssue): Promise<string> {
  const prompt = `You are a code fixing assistant. Given this issue, provide ONLY the fixed code (no explanations).

File: ${file}
Issue: ${issue.description}

Current code:
${fs.readFileSync(file, 'utf-8')}

Return ONLY the complete fixed file content. No markdown, no explanations, just the fixed code.`;

  const result = await callOllama(prompt);

  // Strip markdown code fences if present
  let cleanedResult = result.trim();
  if (cleanedResult.startsWith('```')) {
    // Remove opening fence (e.g., ```typescript or ```ts or ```)
    cleanedResult = cleanedResult.replace(/^```[a-z]*\n/i, '');
    // Remove closing fence
    cleanedResult = cleanedResult.replace(/\n```$/i, '');
  }

  return cleanedResult;
}

function categorizeIssue(description: string, severity: string): boolean {
  // Simple issues that can be auto-fixed
  const simplePatterns = [
    /sql injection/i,
    /missing type annotation/i,
    /hardcoded.*secret/i,
    /console\.log/i,
    /var keyword/i,
    /== instead of ===/i,
    /missing semicolon/i,
    /unused import/i,
  ];

  // Complex issues that need manual review
  const complexPatterns = [
    /architecture/i,
    /refactor.*function/i,
    /design pattern/i,
    /split.*service/i,
    /memory leak/i,
    /performance.*o\(n/i,
  ];

  if (complexPatterns.some(p => p.test(description))) {
    return false; // Complex
  }

  if (simplePatterns.some(p => p.test(description))) {
    return true; // Simple
  }

  // Default: simple if Low/Medium severity, complex if High/Critical
  return severity === 'Low' || severity === 'Medium';
}

function parseReviewOutput(review: string): CodeIssue[] {
  const issues: CodeIssue[] = [];

  // Parse the AI review output - handles markdown bullet format
  const lines = review.split('\n');
  let currentIssue: Partial<CodeIssue> = {};
  let inIssueBlock = false;
  let currentFile = '';

  for (const line of lines) {
    // Look for file at section level: ### File: `test.ts` or ### Issues in `test.ts`
    const sectionFileMatch = line.match(/^#{2,4}\s*(?:[Ff]ile|[Ii]ssues?\s+in)[:\s]*`?([^`\n]+\.(?:ts|tsx|js|jsx))`?/i);
    if (sectionFileMatch) {
      currentFile = sectionFileMatch[1].trim();
      continue;
    }

    // Detect start of new issue (like "#### Issue 1:" or "#### Issue 1: Description")
    const issueHeaderMatch = line.match(/^#{2,4}\s*Issue\s+\d+(?::\s*(.+))?$/i);
    if (issueHeaderMatch) {
      // Save previous issue if complete
      if (currentIssue.file && currentIssue.severity && currentIssue.description) {
        currentIssue.isSimple = categorizeIssue(
          currentIssue.description,
          currentIssue.severity
        );
        issues.push(currentIssue as CodeIssue);
      }
      currentIssue = { file: currentFile }; // Inherit file from section

      // If issue description is in the header, capture it
      if (issueHeaderMatch[1]) {
        currentIssue.description = issueHeaderMatch[1].trim();
      }

      inIssueBlock = true;
      continue;
    }

    if (!inIssueBlock && !Object.keys(currentIssue).length) continue;

    // Handle markdown bullet format: - **Field Name:** value OR - **Field Name**: value
    // The colon can be inside OR outside the bold markers

    // Look for file references (for inline file mentions)
    // Handles both: `- **File**: test.ts` and `- **File:** test.ts`
    const fileMatch = line.match(/[-*]\s*\*\*[Ff]ile\s*(?:name\s*(?:and\s*line\s*number)?)?\*\*\s*:?\s*:?\s*`?([^`,\n]+\.(?:ts|tsx|js|jsx))`?(?:,\s*[Ll]ines?\s*(\d+)(?:-\d+)?)?/i);
    if (fileMatch) {
      currentIssue.file = fileMatch[1].trim();
      if (fileMatch[2]) {
        currentIssue.line = parseInt(fileMatch[2]);
      }
    }

    // Look for line number (separate from file)
    const lineMatch = line.match(/[-*]\s*\*\*[Ll]ine\s*(?:[Nn]umber)?\*\*\s*:?\s*:?\s*(\d+)/i);
    if (lineMatch) {
      currentIssue.line = parseInt(lineMatch[1]);
    }

    // Look for severity - handles both **: value and **value:
    const severityMatch = line.match(/[-*]\s*\*\*[Ss]everity\*\*\s*:?\s*:?\s*(Critical|High|Medium|Low)/i);
    if (severityMatch) {
      currentIssue.severity = severityMatch[1] as CodeIssue['severity'];
    }

    // Look for category
    const categoryMatch = line.match(/[-*]\s*\*\*[Cc]ategory\*\*\s*:?\s*:?\s*([^\n]+)/i);
    if (categoryMatch) {
      currentIssue.category = categoryMatch[1].trim();
    }

    // Look for descriptions
    const descMatch = line.match(/[-*]\s*\*\*(?:[Ss]pecific\s*)?[Ii]ssue\s*(?:[Dd]escription)?\*\*\s*:?\s*:?\s*(.+)$/i);
    if (descMatch && descMatch[1].trim().length > 10) {
      currentIssue.description = descMatch[1].trim();
    }
  }

  // Don't forget the last issue
  if (currentIssue.file && currentIssue.severity && currentIssue.description) {
    currentIssue.isSimple = categorizeIssue(
      currentIssue.description,
      currentIssue.severity
    );
    issues.push(currentIssue as CodeIssue);
  }

  return issues;
}

async function askUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + ' (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function applyFix(file: string, fixedContent: string): Promise<void> {
  const backup = file + '.backup';
  fs.copyFileSync(file, backup);

  try {
    fs.writeFileSync(file, fixedContent);
    console.log(`   ✅ Applied fix to ${file}`);
    console.log(`   📦 Backup saved: ${backup}`);
  } catch (error) {
    fs.copyFileSync(backup, file);
    console.error(`   ❌ Failed to apply fix, restored from backup`);
    throw error;
  }
}

function showDiff(file: string, original: string, fixed: string): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📝 Preview changes for: ${file}`);
  console.log('='.repeat(80));

  const origLines = original.split('\n');
  const fixedLines = fixed.split('\n');

  // Simple line-by-line diff (first 10 changes)
  let changes = 0;
  for (let i = 0; i < Math.max(origLines.length, fixedLines.length) && changes < 10; i++) {
    if (origLines[i] !== fixedLines[i]) {
      console.log(`\nLine ${i + 1}:`);
      console.log(`  - ${origLines[i] || '(removed)'}`);
      console.log(`  + ${fixedLines[i] || '(added)'}`);
      changes++;
    }
  }

  if (changes >= 10) {
    console.log(`\n... and ${Math.abs(origLines.length - fixedLines.length)} more changes`);
  }
  console.log('='.repeat(80));
}

async function getFilesToReview(): Promise<string[]> {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));

  if (args.length > 0) {
    return args;
  }

  const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' })
    .split('\n')
    .filter(f => f.match(/\.(ts|tsx|js|jsx)$/));

  if (stagedFiles.length === 0) {
    console.log('ℹ️  No staged code files found. Add files with: git add <file>');
    process.exit(0);
  }

  return stagedFiles;
}

async function main() {
  console.log(`🔍 Interactive AI Code Review - ${MODEL}`);
  console.log(`🤖 Auto-fix: ${AUTO_FIX_ALL ? 'ALL' : 'INTERACTIVE'}\n`);

  const files = await getFilesToReview();
  console.log(`📂 Reviewing ${files.length} file(s):\n   ${files.join('\n   ')}\n`);

  // Check syntax first (fast!)
  console.log('⚡ Checking syntax first...');
  for (const file of files) {
    try {
      execSync(`npx tsx scripts/check-syntax.ts "${file}"`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log(`  ✅ ${file}`);
    } catch (error: any) {
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

  // Step 1: Get review from AI
  console.log('🚀 Running code review...');
  let prompt = `Analyze these files for issues. For each issue provide:
- File name and line number
- Severity (Critical/High/Medium/Low)
- Category (Security/Performance/Type Safety/Best Practices)
- Specific issue description
- Recommended fix

Be concise and specific.

Files:
`;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    prompt += `\n=== ${file} ===\n${content.slice(0, 10000)}\n`;
  }

  const review = await callOllama(prompt);

  console.log('\n' + '='.repeat(80));
  console.log('📋 REVIEW RESULTS');
  console.log('='.repeat(80));
  console.log(review);
  console.log('='.repeat(80) + '\n');

  // Step 2: Parse issues
  const issues = parseReviewOutput(review);

  if (issues.length === 0) {
    console.log('✅ No issues detected!');
    return;
  }

  const simpleIssues = issues.filter(i => i.isSimple);
  const complexIssues = issues.filter(i => !i.isSimple);

  console.log(`\n📊 Found ${issues.length} issue(s):`);
  console.log(`   🟢 Simple (auto-fixable): ${simpleIssues.length}`);
  console.log(`   🔴 Complex (manual review): ${complexIssues.length}\n`);

  // Step 3: Auto-fix simple issues
  if (simpleIssues.length > 0) {
    console.log('🔧 AUTO-FIXING SIMPLE ISSUES:\n');

    for (const issue of simpleIssues) {
      console.log(`   ${issue.severity}: ${issue.description}`);
      console.log(`   📁 ${issue.file}${issue.line ? `:${issue.line}` : ''}`);

      if (!AUTO_FIX_ALL) {
        const shouldFix = await askUser('   Apply auto-fix?');
        if (!shouldFix) {
          console.log('   ⏭️  Skipped\n');
          continue;
        }
      }

      try {
        const original = fs.readFileSync(issue.file, 'utf-8');
        const fixed = await askFixForIssue(issue.file, issue);

        showDiff(issue.file, original, fixed);

        const confirmed = AUTO_FIX_ALL || await askUser('   Confirm changes?');
        if (confirmed) {
          await applyFix(issue.file, fixed);
        } else {
          console.log('   ⏭️  Skipped\n');
        }
      } catch (error) {
        console.error(`   ❌ Error fixing: ${error}\n`);
      }
    }
  }

  // Step 4: Show complex issues for manual review
  if (complexIssues.length > 0) {
    console.log('\n⚠️  COMPLEX ISSUES (Manual Review Required):\n');

    for (const issue of complexIssues) {
      console.log(`   ${issue.severity}: ${issue.category}`);
      console.log(`   📁 ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
      console.log(`   📝 ${issue.description}\n`);
    }

    console.log('💡 These issues require architectural changes or careful review.');
    console.log('   Review them manually and refactor as needed.\n');
  }

  // Summary
  const fixedCount = simpleIssues.length;
  const manualCount = complexIssues.length;

  console.log('='.repeat(80));
  console.log(`✅ Auto-fixed: ${fixedCount} issue(s)`);
  console.log(`⚠️  Manual review: ${manualCount} issue(s)`);
  console.log('='.repeat(80));
}

main().catch(console.error);
