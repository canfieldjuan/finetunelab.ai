#!/usr/bin/env node
/**
 * Phase 5: Apply Fixes
 * Applies approved fixes to files and creates git commit
 */

import fs from 'fs/promises';
import { execSync } from 'child_process';

console.log('🚀 Applying approved fixes...\n');

let approved;
try {
  approved = JSON.parse(
    await fs.readFile('scripts/ts-error-pipeline/output/approved/fixes.json', 'utf8')
  );
} catch (e) {
  console.log('❌ No approved fixes found.');
  console.log('Run npm run ts:review first to review and approve fixes.\n');
  process.exit(1);
}

if (approved.length === 0) {
  console.log('ℹ️  No fixes to apply.\n');
  process.exit(0);
}

const fileChanges = new Map();

// Group changes by file
for (const { error, fix } of approved) {
  if (!fileChanges.has(error.file)) {
    try {
      const content = await fs.readFile(error.file, 'utf8');
      fileChanges.set(error.file, {
        original: content,
        lines: content.split('\n'),
        changes: []
      });
    } catch (e) {
      console.warn(`⚠️  Cannot read ${error.file}, skipping`);
      continue;
    }
  }

  fileChanges.get(error.file).changes.push(...fix.changes);

  // Handle additional file changes
  if (fix.additional_changes) {
    for (const change of fix.additional_changes) {
      if (!fileChanges.has(change.file)) {
        try {
          const content = await fs.readFile(change.file, 'utf8');
          fileChanges.set(change.file, {
            original: content,
            lines: content.split('\n'),
            changes: []
          });
        } catch (e) {
          console.warn(`⚠️  Cannot read ${change.file}, skipping`);
          continue;
        }
      }
      fileChanges.get(change.file).changes.push(change);
    }
  }
}

// Apply changes to each file
let appliedCount = 0;
let skippedCount = 0;

for (const [filePath, { lines, changes }] of fileChanges) {
  // Sort changes by line number (descending) to avoid line number shifts
  changes.sort((a, b) => b.line - a.line);

  for (const change of changes) {
    const lineIndex = change.line - 1; // Convert to 0-indexed

    if (lineIndex < 0 || lineIndex >= lines.length) {
      console.warn(`⚠️  Line ${change.line} out of bounds in ${filePath}, skipping`);
      skippedCount++;
      continue;
    }

    // Verify the line matches what we expect
    if (lines[lineIndex].trim() === change.old_content.trim()) {
      lines[lineIndex] = change.new_content;
      console.log(`✓ ${filePath}:${change.line}`);
      appliedCount++;
    } else {
      console.warn(`⚠️  Line mismatch in ${filePath}:${change.line}, skipping`);
      console.warn(`   Expected: ${change.old_content.substring(0, 60)}`);
      console.warn(`   Found:    ${lines[lineIndex].substring(0, 60)}`);
      skippedCount++;
    }
  }

  // Write updated file
  await fs.writeFile(filePath, lines.join('\n'));
}

console.log(`\n✅ Applied ${appliedCount} changes to ${fileChanges.size} files`);
if (skippedCount > 0) {
  console.log(`⚠️  Skipped ${skippedCount} changes due to mismatches or errors`);
}

// Verify with TypeScript compiler
console.log('\n🔍 Verifying with TypeScript compiler...');
try {
  execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: 'pipe' });
  console.log('✅ No TypeScript errors!');
} catch (e) {
  console.log('⚠️  Some errors remain. Run npm run ts:scan to see what\'s left.');
}

// Create git commit
console.log('\n📝 Creating git commit...');
try {
  execSync('git add -A', { stdio: 'pipe' });

  const tier1Count = approved.filter(f => f.error.tier === 'TIER1').length;
  const tier2Count = approved.filter(f => f.error.tier === 'TIER2').length;
  const tier3Count = approved.filter(f => f.error.tier === 'TIER3').length;

  const commitMessage = `fix: auto-fix ${approved.length} TypeScript errors

Applied ${approved.length} AI-generated fixes:
- Tier 1 (Auto): ${tier1Count}
- Tier 2 (Review): ${tier2Count}
- Tier 3 (Complex): ${tier3Count}

Changes: ${appliedCount} applied, ${skippedCount} skipped
Files modified: ${fileChanges.size}

Generated with AI-assisted TypeScript error pipeline`;

  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
  console.log('✅ Committed changes');
} catch (e) {
  console.log('ℹ️  No changes to commit (or commit failed)');
}

console.log('\n🎉 Done!\n');
