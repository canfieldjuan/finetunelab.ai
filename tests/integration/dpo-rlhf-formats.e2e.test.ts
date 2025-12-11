/**
 * DPO and RLHF Format E2E Tests
 * Tests DPO/RLHF dataset upload, validation, and format compatibility
 * Date: 2025-10-17
 */

import { describe, test, expect, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-placeholder';

interface TestData {
  dpoConfigId: string | null;
  rlhfConfigId: string | null;
  dpoDatasetId: string | null;
  rlhfDatasetId: string | null;
}

const testData: TestData = {
  dpoConfigId: null,
  rlhfConfigId: null,
  dpoDatasetId: null,
  rlhfDatasetId: null,
};

describe('DPO Format Tests', () => {
  afterAll(async () => {
    console.log('[DPO-E2E] Cleaning up test data');
    if (testData.dpoDatasetId) await cleanupDataset(testData.dpoDatasetId);
    if (testData.dpoConfigId) await cleanupConfig(testData.dpoConfigId);
  }, 30000);

  test('should create DPO config', async () => {
    console.log('[DPO-E2E] Creating DPO config');

    const response = await fetch(`${API_BASE_URL}/api/training`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        name: `DPO Config ${Date.now()}`,
        template_type: 'dpo',
        config_json: {
          model: { name: 'gpt2', trust_remote_code: false, torch_dtype: 'float16', device_map: 'auto' },
          tokenizer: { name: 'gpt2', trust_remote_code: false },
          training: { method: 'dpo', num_epochs: 1, learning_rate: 0.0001, batch_size: 2, gradient_accumulation_steps: 4, warmup_steps: 50, max_length: 512, use_lora: true },
          data: { strategy: 'custom', generation_type: 'real', max_samples: 100, train_split: 0.9 },
        },
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.config.config_json.training.method).toBe('dpo');
    testData.dpoConfigId = data.config.id;
    console.log('[DPO-E2E] DPO config created:', testData.dpoConfigId);
  }, 30000);

  test('should upload DPO dataset', async () => {
    console.log('[DPO-E2E] Uploading DPO dataset');

    const filePath = path.join(__dirname, '../fixtures/sample-dataset-dpo.jsonl');
    expect(fs.existsSync(filePath)).toBe(true);

    const fileContent = fs.readFileSync(filePath);
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'application/json' });

    formData.append('file', blob, 'sample-dataset-dpo.jsonl');
    formData.append('name', `DPO Dataset ${Date.now()}`);
    formData.append('format', 'dpo');

    const response = await fetch(`${API_BASE_URL}/api/training/dataset`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TEST_AUTH_TOKEN}` },
      body: formData,
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.dataset.format).toBe('dpo');
    expect(data.dataset.total_examples).toBe(3);
    testData.dpoDatasetId = data.dataset.id;
    console.log('[DPO-E2E] DPO dataset uploaded:', testData.dpoDatasetId);
  }, 30000);

  test('should attach DPO dataset to DPO config', async () => {
    console.log('[DPO-E2E] Attaching DPO dataset to DPO config');
    expect(testData.dpoConfigId).toBeDefined();
    expect(testData.dpoDatasetId).toBeDefined();

    const response = await fetch(
      `${API_BASE_URL}/api/training/${testData.dpoConfigId}/attach-dataset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
        body: JSON.stringify({ datasetId: testData.dpoDatasetId }),
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    console.log('[DPO-E2E] DPO dataset attached successfully');
  }, 30000);

  test('should reject ChatML dataset for DPO config', async () => {
    console.log('[DPO-E2E] Testing format validation - should reject ChatML for DPO');

    const filePath = path.join(__dirname, '../fixtures/sample-dataset-chatml.jsonl');
    const fileContent = fs.readFileSync(filePath);
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'application/json' });

    formData.append('file', blob, 'sample-dataset-chatml.jsonl');
    formData.append('name', `ChatML Dataset ${Date.now()}`);
    formData.append('format', 'chatml');

    const uploadResponse = await fetch(`${API_BASE_URL}/api/training/dataset`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TEST_AUTH_TOKEN}` },
      body: formData,
    });

    const uploadData = await uploadResponse.json();
    const chatmlDatasetId = uploadData.dataset.id;

    const response = await fetch(
      `${API_BASE_URL}/api/training/${testData.dpoConfigId}/attach-dataset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
        body: JSON.stringify({ datasetId: chatmlDatasetId }),
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('DPO requires DPO format');
    console.log('[DPO-E2E] Format validation working correctly');

    await cleanupDataset(chatmlDatasetId);
  }, 30000);
});

describe('RLHF Format Tests', () => {
  afterAll(async () => {
    console.log('[RLHF-E2E] Cleaning up test data');
    if (testData.rlhfDatasetId) await cleanupDataset(testData.rlhfDatasetId);
    if (testData.rlhfConfigId) await cleanupConfig(testData.rlhfConfigId);
  }, 30000);

  test('should create RLHF config', async () => {
    console.log('[RLHF-E2E] Creating RLHF config');

    const response = await fetch(`${API_BASE_URL}/api/training`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        name: `RLHF Config ${Date.now()}`,
        template_type: 'rlhf',
        config_json: {
          model: { name: 'gpt2', trust_remote_code: false, torch_dtype: 'float16', device_map: 'auto' },
          tokenizer: { name: 'gpt2', trust_remote_code: false },
          training: { method: 'rlhf', num_epochs: 1, learning_rate: 0.0001, batch_size: 2, gradient_accumulation_steps: 4, warmup_steps: 50, max_length: 512, use_lora: true },
          data: { strategy: 'custom', generation_type: 'real', max_samples: 100, train_split: 0.9 },
        },
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.config.config_json.training.method).toBe('rlhf');
    testData.rlhfConfigId = data.config.id;
    console.log('[RLHF-E2E] RLHF config created:', testData.rlhfConfigId);
  }, 30000);

  test('should upload RLHF dataset', async () => {
    console.log('[RLHF-E2E] Uploading RLHF dataset');

    const filePath = path.join(__dirname, '../fixtures/sample-dataset-rlhf.jsonl');
    expect(fs.existsSync(filePath)).toBe(true);

    const fileContent = fs.readFileSync(filePath);
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'application/json' });

    formData.append('file', blob, 'sample-dataset-rlhf.jsonl');
    formData.append('name', `RLHF Dataset ${Date.now()}`);
    formData.append('format', 'rlhf');

    const response = await fetch(`${API_BASE_URL}/api/training/dataset`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TEST_AUTH_TOKEN}` },
      body: formData,
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.dataset.format).toBe('rlhf');
    expect(data.dataset.total_examples).toBe(3);
    testData.rlhfDatasetId = data.dataset.id;
    console.log('[RLHF-E2E] RLHF dataset uploaded:', testData.rlhfDatasetId);
  }, 30000);

  test('should attach RLHF dataset to RLHF config', async () => {
    console.log('[RLHF-E2E] Attaching RLHF dataset to RLHF config');
    expect(testData.rlhfConfigId).toBeDefined();
    expect(testData.rlhfDatasetId).toBeDefined();

    const response = await fetch(
      `${API_BASE_URL}/api/training/${testData.rlhfConfigId}/attach-dataset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
        body: JSON.stringify({ datasetId: testData.rlhfDatasetId }),
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    console.log('[RLHF-E2E] RLHF dataset attached successfully');
  }, 30000);
});

async function cleanupDataset(datasetId: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/training/dataset/${datasetId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${TEST_AUTH_TOKEN}` },
    });
    console.log('[Cleanup] Dataset deleted:', datasetId);
  } catch (error) {
    console.log('[Cleanup] Dataset deletion error:', error);
  }
}

async function cleanupConfig(configId: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/training/${configId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${TEST_AUTH_TOKEN}` },
    });
    console.log('[Cleanup] Config deleted:', configId);
  } catch (error) {
    console.log('[Cleanup] Config deletion error:', error);
  }
}

console.log('[DPO-RLHF-E2E] Test suite loaded');
