/**
 * TrainingPackageWizard Component
 * Main container for unified training package workflow
 * Manages 4-step wizard: Model → Config → Dataset → Deploy
 * Date: 2025-01-31
 * Phase 1: Foundation
 */

'use client';

import React, { useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Save, CheckCircle, History } from 'lucide-react';
import { StepHeader } from './StepHeader';
import { useWorkflowState } from './useWorkflowState';
import { Step1ModelSelection } from './Step1ModelSelection';
import type { TrainingPackageWizardProps, StepId, Step1ModelData, Step2ConfigData, Step3DatasetData, Step4DeployData } from './types';
import { JsonValue } from '@/lib/types';
import { STEP_NAMES, STEP_ORDER } from './types';
import { toast } from 'sonner';

type StepData = Step1ModelData | Step2ConfigData | Step3DatasetData | Step4DeployData | { [key: string]: JsonValue };

console.log('[TrainingPackageWizard] Component loaded');

/**
 * Main Training Package Wizard Container
 *
 * Features:
 * - 4-step sequential workflow
 * - Auto-save drafts every 30 seconds
 * - Step validation before navigation
 * - Version control (draft/publish)
 * - Collapsible step headers
 */
export function TrainingPackageWizard({
  packageId,
  initialState,
  onComplete,
  onCancel,
  onAutoSave,
}: TrainingPackageWizardProps) {
  console.log('[TrainingPackageWizard] Rendered', packageId ? `(editing ${packageId})` : '(new package)');

  // Initialize workflow state
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
    canNavigateForward,
    canNavigateBackward,
  } = useWorkflowState({
    packageBaseName: packageId || `training-package-${Date.now()}`,
    initialState,
    autoSaveInterval: 30000, // 30 seconds
    onAutoSave: (state) => {
      console.log('[TrainingPackageWizard] Auto-saving draft...');
      onAutoSave?.(state);
    },
    onError: (error) => {
      console.error('[TrainingPackageWizard] Error:', error.message);
      toast.error('Workflow error', {
        description: error.message,
      });
    },
  });

  /**
   * Handle step click (navigate to step)
   */
  const handleStepClick = useCallback((stepId: StepId) => {
    console.log('[TrainingPackageWizard] Step clicked:', stepId);

    // Only allow navigation if not current step
    if (stepId !== currentStep) {
      navigateToStep(stepId);
    }
  }, [currentStep, navigateToStep]);

  /**
   * Handle edit button click on completed step
   */
  const handleStepEdit = useCallback((stepId: StepId) => {
    console.log('[TrainingPackageWizard] Edit step:', stepId);
    navigateToStep(stepId);
  }, [navigateToStep]);

  /**
   * Handle step completion
   */
  const handleStepComplete = useCallback((stepId: StepId, data: StepData) => {
    console.log('[TrainingPackageWizard] Step complete:', stepId);

    // Update step data
    updateStepData(stepId, data);

    // Validate and complete
    const validation = validateStep(stepId);
    if (validation.isValid) {
      completeStep(stepId);

      // Auto-advance to next step
      if (canNavigateForward) {
        goToNextStep();
      }
    } else {
      console.warn('[TrainingPackageWizard] Validation failed:', validation.errors);
      setStepError(stepId, validation.errors.map(e => e.message));
    }
  }, [updateStepData, validateStep, completeStep, setStepError, canNavigateForward, goToNextStep]);

  /**
   * Handle publish action
   */
  const handlePublish = useCallback(async () => {
    console.log('[TrainingPackageWizard] Publishing version...');

    // Validate all steps
    const allValid = STEP_ORDER.every(stepId => {
      const validation = validateStep(stepId);
      return validation.isValid;
    });

    if (!allValid) {
      console.error('[TrainingPackageWizard] Cannot publish - validation failed');
      toast.error('Unable to publish', {
        description: 'Please fix validation issues in each step before publishing.',
      });
      return;
    }

    // Mark as published
    publishVersion();

    // Notify parent
    if (onComplete && state.packageId) {
      onComplete(state.packageId, `v${state.version}`);
    }

    toast.success('Training package published', {
      description: `Version v${state.version} is now live.`,
    });
  }, [validateStep, publishVersion, onComplete, state]);

  /**
   * Get step summary text for display when collapsed
   */
  const getStepSummary = useCallback((stepId: StepId): string | undefined => {
    const step = state.steps[stepId];
    if (!step.data || step.status === 'not_started') {
      return undefined;
    }

    switch (stepId) {
      case 'model':
        const modelData = step.data as Step1ModelData;
        return `Selected: ${modelData.modelInfo?.name || 'Unknown'} (${modelData.modelInfo?.sizeGB || 0}GB)`;

      case 'config':
        const configData = step.data as Step2ConfigData;
        return `Template: ${configData.templateType || 'Custom'}`;

      case 'dataset':
        const datasetData = step.data as Step3DatasetData;
        const count = datasetData.selectedDatasets?.length || 0;
        return `${count} dataset${count !== 1 ? 's' : ''} selected`;

      case 'deploy':
        const deployData = step.data as Step4DeployData;
        const target = deployData.deploymentTarget === 'local' ? 'Local' : 'HuggingFace Space';
        return `Target: ${target}`;

      default:
        return undefined;
    }
  }, [state.steps]);

  /**
   * Render step content
   */
  const renderStepContent = (stepId: StepId) => {
    if (currentStep !== stepId) {
      return null; // Only show content for active step
    }

    // Render actual step component based on stepId
    switch (stepId) {
      case 'model':
        return (
          <div className="mt-4">
            <Step1ModelSelection
              stepId="model"
              initialData={state.steps.model.data as Step1ModelData | null}
              onComplete={handleStepComplete}
            />
          </div>
        );

      case 'config':
      case 'dataset':
      case 'deploy':
        // Placeholder for other steps (will be implemented in future tasks)
        return (
          <div className="mt-4 p-6 border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Step {STEP_ORDER.indexOf(stepId) + 1} content will go here.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This step will be implemented in Phase 2.
            </p>

            {/* Debug: Show current step data */}
            {state.steps[stepId].data && (
              <div className="mt-4 p-3 bg-background rounded border">
                <p className="text-xs font-medium mb-2">Current Data:</p>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(state.steps[stepId].data, null, 2)}
                </pre>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-6">
              {canNavigateBackward && (
                <Button onClick={goToPreviousStep} variant="outline" size="sm">
                  ← Back
                </Button>
              )}
              <Button
                onClick={() => {
                  // For demo: just mark as complete (cast to bypass strict typing for placeholder)
                  handleStepComplete(stepId, {
                    [`${stepId}Data`]: 'placeholder',
                    selectedAt: new Date().toISOString(),
                  } as unknown as StepData);
                }}
                variant="default"
                size="sm"
              >
                {canNavigateForward ? 'Continue →' : 'Complete'}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle>Training Package Wizard</CardTitle>
              <CardDescription>
                Create a complete training package: select model, configure training, attach datasets, and deploy
              </CardDescription>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {state.isDraft && (
                <div className="px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs font-medium">
                  Draft
                </div>
              )}
              {state.isPublished && (
                <div className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Published
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Package info */}
          <div className="flex items-center justify-between text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">
                Package: <span className="font-medium text-foreground">{state.packageBaseName}</span>
              </p>
              <p className="text-muted-foreground">
                Version: <span className="font-medium text-foreground">v{state.version}</span>
                {state.lastAutoSave && (
                  <span className="ml-2 text-xs">
                    (Auto-saved {new Date(state.lastAutoSave).toLocaleTimeString()})
                  </span>
                )}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => markAsDraft()}
                variant="outline"
                size="sm"
                disabled={state.isDraft}
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save Draft
              </Button>
              <Button
                onClick={handlePublish}
                variant="default"
                size="sm"
                disabled={!STEP_ORDER.every(s => state.steps[s].status === 'completed')}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Publish
              </Button>
              {onCancel && (
                <Button onClick={onCancel} variant="ghost" size="sm">
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Validation errors */}
          {STEP_ORDER.some(s => state.steps[s].errors && state.steps[s].errors!.length > 0) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Some steps have validation errors. Please review and fix them before publishing.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <div className="space-y-4">
        {STEP_ORDER.map((stepId, index) => {
          const step = state.steps[stepId];

          return (
            <div key={stepId} onClick={() => handleStepClick(stepId)} className="cursor-pointer">
              <StepHeader
                stepId={stepId}
                number={index + 1}
                title={STEP_NAMES[stepId]}
                status={step.status}
                summary={getStepSummary(stepId)}
                isActive={currentStep === stepId}
                onEdit={() => handleStepEdit(stepId)}
              />

              {/* Step Content */}
              {renderStepContent(stepId)}
            </div>
          );
        })}
      </div>

      {/* Version History (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Version history will be displayed here in Phase 1.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

console.log('[TrainingPackageWizard] Component defined');
