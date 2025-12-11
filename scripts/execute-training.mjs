#!/usr/bin/env node
/**
 * Execute Training Script
 * Purpose: Create config, make it public, and execute training
 * Usage: node scripts/execute-training.mjs
 * Date: 2025-10-28
 */

import { createClient } from '@supabase/supabase-js';

const AUTH_TOKEN = process.env.AUTH_TOKEN || process.argv[2];
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

if (!AUTH_TOKEN) {
  console.error('[ExecuteTraining] ERROR: AUTH_TOKEN required');
  console.error('[ExecuteTraining] Usage: AUTH_TOKEN=your_token node scripts/execute-training.mjs');
  console.error('[ExecuteTraining] Or: node scripts/execute-training.mjs your_token');
  process.exit(1);
}

console.log('[ExecuteTraining] Starting training execution');
console.log('[ExecuteTraining] API Base:', API_BASE);
console.log('[ExecuteTraining] Auth token:', AUTH_TOKEN.substring(0, 20) + '...');

// Training configuration
const TRAINING_CONFIG = {
  model: {
    name: "Qwen/Qwen3-0.6B"
  },
  tokenizer: {
    name: "Qwen/Qwen3-0.6B"
  },
  lora: {
    r: 8,
    alpha: 16,
    dropout: 0.05,
    target_modules: ["q_proj", "v_proj", "k_proj", "o_proj"]
  },
  data: {
    strategy: "chat"
  },
  training: {
    method: "sft",
    num_epochs: 1,
    batch_size: 16,
    gradient_accumulation_steps: 2,
    learning_rate: 0.0002,
    warmup_steps: 150,
    logging_steps: 50,
    eval_steps: 500,
    save_steps: 500
  },
  dataset_path: "C:/Users/Juan/Desktop/Dev_Ops/finetune-lab/hybrid_training_50k_balanced.json",
  eval_split: 0.2
};

// Step 1: Create config in database
async function createConfig() {
  console.log('[ExecuteTraining] Step 1: Creating config in database');

  const response = await fetch(`${API_BASE}/api/training`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`
    },
    body: JSON.stringify({
      name: `Qwen-optimized-${Date.now()}`,
      description: 'Optimized config: batch_size=16, gradient_accumulation=2, eval_steps=500',
      template_type: 'sft',
      config_json: TRAINING_CONFIG
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create config: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('[ExecuteTraining] Config created, ID:', data.config.id);
  return data.config;
}

// Step 2: Make config public and get public_id
async function makeConfigPublic(configId) {
  console.log('[ExecuteTraining] Step 2: Making config public');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`
      }
    }
  });

  const { data, error } = await supabase.rpc('make_config_public', {
    config_id: configId
  });

  if (error || !data) {
    throw new Error(`Failed to make config public: ${error?.message || 'Unknown error'}`);
  }

  console.log('[ExecuteTraining] Config made public, public_id:', data);
  return data;
}

// Step 2.5: Attach dataset to config
async function attachDataset(configId) {
  console.log('[ExecuteTraining] Step 2.5: Attaching dataset to config');

  const response = await fetch(`${API_BASE}/api/training/${configId}/attach-dataset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`
    },
    body: JSON.stringify({
      dataset_path: DATASET_PATH
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to attach dataset: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('[ExecuteTraining] Dataset attached successfully');
  return data;
}

// Step 3: Execute training with public_id
async function executeTraining(publicId) {
  console.log('[ExecuteTraining] Step 3: Executing training');

  const response = await fetch(`${API_BASE}/api/training/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`
    },
    body: JSON.stringify({
      public_id: publicId,
      method: 'sft',
      provider: 'local'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to execute training: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('[ExecuteTraining] Training execution started');
  console.log('[ExecuteTraining] Execution ID:', data.execution_id);
  console.log('[ExecuteTraining] Job ID:', data.job_id);
  console.log('[ExecuteTraining] Status:', data.status);
  return data;
}

// Main execution flow
async function main() {
  try {
    console.log('[ExecuteTraining] ========================================');
    console.log('[ExecuteTraining] Starting Training Execution Flow');
    console.log('[ExecuteTraining] ========================================');

    const config = await createConfig();
    const publicId = await makeConfigPublic(config.id);
    const execution = await executeTraining(publicId);

    console.log('[ExecuteTraining] ========================================');
    console.log('[ExecuteTraining] SUCCESS - Training Started');
    console.log('[ExecuteTraining] ========================================');
    console.log('[ExecuteTraining] Monitor at:', `http://localhost:3000/training/monitor?jobId=${execution.job_id}`);
    console.log('[ExecuteTraining] Config:', `http://localhost:3000/training/${config.id}`);
    console.log('[ExecuteTraining] ========================================');

    process.exit(0);
  } catch (error) {
    console.error('[ExecuteTraining] ========================================');
    console.error('[ExecuteTraining] ERROR:', error.message);
    console.error('[ExecuteTraining] ========================================');
    process.exit(1);
  }
}

main();
