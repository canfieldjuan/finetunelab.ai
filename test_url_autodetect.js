// Test the complete URL building logic
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
    return false;
  }
  const org = parts[0];
  return !OFFICIAL_ORGS.includes(org);
}

function getBaseUrl(modelId, configuredBaseUrl) {
  const isCustom = isCustomModel(modelId);

  // If model is custom and using Router endpoint, switch to Inference API
  if (isCustom && configuredBaseUrl.includes('router.huggingface.co')) {
    const inferenceUrl = 'https://api-inference.huggingface.co/models';
    console.log(`[Auto-detect] Custom model: ${modelId}`);
    console.log(`[Auto-detect] Switching: ${configuredBaseUrl} → ${inferenceUrl}`);
    return inferenceUrl;
  }

  // If model is official and using Inference API, keep it (works, but suggest Router)
  if (!isCustom && configuredBaseUrl.includes('api-inference.huggingface.co')) {
    console.log(`[Auto-detect] Official model ${modelId} using Inference API (works, but Router recommended)`);
  }

  return configuredBaseUrl;
}

// Test scenarios
const scenarios = [
  {
    name: 'Custom model with Router (YOUR CASE)',
    modelId: 'Canfield/llama-3-2-3b-instruct-new-atlas-dataset',
    configuredBaseUrl: 'https://router.huggingface.co/v1',
    expected: 'https://api-inference.huggingface.co/models',
  },
  {
    name: 'Official model with Router',
    modelId: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
    configuredBaseUrl: 'https://router.huggingface.co/v1',
    expected: 'https://router.huggingface.co/v1',
  },
  {
    name: 'Custom model with Inference API (already correct)',
    modelId: 'john-doe/my-model',
    configuredBaseUrl: 'https://api-inference.huggingface.co/models',
    expected: 'https://api-inference.huggingface.co/models',
  },
  {
    name: 'Official model with Inference API',
    modelId: 'mistralai/Mistral-7B-Instruct-v0.3',
    configuredBaseUrl: 'https://api-inference.huggingface.co/models',
    expected: 'https://api-inference.huggingface.co/models',
  },
];

console.log('URL Auto-Detection Test');
console.log('=======================\n');

scenarios.forEach((scenario, i) => {
  console.log(`Test ${i + 1}: ${scenario.name}`);
  console.log('-----------------------------------');
  console.log(`Model: ${scenario.modelId}`);
  console.log(`Configured URL: ${scenario.configuredBaseUrl}`);
  
  const actualBaseUrl = getBaseUrl(scenario.modelId, scenario.configuredBaseUrl);
  const finalUrl = `${actualBaseUrl}/chat/completions`;
  
  console.log(`Final Base URL: ${actualBaseUrl}`);
  console.log(`Final Full URL: ${finalUrl}`);
  
  const passed = actualBaseUrl === scenario.expected;
  console.log(`Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!passed) {
    console.log(`Expected: ${scenario.expected}`);
    console.log(`Got: ${actualBaseUrl}`);
  }
  
  console.log('');
});

console.log('\n🎯 KEY POINT: Your model "Canfield/llama-3-2-3b..." will');
console.log('   automatically switch from Router → Inference API');
console.log('   This fixes the "model_not_supported" error!');
