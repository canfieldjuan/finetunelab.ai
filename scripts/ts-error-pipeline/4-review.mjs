#!/usr/bin/env node
/**
 * Phase 4: Review Interface
 * Interactive CLI to review and approve/reject generated fixes
 */

import fs from 'fs/promises';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

console.clear();
console.log(c('bold', c('blue', '🔍 TypeScript Fix Review Interface\n')));

// Load all generated fixes
let tier1, tier2, tier3;
try {
  tier1 = JSON.parse(await fs.readFile('scripts/ts-error-pipeline/output/fixes/tier1-generated.json', 'utf8'));
} catch (e) {
  tier1 = [];
}
try {
  tier2 = JSON.parse(await fs.readFile('scripts/ts-error-pipeline/output/fixes/tier2-generated.json', 'utf8'));
} catch (e) {
  tier2 = [];
}
try {
  tier3 = JSON.parse(await fs.readFile('scripts/ts-error-pipeline/output/fixes/tier3-generated.json', 'utf8'));
} catch (e) {
  tier3 = [];
}

const allFixes = [...tier1, ...tier2, ...tier3].filter(f => f.fix !== null);
const approved = [];
const rejected = [];
const skipped = [];

if (allFixes.length === 0) {
  console.log(c('yellow', '⚠️  No fixes found to review.'));
  console.log('Run npm run ts:fix first to generate fixes.\n');
  process.exit(0);
}

console.log(`Found ${allFixes.length} fixes to review\n`);

for (let i = 0; i < allFixes.length; i++) {
  const { error, fix, model } = allFixes[i];

  console.clear();
  console.log(c('bold', `Fix ${i + 1}/${allFixes.length}`));
  console.log(c('gray', `Model: ${model}`));
  console.log(c('gray', `Confidence: ${(fix.confidence * 100).toFixed(0)}%`));
  console.log('');

  console.log(c('yellow', 'Error:'));
  console.log(`  ${error.file}:${error.line}`);
  console.log(`  ${error.code} - ${error.message}`);
  console.log('');

  console.log(c('cyan', 'Analysis:'));
  console.log(`  ${fix.analysis}`);
  console.log('');

  console.log(c('green', 'Proposed Changes:'));
  for (const change of fix.changes) {
    console.log(c('red', `  - Line ${change.line}: ${change.old_content.substring(0, 80)}`));
    console.log(c('green', `  + Line ${change.line}: ${change.new_content.substring(0, 80)}`));
  }

  if (fix.additional_changes && fix.additional_changes.length > 0) {
    console.log('');
    console.log(c('magenta', 'Additional files affected:'));
    fix.additional_changes.forEach(change => {
      console.log(`  ${change.file}:${change.line}`);
    });
  }

  if (fix.notes) {
    console.log('');
    console.log(c('yellow', 'Notes:'));
    console.log(`  ${fix.notes}`);
  }

  console.log('');
  const answer = await question(c('bold', 'Action? [a]ccept / [r]eject / [s]kip / [q]uit: '));

  if (answer.toLowerCase() === 'a') {
    approved.push(allFixes[i]);
    console.log(c('green', '✓ Approved'));
  } else if (answer.toLowerCase() === 'r') {
    rejected.push(allFixes[i]);
    console.log(c('red', '✗ Rejected'));
  } else if (answer.toLowerCase() === 'q') {
    skipped.push(...allFixes.slice(i + 1));
    console.log(c('gray', 'Quitting...'));
    break;
  } else {
    skipped.push(allFixes[i]);
    console.log(c('gray', '⊘ Skipped'));
  }

  await new Promise(resolve => setTimeout(resolve, 300));
}

// Save approved fixes
await fs.mkdir('scripts/ts-error-pipeline/output/approved', { recursive: true });
await fs.writeFile(
  'scripts/ts-error-pipeline/output/approved/fixes.json',
  JSON.stringify(approved, null, 2)
);

// Save review summary
await fs.writeFile(
  'scripts/ts-error-pipeline/output/approved/review-summary.json',
  JSON.stringify({
    reviewed_at: new Date().toISOString(),
    total: allFixes.length,
    approved: approved.length,
    rejected: rejected.length,
    skipped: skipped.length,
    approved_fixes: approved.map(f => ({ file: f.error.file, line: f.error.line, code: f.error.code })),
    rejected_fixes: rejected.map(f => ({ file: f.error.file, line: f.error.line, code: f.error.code }))
  }, null, 2)
);

rl.close();

console.clear();
console.log(c('bold', c('green', '\n✅ Review complete!')));
console.log(`   Approved: ${approved.length}`);
console.log(`   Rejected: ${rejected.length}`);
console.log(`   Skipped: ${skipped.length}`);

if (approved.length > 0) {
  console.log('\n📝 Next step: npm run ts:apply\n');
} else {
  console.log('\n⚠️  No fixes approved. Run ts:fix again or adjust review criteria.\n');
}
