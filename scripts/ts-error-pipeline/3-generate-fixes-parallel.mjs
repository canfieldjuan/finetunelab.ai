#!/usr/bin/env node
/**
 * Phase 3: Generate Fixes (Parallel)
 * Runs all 3 tiers in parallel for faster execution
 */

import fs from 'fs/promises';
import path from 'path';
import { loadConfig } from './lib/load-env-config.mjs';
import { createClientFromConfig } from './lib/ollama-client.mjs';

console.log('🔧 Generating fixes (parallel mode)...\n');

// Load config (with .env merged)
const config = await loadConfig();

// Create clients for each tier
const MODELS = {
  tier1: createClientFromConfig(config.models.tier1, config.ollama),
  tier2: createClientFromConfig(config.models.tier2, config.ollama),
  tier3: createClientFromConfig(config.models.tier3, config.ollama),
};

// Fallback to cloud if enabled
const FALLBACK_MODELS = config.execution.use_cloud_fallback && config.cloud_models ? {
  tier2: createClientFromConfig(config.cloud_models.tier2, config.ollama),
  tier3: createClientFromConfig(config.cloud_models.tier3, config.ollama),
} : null;

async function generateFixForError(error, tier) {
  const model = MODELS[tier];

  // Read full file content
  let fileContent;
  try {
    fileContent = await fs.readFile(error.file, 'utf8');
  } catch (e) {
    console.error(`Cannot read file ${error.file}:`, e.message);
    return {
      error,
      fix: null,
      model: model.model,
      error_message: `Cannot read file: ${e.message}`,
      generated_at: new Date().toISOString()
    };
  }

  const lines = fileContent.split('\n');

  // Get broader context (20 lines before and after)
  const startLine = Math.max(0, error.line - 21);
  const endLine = Math.min(lines.length, error.line + 20);
  const context = lines.slice(startLine, endLine).join('\n');

  const prompt = `You are a TypeScript error fixing assistant. Fix the following error:

File: ${error.file}
Line: ${error.line}
Error: ${error.code} - ${error.message}

Context (line ${startLine + 1} to ${endLine}):
\`\`\`typescript
${context}
\`\`\`

Full file content:
\`\`\`typescript
${fileContent}
\`\`\`

Instructions:
1. Identify the root cause
2. Propose the minimal fix
3. Return ONLY a JSON object with this exact format:

{
  "analysis": "Brief explanation of the issue",
  "fix_type": "add_interface" | "add_type_assertion" | "modify_code" | "import_missing_type",
  "changes": [
    {
      "line": <line_number>,
      "old_content": "exact line to replace",
      "new_content": "replacement content"
    }
  ],
  "additional_changes": [
    {
      "file": "path/to/file.ts",
      "line": <line>,
      "old_content": "...",
      "new_content": "..."
    }
  ],
  "confidence": 0.0-1.0,
  "notes": "Any caveats or things to watch for"
}

Return ONLY the JSON, no markdown formatting, no explanation before or after.`;

  try {
    const response = await model.generate(prompt, { maxTokens: 3000 });

    // Handle DeepSeek-R1's thinking output
    let jsonResponse = response;
    if (response.includes('<think>')) {
      const thinkEnd = response.lastIndexOf('</think>');
      if (thinkEnd !== -1) {
        jsonResponse = response.substring(thinkEnd + 8).trim();
      }
    }

    // Clean up markdown code blocks if present
    jsonResponse = jsonResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

    // Try to extract JSON if there's text before/after
    const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonResponse = jsonMatch[0];
    }

    const fix = JSON.parse(jsonResponse);

    return {
      error,
      fix,
      model: model.model,
      provider: model.provider,
      generated_at: new Date().toISOString()
    };
  } catch (e) {
    // Try fallback to cloud if enabled and available
    if (FALLBACK_MODELS && FALLBACK_MODELS[tier] && model.provider === 'local') {
      console.log(`  ↻ Retrying with cloud model for ${error.file}:${error.line}`);
      try {
        const fallbackModel = FALLBACK_MODELS[tier];
        const response = await fallbackModel.generate(prompt, { maxTokens: 3000 });

        let jsonResponse = response;
        if (response.includes('<think>')) {
          const thinkEnd = response.lastIndexOf('</think>');
          if (thinkEnd !== -1) {
            jsonResponse = response.substring(thinkEnd + 8).trim();
          }
        }

        jsonResponse = jsonResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
        const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonResponse = jsonMatch[0];
        }

        const fix = JSON.parse(jsonResponse);

        return {
          error,
          fix,
          model: fallbackModel.model,
          provider: 'cloud (fallback)',
          generated_at: new Date().toISOString()
        };
      } catch (fallbackError) {
        console.error(`  ✗ Cloud fallback also failed: ${fallbackError.message}`);
      }
    }

    console.error(`Failed to generate fix for ${error.file}:${error.line}:`, e.message);
    return {
      error,
      fix: null,
      model: model.model,
      provider: model.provider,
      error_message: e.message,
      generated_at: new Date().toISOString()
    };
  }
}

// Process each tier IN PARALLEL
const tierFiles = {
  tier1: 'tier1-auto.json',
  tier2: 'tier2-review.json',
  tier3: 'tier3-complex.json'
};

// Start all tiers at once
const tierPromises = Object.entries(tierFiles).map(async ([tier, filename]) => {
  const filepath = `scripts/ts-error-pipeline/output/fixes/${filename}`;

  let errors;
  try {
    errors = JSON.parse(await fs.readFile(filepath, 'utf8'));
  } catch (e) {
    console.log(`⚠️  No ${filename} found, skipping ${tier}`);
    return { tier, fixes: [], skipped: true };
  }

  if (errors.length === 0) {
    console.log(`ℹ️  No errors in ${tier}, skipping\n`);
    return { tier, fixes: [], skipped: true };
  }

  console.log(`📝 Processing ${errors.length} ${tier} errors with ${MODELS[tier].model} (${MODELS[tier].provider})...`);

  const fixes = [];
  for (let i = 0; i < errors.length; i++) {
    console.log(`  [${tier}] [${i + 1}/${errors.length}] ${errors[i].file}:${errors[i].line}`);
    const fix = await generateFixForError(errors[i], tier);
    fixes.push(fix);

    // Save incrementally every 5 fixes
    if ((i + 1) % 5 === 0) {
      await fs.writeFile(
        `scripts/ts-error-pipeline/output/fixes/${tier}-generated.json`,
        JSON.stringify(fixes, null, 2)
      );
    }
  }

  await fs.writeFile(
    `scripts/ts-error-pipeline/output/fixes/${tier}-generated.json`,
    JSON.stringify(fixes, null, 2)
  );

  const successCount = fixes.filter(f => f.fix !== null).length;
  console.log(`✅ [${tier}] Generated ${successCount}/${errors.length} fixes`);

  return { tier, fixes, total: errors.length, success: successCount };
});

// Wait for all tiers to complete
console.log('\n⏳ Running all tiers in parallel...\n');
const results = await Promise.all(tierPromises);

// Summary
console.log('\n✅ Parallel fix generation complete!');
console.log('\nResults:');
results.forEach(({ tier, total, success, skipped }) => {
  if (skipped) {
    console.log(`  ${tier}: skipped (no errors)`);
  } else {
    console.log(`  ${tier}: ${success}/${total} fixes generated`);
  }
});

console.log('\n📝 Next step: npm run ts:review\n');
