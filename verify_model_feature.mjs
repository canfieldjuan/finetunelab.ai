#!/usr/bin/env node
/**
 * Model Identification Feature - Quick Verification
 * 
 * This script verifies that all components are properly integrated
 * and the feature is ready for testing.
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Model Identification Feature - Verification\n');
console.log('='.repeat(60));
console.log('');

const checks = [];

// Check 1: Message interface updated
const typesPath = join(__dirname, 'components/chat/types.ts');
if (existsSync(typesPath)) {
  const content = readFileSync(typesPath, 'utf-8');
  const hasModelFields = content.includes('model_name?:') && 
                        content.includes('input_tokens?:') && 
                        content.includes('latency_ms?:');
  checks.push({
    name: 'Message interface updated',
    passed: hasModelFields,
    file: 'components/chat/types.ts'
  });
} else {
  checks.push({
    name: 'Message interface updated',
    passed: false,
    file: 'components/chat/types.ts',
    error: 'File not found'
  });
}

// Check 2: MessageMetadata component exists
const metadataPath = join(__dirname, 'components/chat/MessageMetadata.tsx');
if (existsSync(metadataPath)) {
  const content = readFileSync(metadataPath, 'utf-8');
  const hasExport = content.includes('export function MessageMetadata');
  const hasIcons = content.includes('Cpu') && content.includes('Activity') && content.includes('Zap');
  checks.push({
    name: 'MessageMetadata component created',
    passed: hasExport && hasIcons,
    file: 'components/chat/MessageMetadata.tsx'
  });
} else {
  checks.push({
    name: 'MessageMetadata component created',
    passed: false,
    file: 'components/chat/MessageMetadata.tsx',
    error: 'File not found'
  });
}

// Check 3: useMessages fetches model names
const useMessagesPath = join(__dirname, 'components/hooks/useMessages.ts');
if (existsSync(useMessagesPath)) {
  const content = readFileSync(useMessagesPath, 'utf-8');
  const fetchesModels = content.includes("from('llm_models')") && 
                       content.includes('modelMap');
  const hasLogging = content.includes("'Fetching model names'") ||
                    content.includes("'Fetched model names'");
  checks.push({
    name: 'useMessages fetches model names',
    passed: fetchesModels,
    file: 'components/hooks/useMessages.ts',
    details: hasLogging ? '✓ Debug logging present' : '⚠ Missing debug logs'
  });
} else {
  checks.push({
    name: 'useMessages fetches model names',
    passed: false,
    file: 'components/hooks/useMessages.ts',
    error: 'File not found'
  });
}

// Check 4: MessageList integrates MessageMetadata
const messageListPath = join(__dirname, 'components/chat/MessageList.tsx');
if (existsSync(messageListPath)) {
  const content = readFileSync(messageListPath, 'utf-8');
  const importsComponent = content.includes("import { MessageMetadata }");
  const usesComponent = content.includes('<MessageMetadata');
  checks.push({
    name: 'MessageList integrates MessageMetadata',
    passed: importsComponent && usesComponent,
    file: 'components/chat/MessageList.tsx'
  });
} else {
  checks.push({
    name: 'MessageList integrates MessageMetadata',
    passed: false,
    file: 'components/chat/MessageList.tsx',
    error: 'File not found'
  });
}

// Display results
console.log('📋 Verification Results:\n');

let allPassed = true;
checks.forEach((check, index) => {
  const icon = check.passed ? '✅' : '❌';
  console.log(`${index + 1}. ${icon} ${check.name}`);
  console.log(`   File: ${check.file}`);
  if (check.error) {
    console.log(`   Error: ${check.error}`);
    allPassed = false;
  }
  if (check.details) {
    console.log(`   ${check.details}`);
  }
  if (!check.passed) {
    allPassed = false;
  }
  console.log('');
});

console.log('='.repeat(60));
console.log('');

if (allPassed) {
  console.log('✅ All checks passed! Feature is ready for testing.\n');
  console.log('📝 Next Steps:');
  console.log('   1. Start dev server: npm run dev');
  console.log('   2. Open chat interface');
  console.log('   3. Send messages with different models');
  console.log('   4. Verify metadata displays correctly');
  console.log('   5. Check MODEL_IDENTIFICATION_IMPLEMENTATION.md for details');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please review the errors above.\n');
  process.exit(1);
}
