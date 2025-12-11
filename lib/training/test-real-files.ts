// Test with actual user files
import { detectDatasetFormat } from './format-detector';
import * as fs from 'fs';

console.log('=== Testing Real Files ===\n');

const files = [
  {
    path: '/home/juan-canfield/Desktop/web-ui/output/finetuning_expert_augmented.json',
    expected: 'sharegpt',
    description: 'Finetuning Expert Augmented (21 records)'
  },
  {
    path: '/home/juan-canfield/Desktop/web-ui/output/finetuning_expert_merged.jsonl',
    expected: 'sharegpt',
    description: 'Finetuning Expert Merged (81 records)'
  },
  {
    path: '/home/juan-canfield/Desktop/web-ui/output/tier1_factual_base_38k.jsonl',
    expected: 'sharegpt-examples',
    description: 'Tier 1 Factual Base (wrapped format)'
  }
];

for (const file of files) {
  console.log(`Testing: ${file.description}`);
  console.log(`Path: ${file.path}`);
  
  try {
    const content = fs.readFileSync(file.path, 'utf-8');
    const result = detectDatasetFormat(content);
    
    console.log(`Result: format=${result.format}, confidence=${result.confidence}`);
    console.log(`Details:`, result.details);
    
    const pass = result.format === file.expected && result.confidence === 'high';
    console.log(pass ? '✓ PASS' : '✗ FAIL');
    
  } catch (error) {
    console.error('✗ ERROR:', error instanceof Error ? error.message : error);
  }
  
  console.log('');
}
