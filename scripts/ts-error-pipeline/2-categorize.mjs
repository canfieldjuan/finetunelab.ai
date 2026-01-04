#!/usr/bin/env node
/**
 * Phase 2: Categorize Errors by Complexity
 * Uses qwen2.5-coder:32b to categorize errors into tiers
 */

import fs from 'fs/promises';
import { loadConfig } from './lib/load-env-config.mjs';
import { createClientFromConfig } from './lib/ollama-client.mjs';

console.log('🏷️  Categorizing errors by complexity...\n');

// Load config (with .env merged)
const config = await loadConfig();

// Use tier1 model for categorization (fast and code-aware)
const ollama = createClientFromConfig(config.models.tier1, config.ollama);

// Load errors
const errors = JSON.parse(
  await fs.readFile('scripts/ts-error-pipeline/output/errors.json', 'utf8')
);

const categorized = {
  tier1_auto: [],      // Auto-fixable with high confidence
  tier2_review: [],    // Fixable but needs review
  tier3_complex: [],   // Complex, needs careful thought
};

// Process in batches of 10
const BATCH_SIZE = 10;
for (let i = 0; i < errors.length; i += BATCH_SIZE) {
  const batch = errors.slice(i, i + BATCH_SIZE);

  const prompt = `You are a TypeScript error categorization system. For each error, determine its complexity and confidence in fixing it.

Categorize each error as:
- TIER1: Simple, deterministic fix (missing type, obvious assertion, unused import)
- TIER2: Fixable but requires judgment (type inference, small refactor)
- TIER3: Complex (architectural issue, breaking change, ambiguous)

Return ONLY a JSON array with this format:
[
  {
    "index": 0,
    "tier": "TIER1",
    "confidence": 0.95,
    "reason": "Missing type annotation - straightforward fix"
  },
  ...
]

Errors to categorize:
${batch.map((err, idx) => `
[${idx}] ${err.file}:${err.line}
Error: ${err.code} - ${err.message}
Context:
${err.context?.errorLine || 'N/A'}
`).join('\n---\n')}`;

  console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(errors.length / BATCH_SIZE)}...`);

  try {
    const response = await ollama.generate(prompt);

    // Clean up response (remove markdown code blocks if present)
    let jsonResponse = response.trim();
    jsonResponse = jsonResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

    const results = JSON.parse(jsonResponse);

    for (const result of results) {
      const error = batch[result.index];
      error.tier = result.tier;
      error.confidence = result.confidence;
      error.categorizationReason = result.reason;

      if (result.tier === 'TIER1' && result.confidence > 0.85) {
        categorized.tier1_auto.push(error);
      } else if (result.tier === 'TIER2' || (result.tier === 'TIER1' && result.confidence <= 0.85)) {
        categorized.tier2_review.push(error);
      } else {
        categorized.tier3_complex.push(error);
      }
    }
  } catch (e) {
    console.error('Failed to parse categorization response:', e.message);
    // Default to tier2 for safety
    batch.forEach(err => {
      err.tier = 'TIER2';
      err.confidence = 0.5;
      err.categorizationReason = 'Failed to categorize, defaulted to TIER2';
      categorized.tier2_review.push(err);
    });
  }

  console.log(`Processed ${Math.min(i + BATCH_SIZE, errors.length)}/${errors.length} errors`);
}

// Save categorized errors
await fs.mkdir('scripts/ts-error-pipeline/output/fixes', { recursive: true });

await fs.writeFile(
  'scripts/ts-error-pipeline/output/fixes/tier1-auto.json',
  JSON.stringify(categorized.tier1_auto, null, 2)
);
await fs.writeFile(
  'scripts/ts-error-pipeline/output/fixes/tier2-review.json',
  JSON.stringify(categorized.tier2_review, null, 2)
);
await fs.writeFile(
  'scripts/ts-error-pipeline/output/fixes/tier3-complex.json',
  JSON.stringify(categorized.tier3_complex, null, 2)
);

console.log('\n✅ Categorization complete:');
console.log(`   Tier 1 (Auto-fix): ${categorized.tier1_auto.length}`);
console.log(`   Tier 2 (Review): ${categorized.tier2_review.length}`);
console.log(`   Tier 3 (Complex): ${categorized.tier3_complex.length}`);

console.log('\n📝 Next step: npm run ts:fix\n');
