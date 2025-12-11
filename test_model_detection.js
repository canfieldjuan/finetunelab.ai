// Test the model detection logic
const OFFICIAL_ORGS = [
  'meta-llama',
  'mistralai',
  'HuggingFaceH4',
  'google',
  'microsoft',
  'facebook',
  'openai-community',
  'bigscience',
  'EleutherAI',
  'stabilityai',
  'databricks',
  'Qwen',
  'gpt2',
];

function isCustomModel(modelId) {
  const parts = modelId.split('/');
  if (parts.length === 1) {
    return false; // No slash, assume official
  }
  const org = parts[0];
  return !OFFICIAL_ORGS.includes(org);
}

// Test cases
const testModels = [
  'Canfield/llama-3-2-3b-instruct-new-atlas-dataset',
  'meta-llama/Meta-Llama-3.1-8B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'HuggingFaceH4/zephyr-7b-beta',
  'gpt2',
  'john-doe/my-custom-model',
  'Qwen/Qwen2.5-0.5B',
];

console.log('Model Detection Test:');
console.log('=====================\n');

testModels.forEach(model => {
  const isCustom = isCustomModel(model);
  const endpoint = isCustom ? 'Inference API' : 'Router';
  const type = isCustom ? 'Custom' : 'Official';
  console.log(`${model}`);
  console.log(`  Type: ${type}`);
  console.log(`  Endpoint: ${endpoint}`);
  console.log('');
});
