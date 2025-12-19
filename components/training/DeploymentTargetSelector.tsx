/**
 * Deployment Target Selector
 * Purpose: Choose deployment platform after package generation
 * Supports: Local vLLM, HuggingFace Spaces, RunPod, AWS SageMaker, Kaggle
 * Date: 2025-10-31
 * Updated: 2025-12-18 - Replaced Lambda Labs with AWS SageMaker
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Rocket,
  Laptop,
  Cloud,
  Database,
  Globe,
  Check,
  Loader2,
  ExternalLink,
  AlertCircle,
  DollarSign,
  Settings,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Deployment target types
 */
export type DeploymentTarget =
  | 'local-vllm'
  | 'local-gpu'
  | 'huggingface-spaces'
  | 'runpod'
  | 'sagemaker'
  | 'kaggle'
  | 'google-colab';

/**
 * Deployment target configuration
 */
interface DeploymentOption {
  id: DeploymentTarget;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  available: boolean;
  comingSoon?: boolean;
}

interface DeploymentTargetSelectorProps {
  trainingConfigId: string;
  sessionToken?: string;
  onDeploy?: (target: DeploymentTarget, deploymentId: string) => void;
}

export function DeploymentTargetSelector({
  trainingConfigId,
  sessionToken,
  onDeploy,
}: DeploymentTargetSelectorProps) {
  const [selectedTarget, setSelectedTarget] = useState<DeploymentTarget | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Configuration states
  const [kaggleTitle, setKaggleTitle] = useState('');
  const [runpodGpu, setRunpodGpu] = useState<string>('RTX_A4000');
  const [runpodBudget, setRunpodBudget] = useState<string>('5.00');
  const [hfSpaceName, setHfSpaceName] = useState('');
  const [hfGpuTier, setHfGpuTier] = useState<string>('t4-small');
  const [hfBudget, setHfBudget] = useState<string>('3.00');
  const [colabNotebookName, setColabNotebookName] = useState('');
  const [colabGpuTier, setColabGpuTier] = useState<string>('t4');
  const [colabBudget, setColabBudget] = useState<string>('100');

  // SageMaker configuration
  const [sagemakerInstance, setSagemakerInstance] = useState<string>('ml.g5.xlarge');
  const [sagemakerUseSpot, setSagemakerUseSpot] = useState<boolean>(true);
  const [sagemakerBudget, setSagemakerBudget] = useState<string>('5.00');

  /**
   * Available deployment options
   */
  const deploymentOptions: DeploymentOption[] = [
    {
      id: 'local-vllm',
      label: 'Local vLLM',
      description: 'Deploy to local vLLM server for fast inference',
      icon: <Laptop className="w-5 h-5" />,
      badge: 'Fastest',
      available: true,
    },
    {
      id: 'local-gpu',
      label: 'Local GPU',
      description: 'Train on your local GPU hardware',
      icon: <Laptop className="w-5 h-5" />,
      available: true,
    },
    {
      id: 'huggingface-spaces',
      label: 'HuggingFace Spaces',
      description: 'Deploy to HuggingFace Spaces with GPU support and cost tracking',
      icon: <Globe className="w-5 h-5" />,
      badge: 'Cloud',
      available: true,
    },
    {
      id: 'runpod',
      label: 'RunPod',
      description: 'Deploy to RunPod serverless GPUs with real-time cost monitoring',
      icon: <Cloud className="w-5 h-5" />,
      badge: 'Serverless',
      available: true,
    },
    {
      id: 'sagemaker',
      label: 'AWS SageMaker',
      description: 'Deploy to AWS SageMaker with spot instances - 70% off',
      icon: <Cloud className="w-5 h-5" />,
      badge: 'Enterprise',
      available: true,
    },
    {
      id: 'kaggle',
      label: 'Kaggle Notebooks',
      description: 'Run training on Kaggle with free T4 GPUs',
      icon: <Database className="w-5 h-5" />,
      badge: 'Free GPUs',
      available: true,
    },
    {
      id: 'google-colab',
      label: 'Google Colab',
      description: 'Run training on Google Colab with T4, A100, or V100 GPUs',
      icon: <Cloud className="w-5 h-5" />,
      badge: 'Popular',
      available: true,
    },
  ];

  /**
   * Handle deployment to selected target
   */
  async function handleDeploy(target: DeploymentTarget) {
    setSelectedTarget(target);
    setDeploying(true);
    setError(null);
    setDeploymentUrl(null);
    setDeploymentId(null);

    try {
      console.log('[DeploymentTargetSelector] Deploying to:', target);

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Please log in to deploy to cloud platforms');
      }

      const token = sessionToken || session.access_token;
      let response;
      let data;

      if (target === 'kaggle') {
        // Deploy to Kaggle
        response = await fetch('/api/training/deploy/kaggle', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            training_config_id: trainingConfigId,
            notebook_title: kaggleTitle || `Training-${Date.now()}`,
            is_private: true,
            enable_gpu: true,
            enable_internet: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Kaggle deployment failed');
        }

        data = await response.json();
        setDeploymentUrl(data.notebook_url);
        setDeploymentId(data.deployment_id);

      } else if (target === 'runpod') {
        // Deploy to RunPod
        response = await fetch('/api/training/deploy/runpod', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            training_config_id: trainingConfigId,
            gpu_type: runpodGpu,
            gpu_count: 1,
            budget_limit: parseFloat(runpodBudget),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'RunPod deployment failed');
        }

        data = await response.json();
        setDeploymentUrl(data.pod_url);
        setDeploymentId(data.pod_id);

      } else if (target === 'sagemaker') {
        // Deploy to AWS SageMaker
        response = await fetch('/api/training/deploy/sagemaker', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            training_config_id: trainingConfigId,
            instance_type: sagemakerInstance,
            use_spot_instances: sagemakerUseSpot,
            budget_limit: parseFloat(sagemakerBudget),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'SageMaker deployment failed');
        }

        data = await response.json();
        setDeploymentUrl(data.url);
        setDeploymentId(data.training_job_name);

      } else if (target === 'huggingface-spaces') {
        // Deploy to HuggingFace Spaces
        response = await fetch('/api/training/deploy/hf-spaces', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            training_config_id: trainingConfigId,
            space_name: hfSpaceName || `training-${Date.now()}`,
            gpu_tier: hfGpuTier,
            visibility: 'private',
            budget_limit: parseFloat(hfBudget),
            alert_threshold: 80,
            auto_stop_on_budget: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'HuggingFace Spaces deployment failed');
        }

        data = await response.json();
        setDeploymentUrl(data.space_url);
        setDeploymentId(data.deployment_id);

      } else if (target === 'local-vllm') {
        // Call local vLLM deployment API
        console.log('[DeploymentTargetSelector] Local vLLM deployment not yet implemented');
        throw new Error('Local vLLM deployment coming soon. Use the Training page to deploy trained models.');
      } else if (target === 'local-gpu') {
        // Local GPU training - download package and run locally
        console.log('[DeploymentTargetSelector] Local GPU deployment not yet implemented');
        throw new Error('Local GPU deployment coming soon. Use the Local Training tab to download the package.');
      } else if (target === 'google-colab') {
        // Deploy to Google Colab
        response = await fetch('/api/training/deploy/google-colab', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            training_config_id: trainingConfigId,
            notebook_name: colabNotebookName || `training-${Date.now()}`,
            gpu_tier: colabGpuTier,
            budget_limit: parseFloat(colabBudget),
            auto_stop_on_budget: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Google Colab deployment failed');
        }

        data = await response.json();
        setDeploymentUrl(data.notebook_url);
        setDeploymentId(data.deployment_id);

      } else {
        throw new Error(`Unknown deployment target: ${target}`);
      }

      // Success - callback with deployment ID
      if (data && data.deployment_id) {
        onDeploy?.(target, data.deployment_id);
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Deployment failed';
      console.error('[DeploymentTargetSelector] Deployment error:', errorMsg);
      setError(errorMsg);
    } finally {
      setDeploying(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="w-5 h-5" />
          Deploy Training Package
        </CardTitle>
        <CardDescription>
          Choose where to deploy your training package
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Forms */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Deployment Configuration
          </h4>

          {/* Kaggle Configuration */}
          <div className="space-y-2">
            <Label htmlFor="kaggle-title" className="text-sm font-medium">
              Kaggle Notebook Title
            </Label>
            <Input
              id="kaggle-title"
              type="text"
              placeholder="My Training Notebook"
              value={kaggleTitle}
              onChange={(e) => setKaggleTitle(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Optional: Custom title for your Kaggle notebook
            </p>
          </div>

          {/* RunPod Configuration */}
          <div className="space-y-2">
            <Label htmlFor="runpod-gpu" className="text-sm font-medium">
              RunPod GPU Type
            </Label>
            <Select value={runpodGpu} onValueChange={setRunpodGpu}>
              <SelectTrigger id="runpod-gpu">
                <SelectValue placeholder="Select GPU" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RTX_A4000">NVIDIA RTX A4000 (16GB)</SelectItem>
                <SelectItem value="RTX_A5000">NVIDIA RTX A5000 (24GB)</SelectItem>
                <SelectItem value="RTX_A6000">NVIDIA RTX A6000 (48GB)</SelectItem>
                <SelectItem value="A100_PCIE">NVIDIA A100 PCIe (40GB)</SelectItem>
                <SelectItem value="A100_SXM">NVIDIA A100 SXM (80GB)</SelectItem>
                <SelectItem value="H100_PCIE">NVIDIA H100 PCIe (80GB)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 mt-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="runpod-budget" className="text-sm font-medium">
                Budget Limit (USD)
              </Label>
            </div>
            <Input
              id="runpod-budget"
              type="number"
              step="0.01"
              min="0"
              placeholder="10.00"
              value={runpodBudget}
              onChange={(e) => setRunpodBudget(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Training will auto-stop when budget is reached
            </p>
          </div>

          {/* SageMaker Configuration */}
          <div className="space-y-2">
            <Label htmlFor="sagemaker-instance" className="text-sm font-medium">
              SageMaker Instance Type
            </Label>
            <Select value={sagemakerInstance} onValueChange={setSagemakerInstance}>
              <SelectTrigger id="sagemaker-instance">
                <SelectValue placeholder="Select Instance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ml.g5.xlarge">A10G (24GB) - $1.01/hr ($0.40 spot)</SelectItem>
                <SelectItem value="ml.g5.2xlarge">A10G (24GB) - $1.21/hr ($0.48 spot)</SelectItem>
                <SelectItem value="ml.g5.12xlarge">4x A10G (96GB) - $5.67/hr ($2.00 spot)</SelectItem>
                <SelectItem value="ml.p3.2xlarge">V100 (16GB) - $3.06/hr ($1.00 spot)</SelectItem>
                <SelectItem value="ml.p4d.24xlarge">8x A100 (320GB) - $32.77/hr ($10.00 spot)</SelectItem>
                <SelectItem value="ml.p5.48xlarge">8x H100 (640GB) - $98.32/hr ($30.00 spot)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2 mt-2">
              <input
                type="checkbox"
                id="sagemaker-spot"
                checked={sagemakerUseSpot}
                onChange={(e) => setSagemakerUseSpot(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="sagemaker-spot" className="text-sm font-medium">
                Use Spot Instances (70% cheaper)
              </Label>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="sagemaker-budget" className="text-sm font-medium">
                Budget Limit (USD)
              </Label>
            </div>
            <Input
              id="sagemaker-budget"
              type="number"
              step="0.01"
              min="0"
              placeholder="5.00"
              value={sagemakerBudget}
              onChange={(e) => setSagemakerBudget(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Training will auto-stop when budget is reached. Spot instances provide 70% cost savings.
            </p>
          </div>

          {/* HuggingFace Spaces Configuration */}
          <div className="space-y-2">
            <Label htmlFor="hf-space-name" className="text-sm font-medium">
              HuggingFace Space Name
            </Label>
            <Input
              id="hf-space-name"
              type="text"
              placeholder="my-training-space"
              value={hfSpaceName}
              onChange={(e) => setHfSpaceName(e.target.value)}
              className="w-full"
            />
            <Label htmlFor="hf-gpu-tier" className="text-sm font-medium mt-2">
              GPU Tier
            </Label>
            <Select value={hfGpuTier} onValueChange={setHfGpuTier}>
              <SelectTrigger id="hf-gpu-tier">
                <SelectValue placeholder="Select GPU Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpu-basic">CPU Basic (Free)</SelectItem>
                <SelectItem value="t4-small">T4 Small - $0.60/hr</SelectItem>
                <SelectItem value="t4-medium">T4 Medium - $1.20/hr</SelectItem>
                <SelectItem value="a10g-small">A10G Small - $3.15/hr</SelectItem>
                <SelectItem value="a10g-large">A10G Large - $4.13/hr</SelectItem>
                <SelectItem value="a100-large">A100 Large - $4.13/hr</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 mt-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="hf-budget" className="text-sm font-medium">
                Budget Limit (USD)
              </Label>
            </div>
            <Input
              id="hf-budget"
              type="number"
              step="0.01"
              min="0"
              placeholder="10.00"
              value={hfBudget}
              onChange={(e) => setHfBudget(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Space will auto-stop at 100% budget (alert at 80%)
            </p>
          </div>

          {/* Google Colab Configuration */}
          <div className="space-y-2">
            <Label htmlFor="colab-notebook-name" className="text-sm font-medium">
              Colab Notebook Name
            </Label>
            <Input
              id="colab-notebook-name"
              type="text"
              placeholder="My Training Notebook"
              value={colabNotebookName}
              onChange={(e) => setColabNotebookName(e.target.value)}
              className="w-full"
            />
            <Label htmlFor="colab-gpu-tier" className="text-sm font-medium mt-2">
              GPU Tier
            </Label>
            <Select value={colabGpuTier} onValueChange={setColabGpuTier}>
              <SelectTrigger id="colab-gpu-tier">
                <SelectValue placeholder="Select GPU Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">CPU Only (Free)</SelectItem>
                <SelectItem value="t4">T4 GPU (Colab Pro - $10/mo)</SelectItem>
                <SelectItem value="a100">A100 GPU (Colab Pro+ - $50/mo)</SelectItem>
                <SelectItem value="v100">V100 GPU (Legacy)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 mt-2">
              <Label htmlFor="colab-budget" className="text-sm font-medium">
                Compute Units Limit
              </Label>
            </div>
            <Input
              id="colab-budget"
              type="number"
              step="10"
              min="0"
              placeholder="100"
              value={colabBudget}
              onChange={(e) => setColabBudget(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Notebook will auto-stop when compute units exhausted
            </p>
          </div>
        </div>

        {/* Deployment Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {deploymentOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => option.available && handleDeploy(option.id)}
              disabled={!option.available || deploying}
              className={`
                relative p-4 rounded-lg border-2 text-left transition-all
                ${selectedTarget === option.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
                }
                ${!option.available
                  ? 'opacity-60 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-muted/50'
                }
                ${deploying && selectedTarget === option.id
                  ? 'ring-2 ring-primary ring-offset-2'
                  : ''
                }
              `}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{option.label}</h3>
                    {option.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {option.badge}
                      </Badge>
                    )}
                    {option.comingSoon && (
                      <Badge variant="outline" className="text-xs">
                        Coming Soon
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                {selectedTarget === option.id && deploying ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
                ) : selectedTarget === option.id && deploymentUrl ? (
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                ) : null}
              </div>
            </button>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Display */}
        {deploymentUrl && (
          <Alert className="bg-primary/5 border-primary/20">
            <Check className="w-4 h-4 text-primary" />
            <AlertDescription className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Deployment successful!</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(deploymentUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open
                </Button>
              </div>
              {deploymentId && (
                <p className="text-xs text-muted-foreground">
                  Deployment ID: <code className="bg-muted px-1 py-0.5 rounded">{deploymentId}</code>
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Info: What happens next */}
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-sm">
            <strong>Cloud Deployment:</strong> Kaggle, RunPod, AWS SageMaker, and HuggingFace Spaces are now available!
            Make sure to add your API credentials in the <strong>Secrets Vault</strong> before deploying.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
