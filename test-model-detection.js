const fs = require('fs').promises;
const path = require('path');

const MODEL_FILE_PATTERNS = {
  config: ['config.json', 'model_config.json'],
  weights: [
    'pytorch_model.bin',
    'model.safetensors',
    'adapter_model.bin',
    'model.onnx',
    'tf_model.h5',
  ],
};

function isModelDirectory(files) {
  const hasConfig = files.some(f => MODEL_FILE_PATTERNS.config.includes(f));
  const hasWeights = files.some(f =>
    MODEL_FILE_PATTERNS.weights.some(pattern => f.includes(pattern) || f.endsWith(pattern.split('.')[1]))
  );
  return hasConfig || hasWeights;
}

async function testSpecificPath() {
  const testPath = '/home/juan-canfield/Desktop/web-ui/AI_Models/huggingface_models/models-Qwen-Qwen2.5-3B-Instruct/snapshots/aa8e72537993ba99e69dfaafa59ed015b17504d1';
  
  console.log('Testing path:', testPath);
  console.log('');
  
  try {
    const entries = await fs.readdir(testPath, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => e.name);
    
    console.log('Files found:', files.length);
    files.forEach(f => console.log('  -', f));
    
    console.log('');
    console.log('isModelDirectory():', isModelDirectory(files));
    
    const hasConfig = files.some(f => MODEL_FILE_PATTERNS.config.includes(f));
    const hasWeights = files.some(f =>
      MODEL_FILE_PATTERNS.weights.some(pattern => f.includes(pattern) || f.endsWith(pattern.split('.')[1]))
    );
    
    console.log('Has config:', hasConfig);
    console.log('Has weights:', hasWeights);
    
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

testSpecificPath();
