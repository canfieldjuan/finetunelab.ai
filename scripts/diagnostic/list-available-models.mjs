#!/usr/bin/env node

/**
 * Show what models are available for each provider
 */

console.log('=== PROVIDER MODEL COMPATIBILITY ===\n');

console.log('OpenAI (https://api.openai.com/v1):');
console.log('  ✓ gpt-4o');
console.log('  ✓ gpt-4o-mini');
console.log('  ✓ gpt-4-turbo');
console.log('  ✓ gpt-4');
console.log('  ✓ gpt-3.5-turbo');
console.log('  ✗ z-ai/glm-4.7  (NOT AVAILABLE)');
console.log('');

console.log('OpenRouter (https://openrouter.ai/api/v1):');
console.log('  ✓ zhipuai/glm-4');
console.log('  ✓ zhipuai/glm-4-plus');
console.log('  ✓ openai/gpt-4o');
console.log('  ✓ openai/gpt-4o-mini');
console.log('  ✓ anthropic/claude-3.5-sonnet');
console.log('  + 200+ other models');
console.log('');

console.log('Together.ai (https://api.together.xyz/v1):');
console.log('  ✓ Zhipu/glm-4-9b-chat');
console.log('  ✓ meta-llama/Llama-3-70b-chat-hf');
console.log('  ✓ mistralai/Mixtral-8x7B-Instruct-v0.1');
console.log('');

console.log('=== YOUR CURRENT CONFIGURATION ===\n');
console.log('Provider: openai');
console.log('Model ID: z-ai/glm-4.7');
console.log('Base URL: https://api.openai.com/v1');
console.log('');
console.log('❌ MISMATCH: OpenAI API does not support z-ai/glm-4.7');
console.log('');

console.log('=== REQUIRED CHANGES ===\n');
console.log('OPTION 1: Use a real OpenAI model');
console.log('  Provider: openai');
console.log('  Base URL: https://api.openai.com/v1');
console.log('  Model ID: gpt-4o-mini  (or gpt-4o, gpt-4-turbo, etc.)');
console.log('  API Key: Your OpenAI API key (already set ✓)');
console.log('');

console.log('OPTION 2: Use OpenRouter to access GLM models');
console.log('  Provider: openrouter');
console.log('  Base URL: https://openrouter.ai/api/v1');
console.log('  Model ID: zhipuai/glm-4');
console.log('  API Key: Need OpenRouter API key');
console.log('');

console.log('OPTION 3: Use Together.ai for GLM models');
console.log('  Provider: together');
console.log('  Base URL: https://api.together.xyz/v1');
console.log('  Model ID: Zhipu/glm-4-9b-chat');
console.log('  API Key: Need Together.ai API key');
