// Test what models vLLM server at localhost:8003 actually knows about
const fetch = require('node-fetch');

async function checkVLLMModels() {
  try {
    console.log('Checking vLLM server at http://localhost:8003...\n');

    // Try to get list of models
    const response = await fetch('http://localhost:8003/v1/models');

    if (!response.ok) {
      console.error('Failed to fetch models:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    console.log('Available models on vLLM server:');
    console.log(JSON.stringify(data, null, 2));

    if (data.data && Array.isArray(data.data)) {
      console.log('\nModel IDs that vLLM recognizes:');
      data.data.forEach((model, i) => {
        console.log(`  ${i + 1}. "${model.id}"`);
      });
    }
  } catch (error) {
    console.error('Error connecting to vLLM:', error.message);
    console.log('\nIs vLLM server running at http://localhost:8003?');
  }
}

checkVLLMModels();
