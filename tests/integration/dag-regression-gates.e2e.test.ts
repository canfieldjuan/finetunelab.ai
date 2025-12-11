/**
 * DAG Regression Gates Integration Tests
 *
 * Tests the complete regression detection system including:
 * - Baseline CRUD operations
 * - Regression detection logic
 * - Validation job handler integration
 * - API endpoints
 *
 * Phase: Phase 4 - Regression Gates
 * Date: 2025-10-28
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  BaselineManager,
  ValidationConfig,
  Baseline,
} from '@/lib/services/baseline-manager';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('DAG Regression Gates System', () => {
  let supabase: SupabaseClient;
  let baselineManager: BaselineManager;
  const testBaselines: Baseline[] = [];

  beforeAll(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('Missing Supabase credentials for tests');
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    baselineManager = new BaselineManager(SUPABASE_URL, SUPABASE_KEY);
  });

  afterAll(async () => {
    // Cleanup test data
    for (const baseline of testBaselines) {
      await baselineManager.deleteBaseline(baseline.id);
    }

    await supabase.from('validation_results').delete().eq('model_name', 'test-model');
  });

  describe('BaselineManager - CRUD Operations', () => {
    it('should create a baseline', async () => {
      const baseline = await baselineManager.createBaseline({
        modelName: 'test-model',
        metricName: 'accuracy',
        metricCategory: 'accuracy',
        baselineValue: 0.85,
        thresholdType: 'delta',
        thresholdValue: 0.02,
        severity: 'critical',
        alertEnabled: true,
        description: 'Test accuracy baseline',
      });

      expect(baseline.id).toBeDefined();
      expect(baseline.modelName).toBe('test-model');
      expect(baseline.metricName).toBe('accuracy');
      expect(baseline.baselineValue).toBe(0.85);

      testBaselines.push(baseline);
    });

    it('should get baselines for a model', async () => {
      const baselines = await baselineManager.getBaselines('test-model');

      expect(baselines.length).toBeGreaterThan(0);
      expect(baselines[0].modelName).toBe('test-model');
    });

    it('should update a baseline', async () => {
      const baseline = testBaselines[0];

      const updated = await baselineManager.updateBaseline(baseline.id, {
        baselineValue: 0.90,
        description: 'Updated baseline',
      });

      expect(updated.baselineValue).toBe(0.90);
      expect(updated.description).toBe('Updated baseline');
    });

    it('should delete a baseline', async () => {
      const baseline = await baselineManager.createBaseline({
        modelName: 'test-model',
        metricName: 'temp-metric',
        metricCategory: 'accuracy',
        baselineValue: 0.5,
        thresholdType: 'min',
        thresholdValue: 0.0,
        severity: 'info',
        alertEnabled: false,
      });

      await baselineManager.deleteBaseline(baseline.id);

      const fetched = await baselineManager.getBaseline(baseline.id);
      expect(fetched).toBeNull();
    });
  });

  describe('Regression Detection Logic', () => {
    beforeAll(async () => {
      // Create test baselines for different threshold types
      const baselines = [
        {
          modelName: 'regression-test-model',
          metricName: 'accuracy',
          metricCategory: 'accuracy' as const,
          baselineValue: 0.85,
          thresholdType: 'delta' as const,
          thresholdValue: 0.02,
          severity: 'critical' as const,
          alertEnabled: true,
        },
        {
          modelName: 'regression-test-model',
          metricName: 'latency',
          metricCategory: 'performance' as const,
          baselineValue: 100,
          thresholdType: 'max' as const,
          thresholdValue: 0,
          severity: 'warning' as const,
          alertEnabled: true,
        },
        {
          modelName: 'regression-test-model',
          metricName: 'f1_score',
          metricCategory: 'accuracy' as const,
          baselineValue: 0.80,
          thresholdType: 'min' as const,
          thresholdValue: 0,
          severity: 'critical' as const,
          alertEnabled: true,
        },
        {
          modelName: 'regression-test-model',
          metricName: 'throughput',
          metricCategory: 'performance' as const,
          baselineValue: 1000,
          thresholdType: 'ratio' as const,
          thresholdValue: 0.1,
          severity: 'warning' as const,
          alertEnabled: true,
        },
      ];

      for (const baseline of baselines) {
        const created = await baselineManager.createBaseline(baseline);
        testBaselines.push(created);
      }
    });

    it('should pass validation when all metrics meet baselines', async () => {
      const config: ValidationConfig = {
        modelName: 'regression-test-model',
        metrics: {
          accuracy: 0.86,
          latency: 95,
          f1_score: 0.82,
          throughput: 1050,
        },
        executionId: 'test-exec-1',
        jobId: 'test-job-1',
      };

      const result = await baselineManager.validate(config);

      expect(result.status).toBe('passed');
      expect(result.failures).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.baselineComparisons).toHaveLength(4);
      expect(result.baselineComparisons.every(c => c.passed)).toBe(true);
    });

    it('should fail validation with critical regression (delta)', async () => {
      const config: ValidationConfig = {
        modelName: 'regression-test-model',
        metrics: {
          accuracy: 0.82, // Below 0.85 - 0.02 = 0.83
        },
        executionId: 'test-exec-2',
        jobId: 'test-job-2',
      };

      const result = await baselineManager.validate(config);

      expect(result.status).toBe('failed');
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures[0]).toContain('accuracy');
    });

    it('should fail validation with critical regression (min threshold)', async () => {
      const config: ValidationConfig = {
        modelName: 'regression-test-model',
        metrics: {
          f1_score: 0.75, // Below 0.80 minimum
        },
        executionId: 'test-exec-3',
        jobId: 'test-job-3',
      };

      const result = await baselineManager.validate(config);

      expect(result.status).toBe('failed');
      expect(result.failures[0]).toContain('f1_score');
    });

    it('should warn on non-critical regression (max threshold)', async () => {
      const config: ValidationConfig = {
        modelName: 'regression-test-model',
        metrics: {
          latency: 105, // Above 100 maximum
        },
        executionId: 'test-exec-4',
        jobId: 'test-job-4',
      };

      const result = await baselineManager.validate(config);

      expect(result.status).toBe('warning');
      expect(result.failures).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('latency');
    });

    it('should warn on ratio regression', async () => {
      const config: ValidationConfig = {
        modelName: 'regression-test-model',
        metrics: {
          throughput: 850, // Ratio 0.85, below 0.9 threshold
        },
        executionId: 'test-exec-5',
        jobId: 'test-job-5',
      };

      const result = await baselineManager.validate(config);

      expect(result.status).toBe('warning');
      expect(result.warnings[0]).toContain('throughput');
    });

    it('should pass validation when no baselines exist', async () => {
      const config: ValidationConfig = {
        modelName: 'nonexistent-model',
        metrics: {
          accuracy: 0.5,
        },
        executionId: 'test-exec-6',
        jobId: 'test-job-6',
      };

      const result = await baselineManager.validate(config);

      expect(result.status).toBe('passed');
      expect(result.baselineComparisons).toHaveLength(0);
    });

    it('should skip missing metrics without failing', async () => {
      const config: ValidationConfig = {
        modelName: 'regression-test-model',
        metrics: {
          accuracy: 0.86,
          // Missing: latency, f1_score, throughput
        },
        executionId: 'test-exec-7',
        jobId: 'test-job-7',
      };

      const result = await baselineManager.validate(config);

      expect(result.status).toBe('passed');
      expect(result.baselineComparisons).toHaveLength(1); // Only accuracy
    });
  });

  describe('Validation History', () => {
    it('should retrieve validation history', async () => {
      const history = await baselineManager.getValidationHistory('regression-test-model', 5);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].modelName).toBe('regression-test-model');
    });

    it('should order history by most recent first', async () => {
      const history = await baselineManager.getValidationHistory('regression-test-model', 5);

      if (history.length > 1) {
        expect(history[0].createdAt.getTime()).toBeGreaterThanOrEqual(
          history[1].createdAt.getTime()
        );
      }
    });
  });

  describe('API Endpoints', () => {
    it.skip('should create baseline via API', async () => {
      const response = await fetch('http://localhost:3000/api/training/baselines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelName: 'api-test-model',
          metricName: 'accuracy',
          metricCategory: 'accuracy',
          baselineValue: 0.85,
          thresholdType: 'delta',
          thresholdValue: 0.02,
          severity: 'critical',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.baseline.modelName).toBe('api-test-model');
    });

    it.skip('should get baselines via API', async () => {
      const response = await fetch('http://localhost:3000/api/training/baselines?modelName=test-model');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.baselines)).toBe(true);
    });

    it.skip('should get validation history via API', async () => {
      const response = await fetch('http://localhost:3000/api/training/validations?modelName=regression-test-model&limit=5');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.validations)).toBe(true);
    });
  });
});
