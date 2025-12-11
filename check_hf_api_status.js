// Test what endpoints HuggingFace actually supports now
// Based on the 410 error: api-inference.huggingface.co is deprecated

console.log('HuggingFace API Status Check');
console.log('============================\n');

console.log('DEPRECATED (410 Gone):');
console.log('  ❌ https://api-inference.huggingface.co');
console.log('  ❌ https://api-inference.huggingface.co/models');
console.log('');

console.log('CURRENT (Active):');
console.log('  ✅ https://router.huggingface.co/v1');
console.log('  ✅ https://api-inference.huggingface.co/models/[MODEL_ID] (direct model endpoint)');
console.log('');

console.log('KEY INSIGHT:');
console.log('The Router API only supports specific models that are:');
console.log('  1. Hosted by third-party providers (OpenAI, Anthropic, etc.)');
console.log('  2. Popular open-source models with dedicated inference');
console.log('');

console.log('For custom fine-tuned models:');
console.log('  - Router does NOT support them (returns model_not_supported)');
console.log('  - Old Inference API is deprecated (returns 410 Gone)');
console.log('  - NEW: Must use direct model endpoint with dedicated inference');
console.log('');

console.log('SOLUTION for Canfield/llama-3-2-3b-instruct-new-atlas-dataset:');
console.log('  Option 1: Deploy model to dedicated inference endpoint');
console.log('  Option 2: Use HuggingFace Inference Endpoints (paid service)');
console.log('  Option 3: Deploy locally with vLLM/Ollama');
console.log('  Option 4: Check if model works with new Serverless Inference API');
