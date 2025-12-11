/**
 * TrainingPackageWizard Test/Demo
 * Interactive demonstration of the complete wizard
 * Date: 2025-01-31
 */

'use client';

import React from 'react';
import { TrainingPackageWizard } from './TrainingPackageWizard';
import type { WorkflowState } from './types';

/**
 * Demo Component
 * Shows TrainingPackageWizard in action
 */
export function TrainingPackageWizardDemo() {
  const handleAutoSave = (state: WorkflowState) => {
    console.log('[Demo] Auto-save triggered:', {
      packageId: state.packageId,
      version: state.version,
      currentStep: state.currentStep,
      isDraft: state.isDraft,
    });
  };

  const handleComplete = (packageId: string, versionId: string) => {
    console.log('[Demo] Wizard complete:', { packageId, versionId });
    alert(`Training package published!\nPackage ID: ${packageId}\nVersion: ${versionId}`);
  };

  const handleCancel = () => {
    console.log('[Demo] Wizard cancelled');
    if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      // Handle cancellation
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Training Package Wizard Demo</h1>
        <p className="text-muted-foreground">
          Interactive demo of the complete 4-step training package creation workflow.
        </p>
      </div>

      <TrainingPackageWizard
        sessionToken="demo-session-token"
        onAutoSave={handleAutoSave}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />

      <div className="mt-6 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-semibold text-sm mb-2">Demo Instructions</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Click on step headers to navigate between steps</li>
          <li>Click &quot;Continue →&quot; to mark current step as complete and advance</li>
          <li>Edit button appears on completed steps</li>
          <li>Auto-save runs every 30 seconds (check console)</li>
          <li>Publish button enables when all steps are complete</li>
          <li>Version history placeholder shown at bottom</li>
        </ul>
      </div>
    </div>
  );
}

console.log('[TrainingPackageWizard.test] Demo component loaded');
