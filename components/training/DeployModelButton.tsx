/**
 * Deploy Model Button Component
 *
 * Allows one-click deployment of trained models to local inference servers
 * - Appears when training is complete
 * - Supports vLLM and Ollama
 * - Shows deployment progress
 * - Redirects to models page on success
 *
 * Phase: Tier 2 - Training Integration
 * Date: 2025-10-28
 */

'use client';

import { useState, useEffect } from 'react';
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
import { Slider } from '@/components/ui/slider';
import { Rocket, Loader2, CheckCircle, XCircle, Package, AlertCircle, ExternalLink, Cloud } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckpointSelector } from './CheckpointSelector';
import type { TrainingCheckpoint } from '@/lib/training/checkpoint.types';
import { STATUS, Status } from '@/lib/constants';
import { Checkbox } from '@/components/ui/checkbox';

interface DeployModelButtonProps {
  jobId: string;
  modelName?: string;
  status: Status;
}

type DeploymentStatus = typeof STATUS.IDLE | typeof STATUS.DEPLOYING | typeof STATUS.SUCCESS | typeof STATUS.ERROR;
type VLLMStatus = typeof STATUS.CHECKING | typeof STATUS.AVAILABLE | typeof STATUS.UNAVAILABLE | typeof STATUS.ERROR;
type ServerType = typeof STATUS.VLLM | typeof STATUS.OLLAMA | typeof STATUS.RUNPOD | typeof STATUS.RUNPOD_SERVERLESS;

/**
 * Recommend GPU based on model size
 * Estimates VRAM requirements from model name (e.g., "7B", "13B")
 */
function getGpuRecommendation(modelName?: string): {
  recommended: string;
  minimum: string;
  reason: string;
} {
  if (!modelName) {
    return {
      recommended: 'NVIDIA RTX A5000',
      minimum: 'NVIDIA RTX A4000',
      reason: 'Default recommendation for typical fine-tuned models',
    };
  }

  const name = modelName.toLowerCase();

  // Extract parameter count (7B, 13B, 34B, etc.)
  const match = name.match(/(\d+)b/);
  const params = match ? parseInt(match[1]) : null;

  if (params === null) {
    // No size info - assume small model
    return {
      recommended: 'NVIDIA RTX A5000',
      minimum: 'NVIDIA RTX A4000',
      reason: 'Default recommendation (model size unknown)',
    };
  }

  // VRAM requirements (rough estimates for inference with context):
  // - 1B-3B: ~4-8GB
  // - 7B: ~14-16GB
  // - 13B: ~26-28GB
  // - 34B: ~68-72GB
  // - 70B+: 140GB+

  if (params <= 3) {
    return {
      recommended: 'NVIDIA RTX A4000',
      minimum: 'NVIDIA RTX A4000',
      reason: `${params}B model - fits comfortably in 16GB`,
    };
  } else if (params <= 7) {
    return {
      recommended: 'NVIDIA RTX A5000',
      minimum: 'NVIDIA RTX A4000',
      reason: `${params}B model - needs ~16GB VRAM`,
    };
  } else if (params <= 13) {
    return {
      recommended: 'NVIDIA RTX A6000',
      minimum: 'NVIDIA RTX A5000',
      reason: `${params}B model - needs ~28GB VRAM`,
    };
  } else if (params <= 34) {
    return {
      recommended: 'NVIDIA A100 80GB',
      minimum: 'NVIDIA A100 80GB',
      reason: `${params}B model - needs ~72GB VRAM`,
    };
  } else {
    return {
      recommended: 'NVIDIA A100 80GB',
      minimum: 'NVIDIA A100 80GB',
      reason: `${params}B model - requires large GPU (70GB+)`,
    };
  }
}

export function DeployModelButton({
  jobId,
  modelName,
  status,
}: DeployModelButtonProps) {
  const router = useRouter();
  const { session } = useAuth();

  const [open, setOpen] = useState(false);
  const [serverType, setServerType] = useState<ServerType>(STATUS.VLLM);
  const [customName, setCustomName] = useState('');
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>(STATUS.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pollingMessage, setPollingMessage] = useState<string>('');
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  // RunPod configuration
  const [runpodGpu, setRunpodGpu] = useState<string>('NVIDIA RTX A4000');
  const [runpodBudget, setRunpodBudget] = useState<string>('5.00');
  const [useNetworkVolume, setUseNetworkVolume] = useState<boolean>(true);
  const [volumeSizeGb, setVolumeSizeGb] = useState<number>(50);

  // vLLM configuration
  const [maxModelLen, setMaxModelLen] = useState<number>(8192);
  const [gpuMemoryUtil, setGpuMemoryUtil] = useState<number>(0.7); // Default 70% - safe for dev environments

  // Serverless-specific configuration
  const [gpuMemoryUtilization, setGpuMemoryUtilization] = useState<number>(0.85); // Default 85% for serverless
  const [minWorkers, setMinWorkers] = useState<number>(0); // Scale to zero by default
  const [maxWorkers, setMaxWorkers] = useState<number>(1); // Conservative default to stay within quota

  // vLLM availability state
  const [vllmStatus, setVllmStatus] = useState<VLLMStatus>(STATUS.CHECKING);
  const [vllmVersion, setVllmVersion] = useState<string | null>(null);

  // Checkpoint selection state
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<TrainingCheckpoint | null>(null);

  // Set recommended GPU when dialog opens
  useEffect(() => {
    if (open && serverType === STATUS.RUNPOD_SERVERLESS) {
      const recommendation = getGpuRecommendation(modelName);
      setRunpodGpu(recommendation.recommended);
    }
  }, [open, serverType, modelName]);

  // Check vLLM availability on component mount
  useEffect(() => {
    const checkVLLMAvailability = async () => {
      console.log('[DeployButton] Checking vLLM availability...');
      
      try {
        const response = await fetch('/api/training/vllm/check');
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('[DeployButton] vLLM check result:', data);
        
        setVllmStatus(data.available ? STATUS.AVAILABLE : STATUS.UNAVAILABLE);
        setVllmVersion(data.version);
      } catch (error) {
        console.error('[DeployButton] vLLM check failed:', error);
        setVllmStatus(STATUS.ERROR);
        setVllmVersion(null);
      }
    };

    checkVLLMAvailability();
  }, []);

  // Main polling effect
  useEffect(() => {
    if (deploymentId && deploymentStatus === STATUS.DEPLOYING) {
      const interval = setInterval(async () => {
        try {
          if (!session?.access_token) return;

          setPollingMessage('Checking deployment status...');
          const res = await fetch(`/api/training/deploy?server_id=${deploymentId}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          });

          if (!res.ok) {
            // Stop polling on server error, but don't assume deployment failed
            setPollingMessage('Could not retrieve deployment status.');
            return;
          }

          const statusData = await res.json();
          setPollingMessage(`Deployment status: ${statusData.status || 'unknown'}`);

          if (statusData.status === STATUS.RUNNING || statusData.status === 'active') {
            setDeploymentStatus(STATUS.SUCCESS);
            toast.success('Deployment Active!', { description: 'Your model is now ready to use.' });
            clearInterval(interval);
            setTimeout(() => router.push(`/models?modelId=${statusData.model_id || ''}`), 1500);
          } else if (statusData.status === STATUS.ERROR || statusData.status === 'failed') {
            setDeploymentStatus(STATUS.ERROR);
            setErrorMessage(statusData.errorMessage || 'Deployment failed with an unknown error.');
            clearInterval(interval);
          }
        } catch (e) {
          console.error('Polling error:', e);
          setPollingMessage('Error checking status.');
        }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [deploymentId, deploymentStatus, session, router]);

  // Only show button when training is complete
  if (status !== STATUS.COMPLETED) {
    return null;
  }

  const handleDeploy = async () => {
    setDeploymentStatus(STATUS.DEPLOYING);
    setErrorMessage('');
    setPollingMessage('Submitting deployment request...');

    try {
      if (!session?.access_token) throw new Error('You must be logged in to deploy models.');

      console.log('[DeployButton] Starting deployment:', { jobId, serverType });

      const response = await fetch('/api/training/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          job_id: jobId,
          server_type: serverType,
          checkpoint_path: selectedCheckpoint?.path,
          name: customName || modelName || `trained-model-${Date.now()}`,
          config: {
            gpu_memory_utilization: serverType === STATUS.RUNPOD_SERVERLESS ? gpuMemoryUtilization : gpuMemoryUtil,
            max_model_len: maxModelLen,
            ...(serverType === STATUS.RUNPOD && {
              gpu_type: runpodGpu,
              budget_limit: parseFloat(runpodBudget),
              use_network_volume: useNetworkVolume,
              volume_size_gb: volumeSizeGb,
            }),
            ...(serverType === STATUS.RUNPOD_SERVERLESS && {
              gpu_type: runpodGpu,
              budget_limit: parseFloat(runpodBudget),
              min_workers: minWorkers,
              max_workers: maxWorkers,
            }),
          },
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        const errorDetails = data.details || data.error || 'Deployment failed';
        toast.error('Deployment Failed', { description: errorDetails, duration: 10000 });
        throw new Error(errorDetails);
      }

      console.log('[DeployButton] Initial deployment response:', data);

      if (data.success) {
        toast.info('Deployment initiated!', { description: data.message });
        setDeploymentId(data.pod_id || data.server_id || data.endpoint_id);
        setPollingMessage('Deployment initiated, waiting for status updates...');
        // The useEffect for polling will now take over.
      } else {
        throw new Error(data.error || 'Unknown deployment error');
      }
    } catch (error) {
      console.error('[DeployButton] Deployment error:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setDeploymentStatus(STATUS.ERROR);
      setErrorMessage(errorMsg);
      toast.error('Deployment failed', { description: errorMsg });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex gap-2">
          {/* vLLM Button with availability states */}
          {vllmStatus === STATUS.CHECKING && (
            <Button
              variant="default"
              size="lg"
              disabled
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Checking vLLM...
            </Button>
          )}
          
          {vllmStatus === STATUS.UNAVAILABLE && (
            <Button
              variant="outline"
              size="lg"
              disabled
              className="border-orange-500 text-orange-600"
            >
              <Rocket className="mr-2 h-5 w-5" />
              vLLM Not Available
            </Button>
          )}
          
          {vllmStatus === STATUS.ERROR && (
            <Button
              variant="outline"
              size="lg"
              disabled
              className="border-red-500 text-red-600"
            >
              <Rocket className="mr-2 h-5 w-5" />
              vLLM Check Failed
            </Button>
          )}
          
          {vllmStatus === STATUS.AVAILABLE && (
            <Button
              variant="default"
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={() => {
                setServerType(STATUS.VLLM);
                setOpen(true);
              }}
            >
              <Rocket className="mr-2 h-5 w-5" />
              Deploy to vLLM{vllmVersion && ` (v${vllmVersion})`}
            </Button>
          )}

          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setServerType(STATUS.OLLAMA);
              setOpen(true);
            }}
          >
            <Package className="mr-2 h-5 w-5" />
            Deploy to Ollama
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="text-foreground bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            onClick={() => {
              setServerType(STATUS.RUNPOD);
              setOpen(true);
            }}
          >
            <Image src="/icons/runpod.png" alt="RunPod" width={20} height={20} className="mr-2" />
            Deploy to Production
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="text-foreground bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            onClick={() => {
              setServerType(STATUS.RUNPOD_SERVERLESS);
              setOpen(true);
            }}
          >
            <Image src="/icons/runpod.png" alt="RunPod" width={20} height={20} className="mr-2" />
            Deploy for Testing
          </Button>
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Deploy Trained Model</DialogTitle>
          <DialogDescription>
            Deploy your trained model to a local inference server for testing and use.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-2">{/* Scrollable content wrapper */}

        {/* vLLM Installation Instructions */}
        {vllmStatus === STATUS.UNAVAILABLE && deploymentStatus === STATUS.IDLE && (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>vLLM Not Available</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>vLLM is not installed or not found in the configured Python environment.</p>
              
              <div className="bg-background/50 rounded p-3 space-y-2">
                <p className="font-semibold text-sm">Installation Steps:</p>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Install vLLM: <code className="bg-muted px-1 py-0.5 rounded">pip install vllm</code></li>
                  <li>Or set VLLM_PYTHON_PATH in .env.local to point to Python with vLLM</li>
                  <li>Restart the Next.js development server</li>
                </ol>
                <a 
                  href="https://docs.vllm.ai/en/latest/getting_started/installation.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center gap-1 hover:underline text-blue-600"
                >
                  View vLLM Installation Docs
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {deploymentStatus === STATUS.IDLE && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="server-type">Inference Server</Label>
              <Select
                value={serverType}
                onValueChange={(value) => setServerType(value as ServerType)}
              >
                <SelectTrigger id="server-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS.VLLM}>
                    vLLM (OpenAI-compatible)
                  </SelectItem>
                  <SelectItem value={STATUS.OLLAMA}>
                    Ollama (Local Models)
                  </SelectItem>
                  <SelectItem value={STATUS.RUNPOD}>
                    RunPod vLLM (Cloud GPU Pod)
                  </SelectItem>
                  <SelectItem value={STATUS.RUNPOD_SERVERLESS}>
                    RunPod Serverless (Auto-scaling)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {serverType === STATUS.VLLM
                  ? 'vLLM will start on port 8002+ and be accessible at http://localhost:XXXX'
                  : serverType === STATUS.OLLAMA
                  ? 'Ollama runs on port 11434 and supports multiple models simultaneously'
                  : serverType === STATUS.RUNPOD
                  ? 'Deploy to RunPod cloud GPU pod with vLLM - pay per hour, instant availability'
                  : 'Deploy serverless to RunPod - auto-scales workers, pay per request'}
              </p>
            </div>

            {/* Checkpoint Selection */}
            <CheckpointSelector
              jobId={jobId}
              onSelect={(checkpoint) => setSelectedCheckpoint(checkpoint)}
              defaultSelection="best"
            />

            <div className="space-y-2">
              <Label htmlFor="model-name">Model Name</Label>
              <Input
                id="model-name"
                placeholder={modelName || 'trained-model'}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Display name for your model in the UI
              </p>
            </div>

            {/* RunPod Pod configuration */}
            {serverType === STATUS.RUNPOD && (
              <div className="space-y-4 p-4 border rounded-lg bg-purple-50/50 dark:bg-purple-900/10">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  RunPod Pod Configuration
                </h4>

                <div className="space-y-2">
                  <Label htmlFor="runpod-gpu">GPU Type</Label>
                  <Select value={runpodGpu} onValueChange={setRunpodGpu}>
                    <SelectTrigger id="runpod-gpu">
                      <SelectValue placeholder="Select GPU" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NVIDIA RTX A4000">NVIDIA RTX A4000 (16GB) - $0.20/hr</SelectItem>
                      <SelectItem value="NVIDIA RTX A5000">NVIDIA RTX A5000 (24GB) - $0.28/hr</SelectItem>
                      <SelectItem value="NVIDIA RTX A6000">NVIDIA RTX A6000 (48GB) - $0.50/hr</SelectItem>
                      <SelectItem value="NVIDIA A40">NVIDIA A40 (48GB) - $0.44/hr</SelectItem>
                      <SelectItem value="NVIDIA A100 40GB">NVIDIA A100 (40GB) - $1.09/hr</SelectItem>
                      <SelectItem value="NVIDIA A100 80GB">NVIDIA A100 (80GB) - $1.69/hr</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="pt-4 border-t border-purple-200 dark:border-purple-800 space-y-3">
                  <div className="items-center flex space-x-2">
                    <Checkbox id="use-network-volume" checked={useNetworkVolume} onCheckedChange={(checked) => setUseNetworkVolume(Boolean(checked))} />
                    <label
                        htmlFor="use-network-volume"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Use Persistent Storage
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground pl-1">
                      Caches the model on a Network Volume for significantly faster startups on subsequent deployments. A small monthly storage fee applies.
                  </p>

                  {useNetworkVolume && (
                      <div className="space-y-2 pl-1 pt-2">
                          <Label htmlFor="volume-size">Volume Size (GB)</Label>
                          <Input
                              id="volume-size"
                              type="number"
                              step="10"
                              min="10"
                              placeholder="50"
                              value={volumeSizeGb}
                              onChange={(e) => setVolumeSizeGb(parseInt(e.target.value))}
                          />
                          <p className="text-xs text-muted-foreground">
                              Allocate enough space for the model. 15GB for a 7B model is a safe bet.
                          </p>
                      </div>
                  )}
                </div>


                <div className="space-y-2">
                  <Label htmlFor="runpod-budget">Budget Limit (USD)</Label>
                  <Input
                    id="runpod-budget"
                    type="number"
                    step="0.50"
                    min="1"
                    placeholder="5.00"
                    value={runpodBudget}
                    onChange={(e) => setRunpodBudget(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pod will stop when budget is reached
                  </p>
                </div>
              </div>
            )}

            {/* RunPod Serverless configuration */}
            {serverType === STATUS.RUNPOD_SERVERLESS && (
              <div className="space-y-4 p-4 border rounded-lg bg-purple-50/50 dark:bg-purple-900/10">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  RunPod Serverless Configuration
                </h4>

                {/* GPU Recommendation Alert */}
                {(() => {
                  const recommendation = getGpuRecommendation(modelName);
                  return (
                    <Alert className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                      <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertTitle className="text-blue-900 dark:text-blue-100">
                        GPU Recommendation
                      </AlertTitle>
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        <div className="space-y-1">
                          <p className="font-medium">Recommended: {recommendation.recommended}</p>
                          <p className="text-xs">{recommendation.reason}</p>
                          {recommendation.minimum !== recommendation.recommended && (
                            <p className="text-xs">Minimum: {recommendation.minimum}</p>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  );
                })()}

                <div className="space-y-2">
                  <Label htmlFor="serverless-gpu">GPU Type</Label>
                  <Select value={runpodGpu} onValueChange={setRunpodGpu}>
                    <SelectTrigger id="serverless-gpu">
                      <SelectValue placeholder="Select GPU" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NVIDIA RTX A4000">NVIDIA RTX A4000 (16GB) - ~$0.00028/sec</SelectItem>
                      <SelectItem value="NVIDIA RTX A5000">NVIDIA RTX A5000 (24GB) - ~$0.00042/sec</SelectItem>
                      <SelectItem value="NVIDIA RTX A6000">NVIDIA RTX A6000 (48GB) - ~$0.00069/sec</SelectItem>
                      <SelectItem value="NVIDIA A40">NVIDIA A40 (48GB) - ~$0.00061/sec</SelectItem>
                      <SelectItem value="NVIDIA A100 40GB">NVIDIA A100 (40GB) - ~$0.00107/sec</SelectItem>
                      <SelectItem value="NVIDIA A100 80GB">NVIDIA A100 80GB - ~$0.00157/sec</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select GPU based on your model size. Larger models need more VRAM.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="serverless-max-context" className="text-sm font-medium">
                      Max Context Length
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {maxModelLen.toLocaleString()} tokens
                    </span>
                  </div>
                  <Slider
                    id="serverless-max-context"
                    min={512}
                    max={8192}
                    step={512}
                    value={[maxModelLen]}
                    onValueChange={(value) => setMaxModelLen(value[0])}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower values use less memory. Start with 2048 if you get OOM errors.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gpu-memory-util" className="text-sm font-medium">
                      GPU Memory Utilization
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {(gpuMemoryUtilization * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    id="gpu-memory-util"
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    value={[gpuMemoryUtilization]}
                    onValueChange={(value) => setGpuMemoryUtilization(value[0])}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of GPU memory to use. Lower = more stable, higher = better performance.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serverless-budget">Budget Limit (USD)</Label>
                  <Input
                    id="serverless-budget"
                    type="number"
                    step="1"
                    min="5"
                    placeholder="10.00"
                    value={runpodBudget}
                    onChange={(e) => setRunpodBudget(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Endpoint will pause when budget is reached. Pay only for actual usage.
                  </p>
                </div>

                {/* Worker Scaling Configuration */}
                <div className="pt-3 border-t space-y-4">
                  <h5 className="text-sm font-medium">Worker Scaling</h5>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min-workers">Min Workers</Label>
                      <Select value={String(minWorkers)} onValueChange={(v) => setMinWorkers(parseInt(v))}>
                        <SelectTrigger id="min-workers">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 (Scale to zero)</SelectItem>
                          <SelectItem value="1">1 (Always warm)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max-workers">Max Workers</Label>
                      <Select value={String(maxWorkers)} onValueChange={(v) => setMaxWorkers(parseInt(v))}>
                        <SelectTrigger id="max-workers">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 worker</SelectItem>
                          <SelectItem value="2">2 workers</SelectItem>
                          <SelectItem value="3">3 workers</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Workers auto-scale based on request load. Min=0 means endpoint sleeps when idle (no cost).
                    Max workers are limited by your RunPod quota (typically 5 total across all endpoints).
                  </p>
                </div>
              </div>
            )}

            {/* Local deployment configuration */}
            {serverType !== STATUS.RUNPOD && (
              <div className="rounded-lg border p-4 bg-muted/50 space-y-4">
                <h4 className="text-sm font-medium">Configuration</h4>

                {/* Max Context Length Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="max-context" className="text-sm font-medium">
                      Max Context Length
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {maxModelLen.toLocaleString()} tokens
                    </span>
                  </div>
                  <Slider
                    id="max-context"
                    min={2048}
                    max={32768}
                    step={2048}
                    value={[maxModelLen]}
                    onValueChange={(value) => setMaxModelLen(value[0])}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher values require more GPU memory. 8k recommended for most models.
                  </p>
                </div>

                {/* GPU Memory Utilization Slider - vLLM only */}
                {serverType === STATUS.VLLM && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="gpu-memory" className="text-sm font-medium">
                        GPU Memory Utilization
                      </Label>
                      <span className="text-sm text-muted-foreground">
                        {(gpuMemoryUtil * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      id="gpu-memory"
                      min={0.5}
                      max={0.95}
                      step={0.05}
                      value={[gpuMemoryUtil]}
                      onValueChange={(value) => setGpuMemoryUtil(value[0])}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower if other processes use GPU memory. Recommended: 0.6-0.7 for development, 0.8-0.9 for production.
                    </p>
                  </div>
                )}

                {/* Static configuration info */}
                <div className="pt-2 border-t">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• GPU Memory: {(gpuMemoryUtil * 100).toFixed(0)}% utilization</li>
                    <li>• Port: Auto-allocated (8002-8020)</li>
                    <li>• Security: Bound to localhost only</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {deploymentStatus === STATUS.DEPLOYING && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Deployment in Progress...</h3>
              <p className="text-sm text-muted-foreground">
                {pollingMessage || 'Initializing deployment...'}
              </p>
              <p className="text-xs text-muted-foreground">
                This may take several minutes, especially for the first deployment.
              </p>
            </div>
          </div>
        )}

        {deploymentStatus === STATUS.SUCCESS && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Deployment Successful!</h3>
              <p className="text-sm text-muted-foreground">
                Redirecting to models page...
              </p>
            </div>
          </div>
        )}

        {deploymentStatus === STATUS.ERROR && (
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

        {deploymentStatus === STATUS.IDLE && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={
                !serverType ||
                !selectedCheckpoint ||
                (serverType === STATUS.VLLM && vllmStatus !== STATUS.AVAILABLE)
              }
            >
              <Rocket className="mr-2 h-4 w-4" />
              {!selectedCheckpoint
                ? 'Select Checkpoint'
                : serverType === STATUS.VLLM && vllmStatus === STATUS.CHECKING
                ? 'Checking vLLM...'
                : serverType === STATUS.VLLM && vllmStatus === STATUS.UNAVAILABLE
                ? 'vLLM Required'
                : 'Deploy Model'}
            </Button>
          </DialogFooter>
        )}

        </div>{/* End scrollable content wrapper */}

        {(deploymentStatus === STATUS.SUCCESS || deploymentStatus === STATUS.ERROR) && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
