/**
 * Direct test of scanner to see console logs
 */

import { scanLocalModels } from './lib/models/local-model-scanner.ts';

console.log('Starting direct scanner test...\n');

const models = await scanLocalModels();

console.log(`\n\n=== RESULTS ===`);
console.log(`Total models found: ${models.length}`);

const hfModels = models.filter(m => m.relativePath.startsWith('huggingface_models/'));
console.log(`\nHuggingFace models: ${hfModels.length}`);

hfModels.forEach(m => {
  console.log(`  - ${m.name} (${m.relativePath})`);
});
