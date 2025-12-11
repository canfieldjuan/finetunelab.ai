/**
 * Cloud Deployment Wizard
 * Purpose: Stepped wizard for cloud training deployment
 * Steps: 1) Choose Platform → 2) Configure → 3) Review Cost → 4) Deploy
 * Date: 2025-11-01
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Zap,
  Activity,
  Cloud,
  BadgePercent,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { TimeEstimationCard } from './TimeEstimationCard';
import { DatasetAttachment } from './DatasetAttachment';
import { CloudDeploymentConfirmationDialog } from './CloudDeploymentConfirmationDialog';
import type { TrainingConfig } from '@/lib/training/training-config.types';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';
import { estimateTrainingTime } from '@/lib/training/time-estimation';

console.log('[CloudDeploymentWizard] Component loaded');

// Platform types (subset of DeploymentTarget - cloud only)
export type CloudPlatform = 'kaggle' | 'huggingface-spaces' | 'runpod' | 'lambda-labs';

interface CloudDeploymentWizardProps {
  configId: string;
  configName: string;
  config?: TrainingConfig;
  datasetSize?: number;
  sessionToken?: string;
  linkedDatasets?: TrainingDatasetRecord[];
  loadingDatasets?: boolean;
  onDatasetsChange?: (datasets: TrainingDatasetRecord[]) => void;
  onDeploySuccess?: (platform: CloudPlatform, deploymentId: string, url: string) => void;
}

type WizardStep = 'configure' | 'review' | 'deploying' | 'success' | 'error';

export function CloudDeploymentWizard({
  configId,
  configName,
  config,
  datasetSize,
  sessionToken,
  linkedDatasets = [],
  onDatasetsChange,
  onDeploySuccess,
}: CloudDeploymentWizardProps) {
  console.log('[CloudDeploymentWizard] ========== COMPONENT RENDER ==========');
  console.log('[CloudDeploymentWizard] Config name:', configName);
  console.log('[CloudDeploymentWizard] Config ID:', configId);
  console.log('[CloudDeploymentWizard] Config object:', config);
  console.log('[CloudDeploymentWizard] Linked datasets:', linkedDatasets.length);

  // Router for navigation
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('configure');
  const [selectedPlatform, setSelectedPlatform] = useState<CloudPlatform>('runpod');

  console.log('[CloudDeploymentWizard] Current step:', currentStep);
  console.log('[CloudDeploymentWizard] Selected platform:', selectedPlatform);

  // Deployment state
  const [deploying, setDeploying] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [trainingJobId, setTrainingJobId] = useState<string | null>(null); // Job ID for status monitoring
  const [error, setError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<{
    message: string;
    suggestions: string[];
    alternatives?: { gpus: string[]; regions: string[] };
  } | null>(null);

  // RunPod configuration states
  const [runpodGpu, setRunpodGpu] = useState<string>('RTX_A4000');
  const [runpodBudget, setRunpodBudget] = useState<string>('10.00');
  // HF repo name is now auto-generated from HF username + config name (stored in secrets)

  // Lambda Labs configuration states
  const [lambdaGpu, setLambdaGpu] = useState<string>('gpu_1x_a10');
  const [lambdaRegion, setLambdaRegion] = useState<string>('us-west-1');
  const [lambdaBudget, setLambdaBudget] = useState<string>('5.00');

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [estimatedMinutes, setEstimatedMinutes] = useState(0);

  // Handle back navigation
  const handleBack = () => {
    if (currentStep === 'review') {
      setCurrentStep('configure');
    } else if (currentStep === 'error') {
      setCurrentStep('review');
      setError(null);
      setCapacityError(null);
    }
  };

  // Handle configuration step completion
  const handleConfigureComplete = () => {
    setCurrentStep('review');
  };

  // Show confirmation dialog with cost estimation
  const handleDeploy = () => {
    console.log('[CloudDeploymentWizard] ====== DEPLOY BUTTON CLICKED ======');
    console.log('[CloudDeploymentWizard] config:', config);
    console.log('[CloudDeploymentWizard] runpodGpu:', runpodGpu);
    console.log('[CloudDeploymentWizard] datasetSize:', datasetSize);

    if (config) {
      const gpuKey = runpodGpu.toLowerCase().replace('_', '-');
      const timeEst = estimateTrainingTime(config, gpuKey, datasetSize);
      setEstimatedHours(timeEst.estimated_hours);
      setEstimatedMinutes(timeEst.estimated_minutes);
    } else {
      setEstimatedHours(1);
      setEstimatedMinutes(30);
    }

    console.log('[CloudDeploymentWizard] Opening confirmation dialog...');
    setShowConfirmDialog(true);
  };

  // Actually deploy after confirmation
  const confirmAndDeploy = async () => {
    if (!selectedPlatform) return;

    // Validate datasets are attached
    if (linkedDatasets.length === 0) {
      console.error('[CloudDeploymentWizard] Deployment blocked: No datasets attached');
      setError('Please attach at least one dataset before deploying');
      setShowConfirmDialog(false);
      return;
    }

    console.log('[CloudDeploymentWizard] Starting deployment to:', selectedPlatform);
    console.log('[CloudDeploymentWizard] Deploying with', linkedDatasets.length, 'dataset(s)');
    setShowConfirmDialog(false);
    setCurrentStep('deploying');
    setDeploying(true);
    setError(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Please log in to deploy to cloud platforms');
      }

      const token = sessionToken || session.access_token;

      let response;
      let data;

      if (selectedPlatform === 'lambda-labs') {
        // Deploy to Lambda Labs
        response = await fetch('/api/training/deploy/lambda', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            training_config_id: configId,
            instance_type: lambdaGpu,
            region: lambdaRegion,
            budget_limit: parseFloat(lambdaBudget),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();

          // Check if this is a capacity error
          if (errorData.error_type === 'capacity' && errorData.message && errorData.suggestions) {
            setCapacityError({
              message: errorData.message,
              suggestions: errorData.suggestions,
              alternatives: errorData.alternatives,
            });
          }

          throw new Error(errorData.error || 'Lambda Labs deployment failed');
        }

        data = await response.json();
        setDeploymentUrl(`https://cloud.lambdalabs.com/instances/${data.instance_id}`);
        setDeploymentId(data.instance_id);
        setTrainingJobId(data.job_id);

        console.log('[CloudDeploymentWizard] Lambda Labs deployment successful:', data);
        console.log('[CloudDeploymentWizard] Job ID for monitoring:', data.job_id);
        console.log('[CloudDeploymentWizard] Lambda Instance ID:', data.instance_id);
      } else {
        // Deploy to RunPod (default)
        response = await fetch('/api/training/deploy/runpod', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            training_config_id: configId,
            gpu_type: runpodGpu,
            gpu_count: 1,
            budget_limit: parseFloat(runpodBudget),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Cloud training deployment failed');
        }

        data = await response.json();
        setDeploymentUrl(data.pod_url);
        setDeploymentId(data.pod_id);
        setTrainingJobId(data.job_id);

        console.log('[CloudDeploymentWizard] RunPod deployment successful:', data);
        console.log('[CloudDeploymentWizard] Job ID for monitoring:', data.job_id);
        console.log('[CloudDeploymentWizard] RunPod Pod ID:', data.pod_id);
      }

      setCurrentStep('success');

      // Callback to parent with job_id for status monitoring
      if (data && data.job_id && deploymentUrl) {
        onDeploySuccess?.(selectedPlatform, data.job_id, deploymentUrl);
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Deployment failed';
      console.error('[CloudDeploymentWizard] Deployment error:', errorMsg);
      setError(errorMsg);
      setCurrentStep('error');
    } finally {
      setDeploying(false);
    }
  };

  // Render configuration step
  const renderConfiguration = () => {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Configure Cloud Training</h3>
          <p className="text-sm text-muted-foreground">
            Attach datasets and select GPU provider for your training job
          </p>
        </div>

        {/* Dataset Attachment Section */}
        <div className="space-y-2 pb-4 border-b">
          <h4 className="text-sm font-medium">Training Datasets</h4>
          <p className="text-xs text-muted-foreground mb-2">
            Attach datasets before deploying. Multiple datasets will be combined.
          </p>
          <DatasetAttachment
            configId={configId}
            onDatasetsChange={onDatasetsChange}
          />
          {linkedDatasets.length === 0 && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Warning: No datasets attached. Training requires at least one dataset.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* GPU Provider Selection */}
        <div className="space-y-3 pb-4 border-b">
          <h4 className="text-sm font-medium">GPU Provider</h4>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedPlatform('runpod')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedPlatform === 'runpod'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Cloud className="h-4 w-4" />
                <span className="font-medium">RunPod</span>
              </div>
              <p className="text-xs text-muted-foreground">Serverless GPUs</p>
            </button>
            <button
              onClick={() => setSelectedPlatform('lambda-labs')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedPlatform === 'lambda-labs'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Cloud className="h-4 w-4" />
                <span className="font-medium">Lambda Labs</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  <BadgePercent className="h-3 w-3 mr-0.5" />
                  42% Cheaper
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Cloud GPU instances</p>
            </button>
          </div>
        </div>

        {/* RunPod Configuration */}
        {selectedPlatform === 'runpod' && (
          <div className="space-y-3 pb-4 border-b bg-gray-100 dark:bg-gray-800 -mx-6 px-6 py-4">
            <h4 className="text-sm font-medium">RunPod Configuration</h4>
            <div className="space-y-3">
              <div>
                <Label htmlFor="runpod-gpu" className="text-xs">GPU Type</Label>
                <Select value={runpodGpu} defaultValue="RTX_A4000" onValueChange={setRunpodGpu}>
                  <SelectTrigger id="runpod-gpu" className="mt-1 bg-white dark:bg-gray-900">
                    <SelectValue placeholder="Select GPU" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RTX_A4000">RTX A4000 (16GB) - $0.39/hr</SelectItem>
                    <SelectItem value="RTX_A5000">RTX A5000 (24GB) - $0.56/hr</SelectItem>
                    <SelectItem value="RTX_A6000">RTX A6000 (48GB) - $0.91/hr</SelectItem>
                    <SelectItem value="A100_PCIE">A100 PCIe (40GB) - $2.17/hr</SelectItem>
                    <SelectItem value="A100_SXM">A100 SXM (80GB) - $3.32/hr</SelectItem>
                    <SelectItem value="H100_PCIE">H100 PCIe (80GB) - $5.62/hr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Lambda Labs Configuration */}
        {selectedPlatform === 'lambda-labs' && (
          <div className="space-y-3 pb-4 border-b">
            <h4 className="text-sm font-medium">Lambda Labs Configuration</h4>
            <div className="space-y-3">
              <div>
                <Label htmlFor="lambda-gpu" className="text-xs">GPU Type</Label>
                <Select value={lambdaGpu} onValueChange={setLambdaGpu}>
                  <SelectTrigger id="lambda-gpu" className="mt-1">
                    <SelectValue placeholder="Select GPU" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpu_1x_a10">A10 (24GB) - $0.60/hr</SelectItem>
                    <SelectItem value="gpu_1x_rtx6000">RTX 6000 (24GB) - $0.50/hr</SelectItem>
                    <SelectItem value="gpu_1x_a100">A100 (40GB) - $1.29/hr</SelectItem>
                    <SelectItem value="gpu_1x_a100_sxm4">A100 SXM4 (80GB) - $1.79/hr</SelectItem>
                    <SelectItem value="gpu_1x_h100_pcie">H100 PCIe (80GB) - $1.85/hr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lambda-region" className="text-xs">Region</Label>
                <Select value={lambdaRegion} onValueChange={setLambdaRegion}>
                  <SelectTrigger id="lambda-region" className="mt-1">
                    <SelectValue placeholder="Select Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-west-1">US West 1</SelectItem>
                    <SelectItem value="us-west-2">US West 2</SelectItem>
                    <SelectItem value="us-east-1">US East 1</SelectItem>
                    <SelectItem value="us-south-1">US South 1</SelectItem>
                    <SelectItem value="europe-central-1">Europe Central 1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* HuggingFace Hub Upload Info */}
        <div className="space-y-2 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Model Upload:</strong> If you have a HuggingFace API token and username configured in Settings → Secrets,
            your fine-tuned model will be automatically uploaded to HuggingFace Hub after training completes.
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleBack} variant="outline" className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleConfigureComplete} className="flex-1">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Render review step with time/cost estimation (read-only)
  const renderReview = () => {
    console.log('[CloudDeploymentWizard] renderReview called');
    console.log('[CloudDeploymentWizard] selectedPlatform:', selectedPlatform);
    console.log('[CloudDeploymentWizard] config:', config);

    if (!selectedPlatform || !config) {
      console.error('[CloudDeploymentWizard] Review blocked - missing:', {
        selectedPlatform: !!selectedPlatform,
        config: !!config
      });
      return null;
    }

    // Determine which GPU is selected based on provider
    const selectedGpuForEstimation = selectedPlatform === 'lambda-labs'
      ? lambdaGpu
      : runpodGpu;

    return (
      <div className="space-y-6">
        {/* Time & Cost Estimation - Read-only in review step */}
        <TimeEstimationCard
          config={config}
          datasetSize={datasetSize}
          readOnly={true}
          selectedGpu={selectedGpuForEstimation}
          onBudgetExceeded={(exceeded) => {
            console.log('[CloudDeploymentWizard] Budget exceeded:', exceeded);
          }}
        />

        {/* Configuration Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deployment Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform:</span>
              <span className="font-medium">
                {selectedPlatform === 'lambda-labs' ? 'Lambda Labs' : 'RunPod'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Config:</span>
              <span className="font-medium">{configName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GPU:</span>
              <span className="font-medium">
                {selectedPlatform === 'lambda-labs' ? lambdaGpu : runpodGpu}
              </span>
            </div>
            {selectedPlatform === 'lambda-labs' && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Region:</span>
                <span className="font-medium">{lambdaRegion}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget Limit:</span>
              <span className="font-medium">
                ${selectedPlatform === 'lambda-labs' ? lambdaBudget : runpodBudget}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Model Upload:</span>
              <span className="font-medium text-muted-foreground">Auto (if HF configured)</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleBack} variant="outline" className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleDeploy} className="flex-1" disabled={deploying}>
            {deploying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Deploy Now
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // Render deploying state
  const renderDeploying = () => (
    <div className="py-12 flex flex-col items-center justify-center space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Deploying to FineTune Lab Cloud...</h3>
        <p className="text-sm text-muted-foreground">
          Setting up your training environment. This may take 1-2 minutes.
        </p>
      </div>
    </div>
  );

  // Render success state
  const renderSuccess = () => (
    <div className="py-12 flex flex-col items-center justify-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
        <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Deployment Successful!</h3>
        <p className="text-sm text-muted-foreground">
          {selectedPlatform === 'lambda-labs'
            ? 'GPU instance is booting. Training will start automatically in 2-3 minutes.'
            : 'Your training job has been submitted to FineTune Lab Cloud'}
        </p>
      </div>

      {trainingJobId && (
        <Button
          onClick={() => router.push(`/training/monitor?jobId=${trainingJobId}`)}
          variant="default"
          size="lg"
        >
          <Activity className="mr-2 h-4 w-4" />
          Monitor Training Progress
        </Button>
      )}

      {trainingJobId && (
        <p className="text-xs text-muted-foreground">
          Training Job ID: <code className="bg-muted px-2 py-1 rounded">{trainingJobId}</code>
        </p>
      )}

      {deploymentId && (
        <p className="text-xs text-muted-foreground mt-1">
          {selectedPlatform === 'lambda-labs'
            ? `Lambda Instance ID: `
            : 'RunPod Pod ID: '}
          <code className="bg-muted px-2 py-1 rounded">{deploymentId}</code>
        </p>
      )}

      {selectedPlatform === 'lambda-labs' && deploymentUrl && (
        <Button
          onClick={() => window.open(deploymentUrl, '_blank')}
          variant="outline"
          size="sm"
          className="mt-2"
        >
          View in Lambda Cloud Console
        </Button>
      )}

      <Button
        onClick={() => {
          setCurrentStep('configure');
          setDeploymentUrl(null);
          setDeploymentId(null);
          setTrainingJobId(null);
        }}
        variant="outline"
        className="mt-4"
      >
        Deploy Another Job
      </Button>
    </div>
  );

  // Render error state
  const renderError = () => {
    // Check if this is a capacity error
    if (capacityError) {
      return (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">GPU Unavailable</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {capacityError.message}
            </p>
          </div>

          {/* Suggestions */}
          <div className="w-full max-w-md mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Suggested Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {capacityError.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Change GPU/Region
            </Button>
            <Button onClick={handleDeploy}>
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    // Regular error display
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Deployment Failed</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {error || 'An unknown error occurred during deployment'}
          </p>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={handleDeploy}>
            Try Again
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      {currentStep !== 'deploying' && currentStep !== 'success' && currentStep !== 'error' && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`flex items-center gap-2 ${currentStep === 'configure' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'configure' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
              1
            </div>
            <span className="text-sm font-medium">Configure</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${currentStep === 'review' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'review' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
              2
            </div>
            <span className="text-sm font-medium">Review & Deploy</span>
          </div>
        </div>
      )}

      {/* Review step title - outside the card */}
      {currentStep === 'review' && (
        <div className="mb-2">
          <h3 className="text-lg font-semibold">Review & Deploy</h3>
          <p className="text-sm text-muted-foreground">
            Verify settings and estimated costs before deployment
          </p>
        </div>
      )}

      {/* Wizard content */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 'configure' && renderConfiguration()}
          {currentStep === 'review' && renderReview()}
          {currentStep === 'deploying' && renderDeploying()}
          {currentStep === 'success' && renderSuccess()}
          {currentStep === 'error' && renderError()}
        </CardContent>
      </Card>

      {/* Cost Confirmation Dialog */}
      <CloudDeploymentConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmAndDeploy}
        gpuId={runpodGpu}
        budgetLimit={parseFloat(runpodBudget)}
        estimatedHours={estimatedHours}
        estimatedMinutes={estimatedMinutes}
        configName={configName}
        isDeploying={deploying}
      />
    </div>
  );
}

console.log('[CloudDeploymentWizard] Component defined');
