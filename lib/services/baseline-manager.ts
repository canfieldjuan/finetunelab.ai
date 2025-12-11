/**
 * Baseline Manager
 *
 * Manages model baselines and performs regression detection
 * Prevents bad models from reaching production by comparing metrics
 * against known good baselines
 *
 * Phase: Phase 4 - Regression Gates
 * Date: 2025-10-28
 */

import { createServerClient } from '@/lib/supabase/server-client';
import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type ThresholdType = 'min' | 'max' | 'delta' | 'ratio';
export type MetricCategory = 'accuracy' | 'performance' | 'quality' | 'business';
export type Severity = 'critical' | 'warning' | 'info';
export type ValidationStatus = 'passed' | 'failed' | 'warning';

export interface Baseline {
  id: string;
  modelName: string;
  version?: string;
  metricName: string;
  metricCategory: MetricCategory;
  baselineValue: number;
  thresholdType: ThresholdType;
  thresholdValue: number;
  severity: Severity;
  alertEnabled: boolean;
  description?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationResult {
  id: string;
  executionId: string;
  jobId: string;
  modelName: string;
  modelVersion?: string;
  status: ValidationStatus;
  metrics: Record<string, number>;
  baselineComparisons: BaselineComparison[];
  failures: string[];
  warnings: string[];
  createdAt: Date;
}

export interface BaselineComparison {
  metricName: string;
  actualValue: number;
  baselineValue: number;
  thresholdValue: number;
  thresholdType: ThresholdType;
  passed: boolean;
  severity: Severity;
  message: string;
}

export interface ValidationConfig {
  modelName: string;
  modelVersion?: string;
  metrics: Record<string, number>;
  executionId: string;
  jobId: string;
}

// ============================================================================
// Baseline Manager
// ============================================================================

export class BaselineManager {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createServerClient();
    console.log('[BaselineManager] Initialized');
  }

  /**
   * Create a new baseline
   */
  async createBaseline(baseline: Omit<Baseline, 'id' | 'createdAt' | 'updatedAt'>): Promise<Baseline> {
    console.log('[BaselineManager] Creating baseline:', baseline.modelName, baseline.metricName);

    const { data, error } = await this.supabase
      .from('model_baselines')
      .insert({
        model_name: baseline.modelName,
        version: baseline.version,
        metric_name: baseline.metricName,
        metric_category: baseline.metricCategory,
        baseline_value: baseline.baselineValue,
        threshold_type: baseline.thresholdType,
        threshold_value: baseline.thresholdValue,
        severity: baseline.severity,
        alert_enabled: baseline.alertEnabled,
        description: baseline.description,
        created_by: baseline.createdBy,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create baseline: ${error.message}`);
    }

    console.log('[BaselineManager] Baseline created:', data.id);

    return this.mapBaseline(data);
  }

  /**
   * Get all baselines for a model
   */
  async getBaselines(modelName: string, version?: string): Promise<Baseline[]> {
    console.log('[BaselineManager] Fetching baselines for:', modelName, version);

    let query = this.supabase
      .from('model_baselines')
      .select('*')
      .eq('model_name', modelName);

    if (version) {
      query = query.eq('version', version);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch baselines: ${error.message}`);
    }

    console.log('[BaselineManager] Found', data?.length || 0, 'baselines');

    return (data || []).map(this.mapBaseline);
  }

  /**
   * Get a single baseline by ID
   */
  async getBaseline(id: string): Promise<Baseline | null> {
    const { data, error } = await this.supabase
      .from('model_baselines')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapBaseline(data);
  }

  /**
   * Update a baseline
   */
  async updateBaseline(
    id: string,
    updates: Partial<Omit<Baseline, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Baseline> {
    console.log('[BaselineManager] Updating baseline:', id);

    const updateData: Record<string, unknown> = {};
    if (updates.baselineValue !== undefined) updateData.baseline_value = updates.baselineValue;
    if (updates.thresholdValue !== undefined) updateData.threshold_value = updates.thresholdValue;
    if (updates.thresholdType !== undefined) updateData.threshold_type = updates.thresholdType;
    if (updates.severity !== undefined) updateData.severity = updates.severity;
    if (updates.alertEnabled !== undefined) updateData.alert_enabled = updates.alertEnabled;
    if (updates.description !== undefined) updateData.description = updates.description;

    const { data, error } = await this.supabase
      .from('model_baselines')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update baseline: ${error.message}`);
    }

    return this.mapBaseline(data);
  }

  /**
   * Delete a baseline
   */
  async deleteBaseline(id: string): Promise<void> {
    console.log('[BaselineManager] Deleting baseline:', id);

    const { error } = await this.supabase
      .from('model_baselines')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete baseline: ${error.message}`);
    }

    console.log('[BaselineManager] Baseline deleted');
  }

  /**
   * Validate metrics against baselines
   */
  async validate(config: ValidationConfig): Promise<ValidationResult> {
    console.log('[BaselineManager] Validating:', config.modelName);
    console.log('[BaselineManager] Metrics:', Object.keys(config.metrics));

    // Fetch baselines
    const baselines = await this.getBaselines(config.modelName, config.modelVersion);

    if (baselines.length === 0) {
      console.log('[BaselineManager] No baselines found - validation passed by default');
      return this.createValidationResult(config, [], 'passed');
    }

    // Compare each metric against its baseline
    const comparisons: BaselineComparison[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];

    for (const baseline of baselines) {
      const actualValue = config.metrics[baseline.metricName];

      if (actualValue === undefined) {
        console.log(`[BaselineManager] Metric ${baseline.metricName} not provided - skipping`);
        continue;
      }

      const comparison = this.compareToBaseline(baseline, actualValue);
      comparisons.push(comparison);

      if (!comparison.passed) {
        if (baseline.severity === 'critical') {
          failures.push(comparison.message);
        } else if (baseline.severity === 'warning') {
          warnings.push(comparison.message);
        }
      }
    }

    // Determine overall status
    let status: ValidationStatus;
    if (failures.length > 0) {
      status = 'failed';
    } else if (warnings.length > 0) {
      status = 'warning';
    } else {
      status = 'passed';
    }

    console.log('[BaselineManager] Validation result:', status);
    console.log('[BaselineManager] Failures:', failures.length);
    console.log('[BaselineManager] Warnings:', warnings.length);

    // Store validation result
    return await this.storeValidationResult(config, comparisons, status, failures, warnings);
  }

  /**
   * Compare actual value to baseline
   */
  private compareToBaseline(baseline: Baseline, actualValue: number): BaselineComparison {
    let passed = false;
    let message = '';

    switch (baseline.thresholdType) {
      case 'min':
        passed = actualValue >= baseline.baselineValue;
        message = passed
          ? `${baseline.metricName}: ${actualValue} >= ${baseline.baselineValue} ✓`
          : `${baseline.metricName}: ${actualValue} < ${baseline.baselineValue} (min threshold) ✗`;
        break;

      case 'max':
        passed = actualValue <= baseline.baselineValue;
        message = passed
          ? `${baseline.metricName}: ${actualValue} <= ${baseline.baselineValue} ✓`
          : `${baseline.metricName}: ${actualValue} > ${baseline.baselineValue} (max threshold) ✗`;
        break;

      case 'delta':
        const lowerBound = baseline.baselineValue - Math.abs(baseline.thresholdValue);
        const upperBound = baseline.baselineValue + Math.abs(baseline.thresholdValue);
        passed = actualValue >= lowerBound && actualValue <= upperBound;
        message = passed
          ? `${baseline.metricName}: ${actualValue} within ${baseline.baselineValue} ± ${baseline.thresholdValue} ✓`
          : `${baseline.metricName}: ${actualValue} outside range [${lowerBound}, ${upperBound}] ✗`;
        break;

      case 'ratio':
        const ratio = actualValue / baseline.baselineValue;
        const minRatio = 1 - baseline.thresholdValue;
        passed = ratio >= minRatio;
        message = passed
          ? `${baseline.metricName}: ratio ${ratio.toFixed(3)} >= ${minRatio.toFixed(3)} ✓`
          : `${baseline.metricName}: ratio ${ratio.toFixed(3)} < ${minRatio.toFixed(3)} ✗`;
        break;
    }

    return {
      metricName: baseline.metricName,
      actualValue,
      baselineValue: baseline.baselineValue,
      thresholdValue: baseline.thresholdValue,
      thresholdType: baseline.thresholdType,
      passed,
      severity: baseline.severity,
      message,
    };
  }

  /**
   * Store validation result in database
   */
  private async storeValidationResult(
    config: ValidationConfig,
    comparisons: BaselineComparison[],
    status: ValidationStatus,
    failures: string[],
    warnings: string[]
  ): Promise<ValidationResult> {
    const { data, error } = await this.supabase
      .from('validation_results')
      .insert({
        execution_id: config.executionId,
        job_id: config.jobId,
        model_name: config.modelName,
        model_version: config.modelVersion,
        status,
        metrics: config.metrics,
        baseline_comparisons: comparisons,
        failures,
        warnings,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store validation result: ${error.message}`);
    }

    return {
      id: data.id,
      executionId: data.execution_id,
      jobId: data.job_id,
      modelName: data.model_name,
      modelVersion: data.model_version,
      status: data.status,
      metrics: data.metrics,
      baselineComparisons: data.baseline_comparisons,
      failures: data.failures || [],
      warnings: data.warnings || [],
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Create validation result without storing (for no-baseline case)
   */
  private createValidationResult(
    config: ValidationConfig,
    comparisons: BaselineComparison[],
    status: ValidationStatus
  ): ValidationResult {
    return {
      id: 'no-baselines',
      executionId: config.executionId,
      jobId: config.jobId,
      modelName: config.modelName,
      modelVersion: config.modelVersion,
      status,
      metrics: config.metrics,
      baselineComparisons: comparisons,
      failures: [],
      warnings: [],
      createdAt: new Date(),
    };
  }

  /**
   * Get validation history for a model
   */
  async getValidationHistory(
    modelName: string,
    limit: number = 10
  ): Promise<ValidationResult[]> {
    const { data, error } = await this.supabase
      .from('validation_results')
      .select('*')
      .eq('model_name', modelName)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch validation history: ${error.message}`);
    }

    return (data || []).map(result => ({
      id: result.id,
      executionId: result.execution_id,
      jobId: result.job_id,
      modelName: result.model_name,
      modelVersion: result.model_version,
      status: result.status,
      metrics: result.metrics,
      baselineComparisons: result.baseline_comparisons,
      failures: result.failures || [],
      warnings: result.warnings || [],
      createdAt: new Date(result.created_at),
    }));
  }

  /**
   * Map database row to Baseline
   */
  private mapBaseline(data: Record<string, unknown>): Baseline {
    return {
      id: data.id as string,
      modelName: data.model_name as string,
      version: data.version as string | undefined,
      metricName: data.metric_name as string,
      metricCategory: data.metric_category as MetricCategory,
      baselineValue: data.baseline_value as number,
      thresholdType: data.threshold_type as ThresholdType,
      thresholdValue: data.threshold_value as number,
      severity: data.severity as Severity,
      alertEnabled: data.alert_enabled as boolean,
      description: data.description as string | undefined,
      createdBy: data.created_by as string | undefined,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let baselineInstance: BaselineManager | null = null;

export function getBaselineManager(): BaselineManager {
  if (!baselineInstance) {
    baselineInstance = new BaselineManager();
  }

  return baselineInstance;
}

export default BaselineManager;
