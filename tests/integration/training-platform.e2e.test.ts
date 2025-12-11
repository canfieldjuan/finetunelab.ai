/**
 * Training Platform E2E Tests
 * Tests complete workflow: config creation, dataset upload, package generation, public API
 * Date: 2025-10-17
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { SFT_STANDARD_TEMPLATE } from '../../lib/training/training-templates';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-placeholder';

interface TestContext {
  configId: string | null;
  datasetId: string | null;
  publicId: string | null;
}

const testContext: TestContext = {
  configId: null,
  datasetId: null,
  publicId: null,
};

describe('Training Platform E2E Tests', () => {
  console.log('[E2E] Starting Training Platform E2E tests');

  beforeAll(() => {
    console.log('[E2E] Test environment:', {
      apiUrl: API_BASE_URL,
      hasAuthToken: !!TEST_AUTH_TOKEN,
    });
  });

  afterAll(async () => {
    console.log('[E2E] Cleaning up test data');

    if (testContext.datasetId) {
      console.log('[E2E] Deleting test dataset:', testContext.datasetId);
      await cleanupDataset(testContext.datasetId);
    }

    if (testContext.configId) {
      console.log('[E2E] Deleting test config:', testContext.configId);
      await cleanupConfig(testContext.configId);
    }
  });

  test('should create a training config', async () => {
    console.log('[E2E] Test 1: Creating training config');

    const configPayload = {
      name: `E2E Test Config ${Date.now()}`,
      template_type: 'sft_standard',
      config_json: {
        ...SFT_STANDARD_TEMPLATE,
        data: {
          ...SFT_STANDARD_TEMPLATE.data,
          strategy: 'custom',
          max_samples: 100,
        },
      },
    };

    const response = await fetch(`${API_BASE_URL}/api/training`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(configPayload),
    });

    console.log('[E2E] Config creation response status:', response.status);
    expect(response.status).toBe(201);

    const data = await response.json();
    console.log('[E2E] Config created:', data.config?.id);

    expect(data.config).toBeDefined();
    expect(data.config.id).toBeDefined();
    expect(data.config.name).toBe(configPayload.name);

    testContext.configId = data.config.id;
  }, 30000);

  test('should upload a training dataset', async () => {
    console.log('[E2E] Test 2: Uploading training dataset');

    const datasetPath = path.join(
      __dirname,
      '../fixtures/sample-dataset-chatml.jsonl'
    );

    expect(fs.existsSync(datasetPath)).toBe(true);

    const fileContent = fs.readFileSync(datasetPath);
    const formData = new FormData();

    const blob = new Blob([fileContent], { type: 'application/json' });
    formData.append('file', blob, 'sample-dataset.jsonl');
    formData.append('name', `E2E Test Dataset ${Date.now()}`);
    formData.append('description', 'Test dataset for E2E testing');
    formData.append('format', 'chatml');

    const response = await fetch(`${API_BASE_URL}/api/training/dataset`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: formData,
    });

    console.log('[E2E] Dataset upload response status:', response.status);
    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[E2E] Dataset uploaded:', data.dataset?.id);

    expect(data.dataset).toBeDefined();
    expect(data.dataset.id).toBeDefined();
    expect(data.dataset.format).toBe('chatml');
    expect(data.dataset.total_examples).toBeGreaterThan(0);

    testContext.datasetId = data.dataset.id;
  }, 30000);

  test('should attach dataset to config', async () => {
    console.log('[E2E] Test 3: Attaching dataset to config');

    expect(testContext.configId).toBeDefined();
    expect(testContext.datasetId).toBeDefined();

    const response = await fetch(
      `${API_BASE_URL}/api/training/${testContext.configId}/attach-dataset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
        body: JSON.stringify({ datasetId: testContext.datasetId }),
      }
    );

    console.log('[E2E] Dataset attachment response status:', response.status);
    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[E2E] Dataset attached successfully');
    expect(data.success).toBe(true);
  }, 30000);

  test('should generate public training package', async () => {
    console.log('[E2E] Test 4: Generating public training package');

    expect(testContext.configId).toBeDefined();

    const response = await fetch(
      `${API_BASE_URL}/api/training/${testContext.configId}/generate-package`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
      }
    );

    console.log('[E2E] Package generation response status:', response.status);
    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[E2E] Public package generated:', data.public_id);

    expect(data.public_id).toBeDefined();
    expect(data.public_id).toMatch(/^train_/);

    testContext.publicId = data.public_id;
  }, 30000);

  test('should fetch config from public API', async () => {
    console.log('[E2E] Test 5: Fetching config from public API');

    expect(testContext.publicId).toBeDefined();

    const response = await fetch(
      `${API_BASE_URL}/api/training/public/${testContext.publicId}`
    );

    console.log('[E2E] Public config fetch response status:', response.status);
    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[E2E] Public config fetched successfully');

    expect(data.config).toBeDefined();
    expect(data.config.id).toBe(testContext.configId);
    expect(data.config.config_json).toBeDefined();
    expect(data.config.config_json.training.method).toBe('sft');
  }, 30000);

  test('should fetch dataset from public API', async () => {
    console.log('[E2E] Test 6: Fetching dataset from public API');

    expect(testContext.publicId).toBeDefined();

    const response = await fetch(
      `${API_BASE_URL}/api/training/public/${testContext.publicId}/dataset`
    );

    console.log('[E2E] Public dataset fetch response status:', response.status);
    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[E2E] Public dataset fetched successfully');

    expect(data.datasets).toBeDefined();
    expect(Array.isArray(data.datasets)).toBe(true);
    expect(data.datasets.length).toBeGreaterThan(0);

    const dataset = data.datasets[0];
    expect(dataset.download_url).toBeDefined();
    expect(dataset.format).toBe('chatml');
    expect(dataset.total_examples).toBeGreaterThan(0);
  }, 30000);

  test('should revoke public access', async () => {
    console.log('[E2E] Test 7: Revoking public access');

    expect(testContext.configId).toBeDefined();

    const response = await fetch(
      `${API_BASE_URL}/api/training/${testContext.configId}/generate-package`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
      }
    );

    console.log('[E2E] Revoke access response status:', response.status);
    expect(response.status).toBe(200);

    console.log('[E2E] Verifying public access is revoked');

    const publicResponse = await fetch(
      `${API_BASE_URL}/api/training/public/${testContext.publicId}`
    );

    console.log('[E2E] Public API response after revoke:', publicResponse.status);
    expect(publicResponse.status).toBe(404);
  }, 30000);
});

async function cleanupDataset(datasetId: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/training/dataset/${datasetId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
      }
    );

    if (response.ok) {
      console.log('[E2E] Dataset cleanup successful');
    } else {
      console.log('[E2E] Dataset cleanup failed:', response.status);
    }
  } catch (error) {
    console.log('[E2E] Dataset cleanup error:', error);
  }
}

async function cleanupConfig(configId: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/training/${configId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
      }
    );

    if (response.ok) {
      console.log('[E2E] Config cleanup successful');
    } else {
      console.log('[E2E] Config cleanup failed:', response.status);
    }
  } catch (error) {
    console.log('[E2E] Config cleanup error:', error);
  }
}

console.log('[E2E] Training Platform E2E test suite loaded');
