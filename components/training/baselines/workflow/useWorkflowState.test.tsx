/**
 * useWorkflowState Hook Test/Demo
 * Verification that the workflow state machine works correctly
 * Date: 2025-01-31
 */

'use client';

import React, { useState } from 'react';
import { useWorkflowState } from './useWorkflowState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Step1ModelData, Step2ConfigData, Step3DatasetData, Step4DeployData } from './types';

/**
 * Test/Demo Component
 * Interactive demo showing useWorkflowState functionality
 */
export function UseWorkflowStateDemo() {
  const [autoSaveLogs, setAutoSaveLogs] = useState<string[]>([]);

  const {
    state,
    currentStep,
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
  } = useWorkflowState({
    packageBaseName: 'test-package',
    autoSaveInterval: 5000, // 5 seconds for demo
    onAutoSave: (savedState) => {
      const timestamp = new Date().toLocaleTimeString();
      setAutoSaveLogs((prev) => [...prev, `[${timestamp}] Auto-saved (v${savedState.version})`]);
      console.log('[Demo] Auto-save triggered:', savedState);
    },
    onError: (error) => {
      console.error('[Demo] Error:', error.message);
      alert(error.message);
    },
  });

  // Sample data for testing
  const handlePopulateModelData = () => {
    const modelData: Step1ModelData = {
      source: 'popular',
      modelInfo: {
        id: 'meta-llama/Llama-2-7b-hf',
        name: 'Llama 2 7B',
        sizeGB: 13.5,
        isCached: false,
        supportsChatTemplate: true,
        supportsLoRA: true,
        parameterCount: 7000000000,
        family: 'llama',
      },
      selectedAt: new Date(),
    };
    updateStepData('model', modelData);
  };

  const handlePopulateConfigData = () => {
    const configData: Step2ConfigData = {
      trainingConfig: {
        learning_rate: 0.0002,
        batch_size: 4,
        num_epochs: 3,
      },
      templateType: 'lora_finetuning',
      validatedAt: new Date(),
    };
    updateStepData('config', configData);
  };

  const handlePopulateDatasetData = () => {
    const datasetData: Step3DatasetData = {
      selectedDatasets: [
        {
          datasetId: 'dataset-1',
          name: 'Training Dataset 1',
          sampleCount: 1000,
          format: 'jsonl',
          sizeBytes: 5000000,
          selected: true,
        },
      ],
      trainValSplit: 80,
      shuffle: true,
      selectedAt: new Date(),
    };
    updateStepData('dataset', datasetData);
  };

  const handlePopulateDeployData = () => {
    const deployData: Step4DeployData = {
      packageName: 'test-training-package-v1',
      deploymentTarget: 'local',
      localConfig: {
        serverUrl: 'http://localhost:8000',
      },
      enableTensorboard: true,
      saveCheckpointInterval: 500,
      createColabNotebook: false,
      generateGithubGist: false,
      selectedAt: new Date(),
    };
    updateStepData('deploy', deployData);
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>useWorkflowState Hook Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current State Display */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Current State</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Current Step:</span>{' '}
                <span className="font-medium">{currentStep}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Version:</span>{' '}
                <span className="font-medium">{state.version}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Is Draft:</span>{' '}
                <span className="font-medium">{state.isDraft ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Is Published:</span>{' '}
                <span className="font-medium">{state.isPublished ? 'Yes' : 'No'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Last Auto-Save:</span>{' '}
                <span className="font-medium">
                  {state.lastAutoSave ? state.lastAutoSave.toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {/* Step Status Grid */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Step Status</h3>
            <div className="grid grid-cols-4 gap-3">
              {(['model', 'config', 'dataset', 'deploy'] as const).map((stepId) => {
                const step = state.steps[stepId];
                return (
                  <div key={stepId} className="p-3 border rounded-lg space-y-1">
                    <div className="font-medium text-xs uppercase">{stepId}</div>
                    <div
                      className={`text-xs ${
                        step.status === 'completed'
                          ? 'text-green-600'
                          : step.status === 'in_progress'
                          ? 'text-blue-600'
                          : step.status === 'error'
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.status}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {step.data ? 'Has Data' : 'No Data'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Navigation</h3>
            <div className="flex flex-wrap gap-2">
              <Button onClick={goToPreviousStep} disabled={!canNavigateBackward} size="sm">
                ← Previous
              </Button>
              <Button onClick={goToNextStep} disabled={!canNavigateForward} size="sm">
                Next →
              </Button>
              <div className="border-l pl-2 ml-2 space-x-2">
                <Button onClick={() => navigateToStep('model')} variant="outline" size="sm">
                  Go to Model
                </Button>
                <Button onClick={() => navigateToStep('config')} variant="outline" size="sm">
                  Go to Config
                </Button>
                <Button onClick={() => navigateToStep('dataset')} variant="outline" size="sm">
                  Go to Dataset
                </Button>
                <Button onClick={() => navigateToStep('deploy')} variant="outline" size="sm">
                  Go to Deploy
                </Button>
              </div>
            </div>
          </div>

          {/* Data Population */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Populate Test Data</h3>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handlePopulateModelData} variant="secondary" size="sm">
                Populate Model Data
              </Button>
              <Button onClick={handlePopulateConfigData} variant="secondary" size="sm">
                Populate Config Data
              </Button>
              <Button onClick={handlePopulateDatasetData} variant="secondary" size="sm">
                Populate Dataset Data
              </Button>
              <Button onClick={handlePopulateDeployData} variant="secondary" size="sm">
                Populate Deploy Data
              </Button>
            </div>
          </div>

          {/* Step Actions */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Step Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => completeStep(currentStep)} variant="default" size="sm">
                Complete Current Step
              </Button>
              <Button onClick={() => validateStep(currentStep)} variant="outline" size="sm">
                Validate Current Step
              </Button>
              <Button
                onClick={() => setStepError(currentStep, ['Test error message'])}
                variant="outline"
                size="sm"
              >
                Set Error
              </Button>
            </div>
          </div>

          {/* Version Control */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Version Control</h3>
            <div className="flex flex-wrap gap-2">
              <Button onClick={markAsDraft} variant="outline" size="sm">
                Mark as Draft
              </Button>
              <Button onClick={publishVersion} variant="default" size="sm">
                Publish Version
              </Button>
              <Button onClick={resetWorkflow} variant="destructive" size="sm">
                Reset Workflow
              </Button>
            </div>
          </div>

          {/* Auto-Save Logs */}
          {autoSaveLogs.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Auto-Save Logs</h3>
              <div className="bg-muted p-3 rounded-lg max-h-32 overflow-y-auto">
                {autoSaveLogs.map((log, index) => (
                  <div key={index} className="text-xs font-mono">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

console.log('[useWorkflowState.test] Test component loaded');
