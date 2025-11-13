/**
 * Inference Deploy Button Component
 *
 * Deploys trained models to production inference endpoints (RunPod Serverless)
 * - Appears when training is complete
 * - Configures GPU type, workers, budget limits
 * - Deploys to RunPod Serverless for production serving
 * - Shows cost estimation before deployment
 *
 * Phase: Phase 5 - UI Components
 * Date: 2025-11-12
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Cloud, Loader2, CheckCircle, XCircle, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckpointSelector } from '@/components/training/CheckpointSelector';
import type { TrainingCheckpoint } from '@/lib/training/checkpoint.types';
import type { RunPodServerlessGPU } from '@/lib/inference/deployment.types';

interface InferenceDeployButtonProps {
  jobId: string;
  modelName?: string;
  baseModel?: string;
  modelType?: 'lora-adapter' | 'merged-model';
  status: 'running' | 'completed' | 'failed';
}

type DeploymentStatus = 'idle' | 'deploying' | 'success' | 'error';

// GPU pricing (cost per request, approximate)
const GPU_COSTS: Record<RunPodServerlessGPU, number> = {
  'NVIDIA RTX A4000': 0.0004,
  'NVIDIA RTX A5000': 0.0006,
  'NVIDIA RTX A6000': 0.0009,
  'NVIDIA A40': 0.0010,
  'NVIDIA A100 40GB': 0.0015,
  'NVIDIA A100 80GB': 0.0020,
  'NVIDIA H100': 0.0035,
};

export function InferenceDeployButton({
  jobId,
  modelName,
  baseModel = 'meta-llama/Llama-2-7b-hf',
  modelType = 'lora-adapter',
  status,
}: InferenceDeployButtonProps) {
  const router = useRouter();
  const { session } = useAuth();

  const [open, setOpen] = useState(false);
  const [deploymentName, setDeploymentName] = useState('');
  const [gpuType, setGpuType] = useState<RunPodServerlessGPU>('NVIDIA RTX A4000');
  const [minWorkers, setMinWorkers] = useState(0);
  const [maxWorkers, setMaxWorkers] = useState(3);
  const [budgetLimit, setBudgetLimit] = useState(10);
  const [autoStopOnBudget, setAutoStopOnBudget] = useState(true);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Checkpoint selection state
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<TrainingCheckpoint | null>(null);

  // Only show button when training is complete
  if (status !== 'completed') {
    return null;
  }

  // Calculate cost estimation
  const costPerRequest = GPU_COSTS[gpuType];
  const estimatedRequests = budgetLimit / costPerRequest;

  const handleDeploy = async () => {
    setDeploymentStatus('deploying');
    setErrorMessage('');

    try {
      // Check if user is authenticated
      if (!session?.access_token) {
        throw new Error('You must be logged in to deploy models. Please sign in and try again.');
      }

      // Validate required fields
      if (!deploymentName.trim()) {
        throw new Error('Deployment name is required');
      }

      if (!selectedCheckpoint) {
        throw new Error('Please select a checkpoint to deploy');
      }

      if (!budgetLimit || budgetLimit <= 0) {
        throw new Error('Budget limit must be greater than $0');
      }

      console.log('[InferenceDeployButton] Starting deployment:', {
        jobId,
        deploymentName,
        gpuType,
        minWorkers,
        maxWorkers,
        budgetLimit,
        checkpointPath: selectedCheckpoint.path,
      });

      const response = await fetch('/api/inference/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          provider: 'runpod-serverless',
          deployment_name: deploymentName.trim(),
          base_model: baseModel,
          model_type: modelType,
          model_storage_url: selectedCheckpoint.path, // For now, use checkpoint path
          training_job_id: jobId,
          gpu_type: gpuType,
          min_workers: minWorkers,
          max_workers: maxWorkers,
          budget_limit: budgetLimit,
          auto_stop_on_budget: autoStopOnBudget,
        }),
      });

      const data = await response.json();

      console.log('[InferenceDeployButton] API Response:', {
        status: response.status,
        ok: response.ok,
        data: data,
      });

      if (!response.ok) {
        const errorDetails = data.error?.message || data.error || 'Deployment failed';

        console.error('[InferenceDeployButton] Deployment failed:', {
          status: response.status,
          error: data.error,
        });

        toast.error('Deployment Failed', {
          description: errorDetails,
          duration: 10000,
        });

        throw new Error(errorDetails);
      }

      if (data.success) {
        setDeploymentStatus('success');
        toast.success('Inference endpoint deployed!', {
          description: `Deployment "${deploymentName}" is now being provisioned on RunPod Serverless.`,
        });

        // Wait a moment for user to see success message
        setTimeout(() => {
          // Redirect to inference management page
          router.push('/inference');
        }, 1500);
      } else {
        throw new Error(data.error?.message || 'Unknown deployment error');
      }
    } catch (error) {
      console.error('[InferenceDeployButton] Deployment error:', error);

      const errorMsg = error instanceof Error ? error.message : String(error);
      setDeploymentStatus('error');
      setErrorMessage(errorMsg);

      toast.error('Deployment failed', {
        description: errorMsg,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          size="lg"
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          <Cloud className="mr-2 h-5 w-5" />
          Deploy to Production
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deploy to Production Inference</DialogTitle>
          <DialogDescription>
            Deploy your trained model to RunPod Serverless for production serving.
            Configure auto-scaling, budget limits, and GPU type.
          </DialogDescription>
        </DialogHeader>

        {deploymentStatus === 'idle' && (
          <div className="space-y-4 py-4">
            {/* Deployment Name */}
            <div className="space-y-2">
              <Label htmlFor="deployment-name">Deployment Name *</Label>
              <Input
                id="deployment-name"
                placeholder={`${modelName || 'my-model'}-prod`}
                value={deploymentName}
                onChange={(e) => setDeploymentName(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Unique name for this deployment
              </p>
            </div>

            {/* Checkpoint Selection */}
            <CheckpointSelector
              jobId={jobId}
              onSelect={(checkpoint) => setSelectedCheckpoint(checkpoint)}
              defaultSelection="best"
            />

            {/* GPU Type */}
            <div className="space-y-2">
              <Label htmlFor="gpu-type">GPU Type</Label>
              <Select
                value={gpuType}
                onValueChange={(value) => setGpuType(value as RunPodServerlessGPU)}
              >
                <SelectTrigger id="gpu-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NVIDIA RTX A4000">A4000 ($0.0004/request)</SelectItem>
                  <SelectItem value="NVIDIA RTX A5000">A5000 ($0.0006/request)</SelectItem>
                  <SelectItem value="NVIDIA RTX A6000">A6000 ($0.0009/request)</SelectItem>
                  <SelectItem value="NVIDIA A40">A40 ($0.0010/request)</SelectItem>
                  <SelectItem value="NVIDIA A100 40GB">A100 40GB ($0.0015/request)</SelectItem>
                  <SelectItem value="NVIDIA A100 80GB">A100 80GB ($0.0020/request)</SelectItem>
                  <SelectItem value="NVIDIA H100">H100 ($0.0035/request)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Workers Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-workers">Min Workers</Label>
                <Input
                  id="min-workers"
                  type="number"
                  min={0}
                  max={10}
                  value={minWorkers}
                  onChange={(e) => setMinWorkers(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  0 = Scale to zero when idle
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-workers">Max Workers</Label>
                <Input
                  id="max-workers"
                  type="number"
                  min={1}
                  max={20}
                  value={maxWorkers}
                  onChange={(e) => setMaxWorkers(parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum concurrent workers
                </p>
              </div>
            </div>

            {/* Budget Limit */}
            <div className="space-y-2">
              <Label htmlFor="budget-limit">Budget Limit (USD) *</Label>
              <Input
                id="budget-limit"
                type="number"
                min={1}
                step={1}
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(parseFloat(e.target.value) || 0)}
              />
              <p className="text-sm text-muted-foreground">
                Maximum spending limit for this deployment
              </p>
            </div>

            {/* Auto-Stop Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="auto-stop"
                checked={autoStopOnBudget}
                onCheckedChange={(checked) => setAutoStopOnBudget(checked as boolean)}
              />
              <Label htmlFor="auto-stop" className="text-sm font-normal cursor-pointer">
                Auto-stop deployment when budget limit is reached
              </Label>
            </div>

            {/* Cost Estimation */}
            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertTitle>Cost Estimation</AlertTitle>
              <AlertDescription className="space-y-2">
                <div className="text-sm space-y-1">
                  <p>Cost per request: <strong>${costPerRequest.toFixed(4)}</strong></p>
                  <p>Estimated requests: <strong>~{Math.floor(estimatedRequests).toLocaleString()}</strong></p>
                  <p>Budget limit: <strong>${budgetLimit.toFixed(2)}</strong></p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Actual costs may vary based on inference complexity and request patterns.
                  Budget monitoring triggers auto-stop at limit.
                </p>
              </AlertDescription>
            </Alert>

            {/* Important Notice */}
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription className="text-sm">
                This will deploy your model to a live production endpoint that will incur costs.
                Make sure your RunPod API key is configured in Settings → Secrets.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {deploymentStatus === 'deploying' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Deploying to Production...</h3>
              <p className="text-sm text-muted-foreground">
                Creating RunPod Serverless endpoint
              </p>
              <p className="text-xs text-muted-foreground">
                This may take 2-3 minutes
              </p>
            </div>
          </div>
        )}

        {deploymentStatus === 'success' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Deployment Started!</h3>
              <p className="text-sm text-muted-foreground">
                Redirecting to inference management page...
              </p>
            </div>
          </div>
        )}

        {deploymentStatus === 'error' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <XCircle className="h-12 w-12 text-red-600" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Deployment Failed</h3>
              <p className="text-sm text-muted-foreground">
                {errorMessage || 'Unknown error occurred'}
              </p>
            </div>
          </div>
        )}

        {deploymentStatus === 'idle' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={
                !deploymentName.trim() ||
                !selectedCheckpoint ||
                !budgetLimit ||
                budgetLimit <= 0
              }
            >
              <Cloud className="mr-2 h-4 w-4" />
              {!selectedCheckpoint
                ? 'Select Checkpoint'
                : !deploymentName.trim()
                ? 'Enter Deployment Name'
                : 'Deploy to Production'}
            </Button>
          </DialogFooter>
        )}

        {deploymentStatus === 'error' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setDeploymentStatus('idle');
                setErrorMessage('');
              }}
            >
              Try Again
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
