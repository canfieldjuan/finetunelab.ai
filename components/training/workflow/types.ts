/**
 * Training Package Workflow - Type Definitions
 *
 * Core types and interfaces for the unified training package workflow system.
 * Supports draft/publish versioning, step-by-step wizard, and deployment tracking.
 *
 * @module components/training/workflow/types
 * @created 2025-01-31
 */

// ============================================================================
// STEP DEFINITIONS
// ============================================================================

/**
 * Available workflow steps in sequential order
 */
export type StepId = 'model' | 'config' | 'dataset' | 'deploy';

/**
 * Ordered list of steps for validation and navigation
 */
export const STEP_ORDER: StepId[] = ['model', 'config', 'dataset', 'deploy'];

/**
 * Step display names for UI
 */
export const STEP_NAMES: Record<StepId, string> = {
  model: 'Model Selection',
  config: 'Training Configuration',
  dataset: 'Dataset Selection',
  deploy: 'Package & Deploy',
};

/**
 * Step status tracking
 */
export type StepStatus = 'not_started' | 'in_progress' | 'completed' | 'error';

// ============================================================================
// MODEL SELECTION (Step 1)
// ============================================================================

/**
 * Model source types for Step 1
 */
export type ModelSource = 'popular' | 'hf_search' | 'local' | 'upload';

/**
 * Model information from HuggingFace or local cache
 */
export interface ModelInfo {
  id: string;                    // HF model ID (e.g., "meta-llama/Llama-2-7b-hf")
  name: string;                  // Display name
  author?: string;               // Model author/organization
  sizeGB: number;                // Size in gigabytes
  isCached: boolean;             // Is model downloaded locally
  cachePath?: string;            // Local path if cached

  // Capabilities
  supportsChatTemplate: boolean;
  supportsLoRA: boolean;
  parameterCount?: number;       // Number of parameters (e.g., 7000000000 for 7B)

  // Metadata
  description?: string;
  tags?: string[];
  downloads?: number;            // HF download count
  likes?: number;                // HF likes
  updatedAt?: Date;

  // Training compatibility
  loraTargets?: string[];        // Recommended LoRA target modules
  family?: string;               // Model family (llama, gpt, mistral, etc.)
}

/**
 * Model search filters for HF Hub
 */
export interface ModelSearchFilters {
  query?: string;
  sizeMaxGB?: number;
  chatCapable?: boolean;
  loraCompatible?: boolean;
  codeSpecialized?: boolean;
  visionCapable?: boolean;
  sort?: 'trending' | 'recent' | 'downloads' | 'likes';
  limit?: number;
}

/**
 * Step 1 data structure
 */
export interface Step1ModelData {
  source: ModelSource;
  modelInfo: ModelInfo;
  selectedAt: Date;
}

// ============================================================================
// TRAINING CONFIGURATION (Step 2)
// ============================================================================

import type { TrainingConfig } from '@/lib/training/training-config.types';
import type { JsonValue } from '@/lib/types';

/**
 * Step 2 data structure (reuses existing TrainingConfig)
 * Imported from existing types
 */
export interface Step2ConfigData {
  trainingConfig: TrainingConfig;
  templateType?: string;
  customizations?: Record<string, JsonValue>;
  validatedAt: Date;
}

// ============================================================================
// DATASET SELECTION (Step 3)
// ============================================================================

/**
 * Dataset selection info
 */
export interface DatasetSelection {
  datasetId: string;
  name: string;
  sampleCount: number;
  format: string;
  sizeBytes: number;
  selected: boolean;
}

/**
 * Step 3 data structure
 */
export interface Step3DatasetData {
  selectedDatasets: DatasetSelection[];
  trainValSplit: number;          // 0-100 percentage for training
  maxSamples?: number;            // Optional limit
  shuffle: boolean;
  selectedAt: Date;
}

// ============================================================================
// PACKAGE & DEPLOY (Step 4)
// ============================================================================

/**
 * Deployment target types
 */
export type DeploymentTarget = 'local' | 'hf_space';

/**
 * HuggingFace Space configuration
 */
export interface HFSpaceConfig {
  spaceName: string;              // e.g., "juan/toolbench-qwen3-training"
  visibility: 'public' | 'private';
  gpuTier: 'none' | 't4-small' | 't4-medium' | 'a10g-small' | 'a10g-large' | 'a100-large';
  budgetLimit: number;            // Maximum spend in USD
  alertThreshold: number;         // Alert at X% of budget (e.g., 80)
  autoStopOnBudget: boolean;      // Stop training if budget exceeded
  notifyEmail?: string;           // Email for notifications
}

/**
 * Local deployment configuration
 */
export interface LocalDeployConfig {
  serverUrl: string;              // e.g., "http://localhost:8000"
  maxGpuMemory?: number;          // Optional GPU memory limit in GB
}

/**
 * Cost estimate breakdown
 */
export interface CostEstimate {
  gpuCostPerHour: number;
  storageCostPerGBMonth: number;
  dataTransferCostPerGB: number;

  estimatedTrainingHours: number;
  estimatedGpuCost: number;
  estimatedStorageCost: number;
  estimatedTransferCost: number;

  totalEstimatedCost: number;
  confidence: 'low' | 'medium' | 'high';

  // Comparison with local training
  localGpuEquivalentCost?: number;
  localEstimatedHours?: number;
}

/**
 * Alternative deployment option for cost comparison
 */
export interface AlternativeCostOption {
  name: string;
  description: string;
  estimatedCost: number;
  estimatedTimeHours: number;
  savings: number;
  note?: string;
}

/**
 * Step 4 data structure
 */
export interface Step4DeployData {
  packageName: string;            // User-facing package name
  deploymentTarget: DeploymentTarget;

  // HF Space config (if hf_space target)
  hfSpaceConfig?: HFSpaceConfig;

  // Local config (if local target)
  localConfig?: LocalDeployConfig;

  // Cost information
  costEstimate?: CostEstimate;
  alternatives?: AlternativeCostOption[];

  // Advanced options
  enableTensorboard: boolean;
  saveCheckpointInterval: number; // Steps between checkpoints
  createColabNotebook: boolean;
  generateGithubGist: boolean;

  selectedAt: Date;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validation error detail
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation result for a step
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============================================================================
// STEP STATE
// ============================================================================

/**
 * Individual step state
 */
export interface StepState<T = unknown> {
  status: StepStatus;
  data: T | null;
  validation: ValidationResult;
  lastModified: Date;
  errors?: string[];
}

// ============================================================================
// WORKFLOW STATE
// ============================================================================

/**
 * Complete workflow state for a training package
 */
export interface WorkflowState {
  // Package identification
  packageId: string;              // UUID for this package
  packageBaseName: string;        // Base name without version/draft suffix
  version: number;                // Current version number

  // Navigation
  currentStep: StepId;

  // Step data
  steps: {
    model: StepState<Step1ModelData>;
    config: StepState<Step2ConfigData>;
    dataset: StepState<Step3DatasetData>;
    deploy: StepState<Step4DeployData>;
  };

  // Version control
  isDraft: boolean;               // Is this a draft (unsaved/unpublished)
  isPublished: boolean;           // Is this a published version
  lastAutoSave: Date | null;      // Last auto-save timestamp

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;             // User ID
}

// ============================================================================
// VERSION HISTORY
// ============================================================================

/**
 * Package version status
 */
export type VersionStatus = 'draft' | 'published' | 'archived';

/**
 * Training status for deployed versions
 */
export type TrainingStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Package version record
 */
export interface PackageVersion {
  id: string;
  packageId: string;
  versionNumber: number;

  // Naming
  name: string;                   // Auto-generated or user-provided

  // Status
  status: VersionStatus;
  createdAt: Date;
  createdBy?: string;
  publishedAt?: Date;
  publishedBy?: string;

  // Snapshots
  configSnapshot: TrainingConfig; // Full config at this version
  modelSnapshot: ModelInfo;       // Model info at this version
  datasetSnapshot: DatasetSelection[]; // Datasets at this version

  // Change tracking
  changeSummary?: string;         // Auto-generated change description
  parentVersionId?: string;       // Parent version if this is a fork/restore

  // Deployment info
  isDeployed: boolean;
  deploymentTarget?: DeploymentTarget;
  deploymentUrl?: string;
  deploymentId?: string;

  // Training results (if deployed)
  trainingStatus?: TrainingStatus;
  trainingStartedAt?: Date;
  trainingCompletedAt?: Date;
  trainingMetrics?: Record<string, JsonValue>;

  // Cost tracking (for HF deployments)
  estimatedCost?: number;
  actualCost?: number;
  budgetLimit?: number;
  costAlertsSent?: {
    threshold: boolean;
    exceeded: boolean;
  };
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  version1: PackageVersion;
  version2: PackageVersion;
  changes: {
    field: string;
    oldValue: JsonValue;
    newValue: JsonValue;
    description: string;
  }[];
}

// ============================================================================
// WORKFLOW ACTIONS
// ============================================================================

type StepData = Step1ModelData | Step2ConfigData | Step3DatasetData | Step4DeployData;

/**
 * Workflow action types for state machine
 */
export type WorkflowAction =
  | { type: 'NAVIGATE_TO_STEP'; stepId: StepId }
  | { type: 'UPDATE_STEP_DATA'; stepId: StepId; data: StepData }
  | { type: 'COMPLETE_STEP'; stepId: StepId }
  | { type: 'SET_STEP_ERROR'; stepId: StepId; errors: string[] }
  | { type: 'VALIDATE_STEP'; stepId: StepId }
  | { type: 'AUTO_SAVE' }
  | { type: 'PUBLISH_VERSION' }
  | { type: 'RESTORE_VERSION'; versionId: string }
  | { type: 'RESET_WORKFLOW' };

// ============================================================================
// COMPONENT PROPS
// ============================================================================

/**
 * Base props for step components
 */
export interface StepComponentProps<T = unknown> {
  isActive: boolean;              // Is this step currently active/expanded
  data: T | null;                 // Current step data
  onComplete: (data: T) => void;  // Callback when step is complete
  onBack?: () => void;            // Optional back navigation
  disabled?: boolean;             // Disable interactions
}

/**
 * Props for TrainingPackageWizard main component
 */
export interface TrainingPackageWizardProps {
  sessionToken?: string;
  packageId?: string;             // For editing existing package
  initialState?: Partial<WorkflowState>;
  onComplete?: (packageId: string, versionId: string) => void;
  onCancel?: () => void;
  onAutoSave?: (state: WorkflowState) => void;
}

/**
 * Props for StepHeader component
 */
export interface StepHeaderProps {
  stepId: StepId;
  number: number;
  title: string;
  status: StepStatus;
  summary?: string;               // Summary text when collapsed
  isActive: boolean;
  onEdit?: () => void;
  disabled?: boolean;
}

/**
 * Props for ProgressIndicator component
 */
export interface ProgressIndicatorProps {
  currentStep: StepId;
  steps: Record<StepId, StepState>;
  onStepClick?: (stepId: StepId) => void;
}

/**
 * Props for VersionHistory component
 */
export interface VersionHistoryProps {
  packageId: string;
  versions: PackageVersion[];
  currentVersionId?: string;
  onRestore?: (versionId: string) => void;
  onCompare?: (v1: string, v2: string) => void;
  onDelete?: (versionId: string) => void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generate draft name utility
 */
export function generateDraftName(baseName: string, version: number, date: Date): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  return `${baseName}-v${version}-draft-${dateStr}`;
}

/**
 * Generate published version name
 */
export function generateVersionName(baseName: string, version: number): string {
  return `${baseName}-v${version}`;
}

/**
 * Get step index in order
 */
export function getStepIndex(stepId: StepId): number {
  return STEP_ORDER.indexOf(stepId);
}

/**
 * Check if can navigate to step
 */
export function canNavigateToStep(
  currentStep: StepId,
  targetStep: StepId,
  steps: Record<StepId, StepState>
): boolean {
  const currentIndex = getStepIndex(currentStep);
  const targetIndex = getStepIndex(targetStep);

  // Can always go backward
  if (targetIndex <= currentIndex) return true;

  // Can only go forward if current step is complete
  return steps[currentStep].status === 'completed';
}

/**
 * Get next step in sequence
 */
export function getNextStep(currentStep: StepId): StepId | null {
  const currentIndex = getStepIndex(currentStep);
  if (currentIndex === -1 || currentIndex >= STEP_ORDER.length - 1) {
    return null;
  }
  return STEP_ORDER[currentIndex + 1];
}

/**
 * Get previous step in sequence
 */
export function getPreviousStep(currentStep: StepId): StepId | null {
  const currentIndex = getStepIndex(currentStep);
  if (currentIndex <= 0) {
    return null;
  }
  return STEP_ORDER[currentIndex - 1];
}

/**
 * Create initial workflow state
 */
export function createInitialWorkflowState(packageBaseName: string): WorkflowState {
  const now = new Date();

  return {
    packageId: '', // Will be set when saved to DB
    packageBaseName,
    version: 1,
    currentStep: 'model',
    steps: {
      model: {
        status: 'in_progress',
        data: null,
        validation: { isValid: false, errors: [], warnings: [] },
        lastModified: now,
      },
      config: {
        status: 'not_started',
        data: null,
        validation: { isValid: false, errors: [], warnings: [] },
        lastModified: now,
      },
      dataset: {
        status: 'not_started',
        data: null,
        validation: { isValid: false, errors: [], warnings: [] },
        lastModified: now,
      },
      deploy: {
        status: 'not_started',
        data: null,
        validation: { isValid: false, errors: [], warnings: [] },
        lastModified: now,
      },
    },
    isDraft: true,
    isPublished: false,
    lastAutoSave: null,
    createdAt: now,
    updatedAt: now,
  };
}
