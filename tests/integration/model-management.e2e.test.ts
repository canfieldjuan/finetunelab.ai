/**
 * Model Management E2E Tests
 * Tests LLM model CRUD operations and connection testing
 * Date: 2025-10-17
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-placeholder';

interface TestContext {
  modelIds: string[];
}

const testContext: TestContext = {
  modelIds: [],
};

describe('Model Management E2E Tests', () => {
  console.log('[Model-E2E] Starting Model Management E2E tests');

  beforeAll(() => {
    console.log('[Model-E2E] Test environment:', {
      apiUrl: API_BASE_URL,
      hasAuthToken: !!TEST_AUTH_TOKEN,
    });
  });

  afterAll(async () => {
    console.log('[Model-E2E] Cleaning up test models');
    await cleanup();
  });

  test('should create a custom LLM model', async () => {
    console.log('[Model-E2E] Test 1: Creating custom model');

    const modelPayload = {
      name: `Test Model ${Date.now()}`,
      modelId: `test-model-${Date.now()}`,
      provider: 'openai',
      trainingMethod: 'sft',
      baseModel: 'gpt-3.5-turbo',
      trainingDataset: 'custom-dataset-1',
      evaluationMetrics: {
        accuracy: 0.95,
        loss: 0.12,
      },
    };

    const response = await fetch(`${API_BASE_URL}/api/models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(modelPayload),
    });

    console.log('[Model-E2E] Model creation response status:', response.status);
    expect(response.status).toBe(201);

    const data = await response.json();
    console.log('[Model-E2E] Model created:', data.model?.id);

    expect(data.model).toBeDefined();
    expect(data.model.id).toBeDefined();
    expect(data.model.name).toBe(modelPayload.name);
    expect(data.model.model_id).toBe(modelPayload.modelId);
    expect(data.model.provider).toBe(modelPayload.provider);
    expect(data.model.training_method).toBe(modelPayload.trainingMethod);

    testContext.modelIds.push(data.model.id);
  }, 30000);

  test('should list all models', async () => {
    console.log('[Model-E2E] Test 2: Listing all models');

    const response = await fetch(`${API_BASE_URL}/api/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[Model-E2E] Models fetched:', data.models?.length);

    expect(data.models).toBeDefined();
    expect(Array.isArray(data.models)).toBe(true);
    expect(data.models.length).toBeGreaterThan(0);

    // Verify our test model is in the list
    const testModel = data.models.find((m: Record<string, unknown>) => m.id === testContext.modelIds[0]);
    expect(testModel).toBeDefined();
  }, 30000);

  test('should get model by ID', async () => {
    console.log('[Model-E2E] Test 3: Getting model by ID');

    const modelId = testContext.modelIds[0];
    const response = await fetch(`${API_BASE_URL}/api/models/${modelId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[Model-E2E] Model fetched:', data.model?.id);

    expect(data.model).toBeDefined();
    expect(data.model.id).toBe(modelId);
  }, 30000);

  test('should update model details', async () => {
    console.log('[Model-E2E] Test 4: Updating model');

    const modelId = testContext.modelIds[0];
    const updatePayload = {
      name: `Updated Test Model ${Date.now()}`,
      evaluationMetrics: {
        accuracy: 0.98,
        loss: 0.08,
        improved: true,
      },
    };

    const response = await fetch(`${API_BASE_URL}/api/models/${modelId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(updatePayload),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    console.log('[Model-E2E] Model updated:', data.model?.id);

    expect(data.model.name).toBe(updatePayload.name);
    expect(data.model.evaluation_metrics.accuracy).toBe(0.98);
    expect(data.model.evaluation_metrics.improved).toBe(true);
  }, 30000);

  test('should create DPO model', async () => {
    console.log('[Model-E2E] Test 5: Creating DPO model');

    const dpoModelPayload = {
      name: `DPO Test Model ${Date.now()}`,
      modelId: `dpo-test-${Date.now()}`,
      provider: 'openai',
      trainingMethod: 'dpo',
      baseModel: 'gpt-3.5-turbo',
      trainingDataset: 'preference-dataset',
      evaluationMetrics: {
        reward_accuracy: 0.92,
      },
    };

    const response = await fetch(`${API_BASE_URL}/api/models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(dpoModelPayload),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    console.log('[Model-E2E] DPO model created:', data.model?.id);

    expect(data.model.training_method).toBe('dpo');
    testContext.modelIds.push(data.model.id);
  }, 30000);

  test('should create RLHF model', async () => {
    console.log('[Model-E2E] Test 6: Creating RLHF model');

    const rlhfModelPayload = {
      name: `RLHF Test Model ${Date.now()}`,
      modelId: `rlhf-test-${Date.now()}`,
      provider: 'anthropic',
      trainingMethod: 'rlhf',
      baseModel: 'claude-3-haiku',
      trainingDataset: 'feedback-dataset',
      evaluationMetrics: {
        helpfulness_score: 0.89,
        harmlessness_score: 0.96,
      },
    };

    const response = await fetch(`${API_BASE_URL}/api/models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify(rlhfModelPayload),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    console.log('[Model-E2E] RLHF model created:', data.model?.id);

    expect(data.model.training_method).toBe('rlhf');
    testContext.modelIds.push(data.model.id);
  }, 30000);

  test('should delete model', async () => {
    console.log('[Model-E2E] Test 7: Deleting model');

    const modelIdToDelete = testContext.modelIds[0];

    const response = await fetch(`${API_BASE_URL}/api/models/${modelIdToDelete}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
    });

    console.log('[Model-E2E] Delete response status:', response.status);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify model is deleted
    const verifyResponse = await fetch(`${API_BASE_URL}/api/models/${modelIdToDelete}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
    });

    expect(verifyResponse.status).toBe(404);

    // Remove from cleanup list
    testContext.modelIds = testContext.modelIds.filter(id => id !== modelIdToDelete);
  }, 30000);
});

async function cleanup(): Promise<void> {
  console.log('[Model-E2E] Starting cleanup');

  for (const modelId of testContext.modelIds) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/models/${modelId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
      });

      if (response.ok) {
        console.log('[Model-E2E] Deleted model:', modelId);
      } else {
        console.log('[Model-E2E] Failed to delete model:', modelId, response.status);
      }
    } catch (error) {
      console.log('[Model-E2E] Cleanup error for model:', modelId, error);
    }
  }

  console.log('[Model-E2E] Cleanup complete');
}

console.log('[Model-E2E] Test suite loaded');
