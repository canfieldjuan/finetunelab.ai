/**
 * Training Package Workflow - Component Exports
 * Centralized export file for workflow components
 * Date: 2025-01-31
 */

// Type definitions and utilities
export * from './types';

// Hooks
export { useWorkflowState } from './useWorkflowState';

// Components
export { StepHeader } from './StepHeader';
export { TrainingPackageWizard } from './TrainingPackageWizard';

console.log('[workflow/index] Workflow components exported');
