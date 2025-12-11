/**
 * useWorkflowState Hook
 * State machine for training package workflow
 * Manages step navigation, validation, and auto-save
 * Date: 2025-01-31
 * Phase 1: Foundation
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  WorkflowState,
  StepId,
  StepState,
  Step1ModelData,
  Step2ConfigData,
  Step3DatasetData,
  Step4DeployData,
  ValidationResult,
  createInitialWorkflowState,
  canNavigateToStep,
  getNextStep,
  getPreviousStep,
} from './types';

console.log('[useWorkflowState] Hook loaded');

/**
 * Hook options
 */
interface UseWorkflowStateOptions {
  packageBaseName: string;
  initialState?: Partial<WorkflowState>;
  autoSaveInterval?: number; // milliseconds (default: 30000 = 30s)
  onAutoSave?: (state: WorkflowState) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook return type
 */
interface UseWorkflowStateReturn {
  // Current state
  state: WorkflowState;
  currentStep: StepId;

  // Navigation
  navigateToStep: (stepId: StepId) => boolean;
  goToNextStep: () => boolean;
  goToPreviousStep: () => boolean;

  // Step data updates
  updateStepData: <T>(stepId: StepId, data: T) => void;
  completeStep: (stepId: StepId) => void;
  setStepError: (stepId: StepId, errors: string[]) => void;

  // Validation
  validateStep: (stepId: StepId) => ValidationResult;

  // Version control
  markAsDraft: () => void;
  publishVersion: () => void;

  // Utility
  resetWorkflow: () => void;
  canNavigateForward: boolean;
  canNavigateBackward: boolean;
}

type StepData = Step1ModelData | Step2ConfigData | Step3DatasetData | Step4DeployData | null;

/**
 * Validate step data based on step type
 */
function validateStepData(stepId: StepId, data: StepData): ValidationResult {
  const errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }> = [];
  const warnings: Array<{ field: string; message: string; severity: 'error' | 'warning' }> = [];

  switch (stepId) {
    case 'model':
      if (!data) {
        errors.push({ field: 'model', message: 'Model selection is required', severity: 'error' });
      } else {
        const modelData = data as Step1ModelData;
        if (!modelData.modelInfo) {
          errors.push({ field: 'modelInfo', message: 'Model information is missing', severity: 'error' });
        }
        if (!modelData.selectedAt) {
          errors.push({ field: 'selectedAt', message: 'Selection timestamp is missing', severity: 'error' });
        }
        // Warning for large models
        if (modelData.modelInfo && modelData.modelInfo.sizeGB > 10) {
          warnings.push({
            field: 'sizeGB',
            message: `Large model (${modelData.modelInfo.sizeGB}GB) may require significant download time`,
            severity: 'warning',
          });
        }
      }
      break;

    case 'config':
      if (!data) {
        errors.push({ field: 'config', message: 'Training configuration is required', severity: 'error' });
      } else {
        const configData = data as Step2ConfigData;
        if (!configData.trainingConfig) {
          errors.push({ field: 'trainingConfig', message: 'Training config is missing', severity: 'error' });
        }
        if (!configData.validatedAt) {
          errors.push({ field: 'validatedAt', message: 'Validation timestamp is missing', severity: 'error' });
        }
      }
      break;

    case 'dataset':
      if (!data) {
        errors.push({ field: 'dataset', message: 'Dataset selection is required', severity: 'error' });
      } else {
        const datasetData = data as Step3DatasetData;
        if (!datasetData.selectedDatasets || datasetData.selectedDatasets.length === 0) {
          errors.push({ field: 'selectedDatasets', message: 'At least one dataset must be selected', severity: 'error' });
        }
        if (datasetData.trainValSplit < 50 || datasetData.trainValSplit > 95) {
          warnings.push({
            field: 'trainValSplit',
            message: 'Train/validation split outside recommended range (50-95%)',
            severity: 'warning',
          });
        }
      }
      break;

    case 'deploy':
      if (!data) {
        errors.push({ field: 'deploy', message: 'Deployment configuration is required', severity: 'error' });
      } else {
        const deployData = data as Step4DeployData;
        if (!deployData.packageName || deployData.packageName.trim() === '') {
          errors.push({ field: 'packageName', message: 'Package name is required', severity: 'error' });
        }
        if (!deployData.deploymentTarget) {
          errors.push({ field: 'deploymentTarget', message: 'Deployment target must be selected', severity: 'error' });
        }

        // Validate HF Space config if HF deployment
        if (deployData.deploymentTarget === 'hf_space') {
          if (!deployData.hfSpaceConfig) {
            errors.push({ field: 'hfSpaceConfig', message: 'HuggingFace Space configuration is required', severity: 'error' });
          } else {
            if (!deployData.hfSpaceConfig.spaceName) {
              errors.push({ field: 'spaceName', message: 'Space name is required', severity: 'error' });
            }
            if (deployData.hfSpaceConfig.budgetLimit <= 0) {
              warnings.push({
                field: 'budgetLimit',
                message: 'No budget limit set - costs may exceed expectations',
                severity: 'warning',
              });
            }
          }
        }

        // Validate local config if local deployment
        if (deployData.deploymentTarget === 'local') {
          if (!deployData.localConfig) {
            errors.push({ field: 'localConfig', message: 'Local deployment configuration is required', severity: 'error' });
          } else {
            if (!deployData.localConfig.serverUrl) {
              errors.push({ field: 'serverUrl', message: 'Server URL is required', severity: 'error' });
            }
          }
        }
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Main workflow state management hook
 */
export function useWorkflowState({
  packageBaseName,
  initialState,
  autoSaveInterval = 30000,
  onAutoSave,
  onError,
}: UseWorkflowStateOptions): UseWorkflowStateReturn {
  console.log('[useWorkflowState] Initializing with packageBaseName:', packageBaseName);

  // Initialize state
  const [state, setState] = useState<WorkflowState>(() => {
    const initial = createInitialWorkflowState(packageBaseName);
    if (initialState) {
      return { ...initial, ...initialState };
    }
    return initial;
  });

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<Date>(new Date());

  /**
   * Navigate to a specific step with validation
   */
  const navigateToStep = useCallback((stepId: StepId): boolean => {
    console.log('[useWorkflowState] Navigate to step:', stepId);

    // Check if navigation is allowed
    if (!canNavigateToStep(state.currentStep, stepId, state.steps)) {
      console.warn('[useWorkflowState] Cannot navigate to step:', stepId);
      onError?.(new Error(`Cannot navigate to ${stepId}. Complete current step first.`));
      return false;
    }

    setState((prev) => ({
      ...prev,
      currentStep: stepId,
      updatedAt: new Date(),
    }));

    return true;
  }, [state.currentStep, state.steps, onError]);

  /**
   * Go to next step
   */
  const goToNextStep = useCallback((): boolean => {
    const nextStep = getNextStep(state.currentStep);
    if (!nextStep) {
      console.log('[useWorkflowState] Already at last step');
      return false;
    }
    return navigateToStep(nextStep);
  }, [state.currentStep, navigateToStep]);

  /**
   * Go to previous step
   */
  const goToPreviousStep = useCallback((): boolean => {
    const prevStep = getPreviousStep(state.currentStep);
    if (!prevStep) {
      console.log('[useWorkflowState] Already at first step');
      return false;
    }
    return navigateToStep(prevStep);
  }, [state.currentStep, navigateToStep]);

  /**
   * Update step data
   */
  const updateStepData = useCallback(<T,>(stepId: StepId, data: T) => {
    console.log('[useWorkflowState] Update step data:', stepId);

    setState((prev) => {
      const stepState = prev.steps[stepId] as StepState<T>;

      const newSteps = {
        ...prev.steps,
        [stepId]: {
          ...stepState,
          data,
          status: stepState.status === 'not_started' ? 'in_progress' : stepState.status,
          lastModified: new Date(),
        },
      };

      return {
        ...prev,
        steps: newSteps,
        updatedAt: new Date(),
        isDraft: true,
      };
    });
  }, []);

  /**
   * Complete a step
   */
  const completeStep = useCallback((stepId: StepId) => {
    console.log('[useWorkflowState] Complete step:', stepId);

    setState((prev) => {
      const stepState = prev.steps[stepId];

      // Validate step data before completing
      const validation = validateStepData(stepId, stepState.data);

      const newSteps = {
        ...prev.steps,
        [stepId]: {
          ...stepState,
          status: validation.isValid ? 'completed' : 'error',
          validation,
          lastModified: new Date(),
        },
      };

      return {
        ...prev,
        steps: newSteps,
        updatedAt: new Date(),
      };
    });
  }, []);

  /**
   * Set step error
   */
  const setStepError = useCallback((stepId: StepId, errors: string[]) => {
    console.log('[useWorkflowState] Set step error:', stepId, errors);

    setState((prev) => {
      const stepState = prev.steps[stepId];

      const newSteps = {
        ...prev.steps,
        [stepId]: {
          ...stepState,
          status: 'error',
          errors,
          lastModified: new Date(),
        },
      };

      return {
        ...prev,
        steps: newSteps,
        updatedAt: new Date(),
      };
    });
  }, []);

  /**
   * Validate a step
   */
  const validateStep = useCallback((stepId: StepId): ValidationResult => {
    console.log('[useWorkflowState] Validate step:', stepId);

    const stepState = state.steps[stepId];
    const validation = validateStepData(stepId, stepState.data);

    // Update validation in state
    setState((prev) => {
      const newSteps = {
        ...prev.steps,
        [stepId]: {
          ...prev.steps[stepId],
          validation,
        },
      };

      return {
        ...prev,
        steps: newSteps,
      };
    });

    return validation;
  }, [state.steps]);

  /**
   * Mark as draft
   */
  const markAsDraft = useCallback(() => {
    console.log('[useWorkflowState] Mark as draft');

    setState((prev) => ({
      ...prev,
      isDraft: true,
      isPublished: false,
      updatedAt: new Date(),
    }));
  }, []);

  /**
   * Publish version
   */
  const publishVersion = useCallback(() => {
    console.log('[useWorkflowState] Publish version');

    setState((prev) => ({
      ...prev,
      isDraft: false,
      isPublished: true,
      updatedAt: new Date(),
    }));
  }, []);

  /**
   * Reset workflow
   */
  const resetWorkflow = useCallback(() => {
    console.log('[useWorkflowState] Reset workflow');

    setState(createInitialWorkflowState(packageBaseName));
  }, [packageBaseName]);

  /**
   * Auto-save functionality
   */
  useEffect(() => {
    if (!onAutoSave || !state.isDraft) {
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      const now = new Date();
      const timeSinceLastSave = now.getTime() - lastSaveRef.current.getTime();

      // Only auto-save if enough time has passed
      if (timeSinceLastSave >= autoSaveInterval) {
        console.log('[useWorkflowState] Auto-saving...');

        setState((prev) => ({
          ...prev,
          lastAutoSave: now,
        }));

        onAutoSave(state);
        lastSaveRef.current = now;
      }
    }, autoSaveInterval);

    // Cleanup
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [state, autoSaveInterval, onAutoSave]);

  // Calculate navigation capabilities
  const canNavigateForward = (() => {
    const nextStep = getNextStep(state.currentStep);
    if (!nextStep) return false;
    return state.steps[state.currentStep].status === 'completed';
  })();

  const canNavigateBackward = getPreviousStep(state.currentStep) !== null;

  return {
    state,
    currentStep: state.currentStep,
    navigateToStep,
    goToNextStep,
    goToPreviousStep,
    updateStepData,
    completeStep,
    setStepError,
    validateStep,
    markAsDraft,
    publishVersion,
    resetWorkflow,
    canNavigateForward,
    canNavigateBackward,
  };
}

console.log('[useWorkflowState] Hook defined');
