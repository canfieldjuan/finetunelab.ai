/**
 * Cloud Deployment Wizard
 * Purpose: Stepped wizard for cloud training deployment
 * Steps: 1) Choose Platform → 2) Configure → 3) Review Cost → 4) Deploy
 * Date: 2025-11-01
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  ExternalLink,
  AlertCircle,
  DollarSign,
  Zap,
  Cloud,
  Database,
  Globe,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { TimeEstimationCard } from './TimeEstimationCard';
import { DatasetAttachment } from './DatasetAttachment';
import type { TrainingConfig } from '@/lib/training/training-config.types';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

console.log('[CloudDeploymentWizard] Component loaded');

// Platform types (subset of DeploymentTarget - cloud only)
export type CloudPlatform = 'kaggle' | 'huggingface-spaces' | 'runpod';

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

type WizardStep = 'platform' | 'configure' | 'review' | 'deploying' | 'success' | 'error';

interface PlatformOption {
  id: CloudPlatform;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  pricing: string;
}

export function CloudDeploymentWizard({
  configId,
  configName,
  config,
  datasetSize,
  sessionToken,
  linkedDatasets = [],
  loadingDatasets = false,
  onDatasetsChange,
  onDeploySuccess,
}: CloudDeploymentWizardProps) {
  console.log('[CloudDeploymentWizard] Rendered for config:', configName);
  console.log('[CloudDeploymentWizard] Received', linkedDatasets.length, 'linked datasets from parent');

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('platform');
  const [selectedPlatform, setSelectedPlatform] = useState<CloudPlatform | null>(null);

  // Deployment state
  const [deploying, setDeploying] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Configuration states
  const [kaggleTitle, setKaggleTitle] = useState('');
  const [runpodGpu, setRunpodGpu] = useState<string>('RTX_A4000');
  const [runpodBudget, setRunpodBudget] = useState<string>('10.00');
  const [hfSpaceName, setHfSpaceName] = useState('');
  const [hfGpuTier, setHfGpuTier] = useState<string>('t4-small');
  const [hfBudget, setHfBudget] = useState<string>('5.00');

  // Platform options
  const platforms: PlatformOption[] = [
    {
      id: 'kaggle',
      label: 'Kaggle Notebooks',
      description: 'Free T4 GPUs with 30 hours/week limit. Great for learning and experimentation.',
      icon: <Database className="w-6 h-6" />,
      badge: 'Free',
      pricing: '$0/hour - 30 hours/week free',
    },
    {
      id: 'huggingface-spaces',
      label: 'HuggingFace Spaces',
      description: 'Managed GPU infrastructure with excellent model hub integration.',
      icon: <Globe className="w-6 h-6" />,
      badge: 'Popular',
      pricing: '$0.60-4.13/hour depending on GPU tier',
    },
    {
      id: 'runpod',
      label: 'RunPod Serverless',
      description: 'Pay-per-second serverless GPUs with auto-scaling and budget controls.',
      icon: <Cloud className="w-6 h-6" />,
      badge: 'Flexible',
      pricing: '$0.59-5.49/hour with per-second billing',
    },
  ];

  // Handle platform selection
  const handleSelectPlatform = (platform: CloudPlatform) => {
    console.log('[CloudDeploymentWizard] Platform selected:', platform);
    setSelectedPlatform(platform);
    setCurrentStep('configure');
  };

  // Handle back navigation
  const handleBack = () => {
    if (currentStep === 'configure') {
      setCurrentStep('platform');
    } else if (currentStep === 'review') {
      setCurrentStep('configure');
    } else if (currentStep === 'error') {
      setCurrentStep('review');
      setError(null);
    }
  };

  // Handle configuration step completion
  const handleConfigureComplete = () => {
    setCurrentStep('review');
  };

  // Handle deployment
  const handleDeploy = async () => {
    if (!selectedPlatform) return;

    // Validate datasets are attached
    if (linkedDatasets.length === 0) {
      console.error('[CloudDeploymentWizard] Deployment blocked: No datasets attached');
      setError('Please attach at least one dataset before deploying');
      return;
    }

    console.log('[CloudDeploymentWizard] Starting deployment to:', selectedPlatform);
    console.log('[CloudDeploymentWizard] Deploying with', linkedDatasets.length, 'dataset(s)');
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

      if (selectedPlatform === 'kaggle') {
        response = await fetch('/api/training/deploy/kaggle', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            training_config_id: configId,
            notebook_title: kaggleTitle || `${configName}-${Date.now()}`,
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

      } else if (selectedPlatform === 'runpod') {
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
          throw new Error(errorData.error || 'RunPod deployment failed');
        }

        data = await response.json();
        setDeploymentUrl(data.pod_url);
        setDeploymentId(data.pod_id);

      } else if (selectedPlatform === 'huggingface-spaces') {
        response = await fetch('/api/training/deploy/hf-spaces', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            training_config_id: configId,
            space_name: hfSpaceName || `${configName}-${Date.now()}`,
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
      }

      console.log('[CloudDeploymentWizard] Deployment successful:', data);
      setCurrentStep('success');

      // Callback to parent
      if (data && data.deployment_id && deploymentUrl) {
        onDeploySuccess?.(selectedPlatform, data.deployment_id, deploymentUrl);
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

  // Render platform selection step
  const renderPlatformSelection = () => (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Choose Cloud Platform</h3>
        <p className="text-sm text-muted-foreground">
          Select where you want to train your model
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            onClick={() => handleSelectPlatform(platform.id)}
            className="p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-muted/50 text-left transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-primary">
                {platform.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm">{platform.label}</h4>
                  {platform.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {platform.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {platform.description}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <DollarSign className="w-3 h-3" />
                  <span>{platform.pricing}</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {/* Dataset Attachment Section */}
      <div className="space-y-2 pt-4 border-t">
        <h4 className="text-sm font-medium">Training Datasets</h4>
        <p className="text-xs text-muted-foreground mb-2">
          Attach datasets before deploying. You can attach multiple datasets.
        </p>
        <DatasetAttachment
          configId={configId}
          sessionToken={sessionToken}
          onDatasetsChange={onDatasetsChange}
        />
        {linkedDatasets.length === 0 && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Warning: No datasets attached. Training will fail without data.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );

  // Render configuration step
  const renderConfiguration = () => {
    if (!selectedPlatform) return null;

    return (
      <div className="space-y-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Configure {platforms.find(p => p.id === selectedPlatform)?.label}</h3>
          <p className="text-sm text-muted-foreground">
            Set up your deployment parameters
          </p>
        </div>

        {selectedPlatform === 'kaggle' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kaggle-title">Notebook Title</Label>
              <Input
                id="kaggle-title"
                type="text"
                placeholder="My Training Notebook"
                value={kaggleTitle}
                onChange={(e) => setKaggleTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Name for your Kaggle notebook (optional)
              </p>
            </div>

            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                <strong>Free T4 GPU:</strong> 30 hours/week limit. Training will auto-stop after 9 hours per session.
                Make sure to add your Kaggle API credentials in the Secrets Vault.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {selectedPlatform === 'runpod' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="runpod-gpu">GPU Type</Label>
              <Select value={runpodGpu} onValueChange={setRunpodGpu}>
                <SelectTrigger id="runpod-gpu">
                  <SelectValue placeholder="Select GPU" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RTX_A4000">NVIDIA RTX A4000 (16GB) - $0.34/hr</SelectItem>
                  <SelectItem value="RTX_A5000">NVIDIA RTX A5000 (24GB) - $0.49/hr</SelectItem>
                  <SelectItem value="RTX_A6000">NVIDIA RTX A6000 (48GB) - $0.79/hr</SelectItem>
                  <SelectItem value="A100_PCIE">NVIDIA A100 PCIe (40GB) - $1.89/hr</SelectItem>
                  <SelectItem value="A100_SXM">NVIDIA A100 SXM (80GB) - $2.89/hr</SelectItem>
                  <SelectItem value="H100_PCIE">NVIDIA H100 PCIe (80GB) - $4.89/hr</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="runpod-budget">Budget Limit (USD)</Label>
              <Input
                id="runpod-budget"
                type="number"
                step="1.00"
                min="1"
                placeholder="10.00"
                value={runpodBudget}
                onChange={(e) => setRunpodBudget(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Training will auto-stop when budget is reached
              </p>
            </div>

            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                <strong>Serverless Billing:</strong> Pay per second of actual GPU usage. No idle charges.
                Add RunPod API key in Secrets Vault before deploying.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {selectedPlatform === 'huggingface-spaces' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hf-space-name">Space Name</Label>
              <Input
                id="hf-space-name"
                type="text"
                placeholder="my-training-space"
                value={hfSpaceName}
                onChange={(e) => setHfSpaceName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Unique name for your HuggingFace Space (optional)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hf-gpu-tier">GPU Tier</Label>
              <Select value={hfGpuTier} onValueChange={setHfGpuTier}>
                <SelectTrigger id="hf-gpu-tier">
                  <SelectValue placeholder="Select GPU Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpu-basic">CPU Basic (Free) - Testing only</SelectItem>
                  <SelectItem value="t4-small">T4 Small - $0.60/hr</SelectItem>
                  <SelectItem value="t4-medium">T4 Medium - $1.20/hr</SelectItem>
                  <SelectItem value="a10g-small">A10G Small - $3.15/hr</SelectItem>
                  <SelectItem value="a10g-large">A10G Large - $4.13/hr</SelectItem>
                  <SelectItem value="a100-large">A100 Large - $4.13/hr</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hf-budget">Budget Limit (USD)</Label>
              <Input
                id="hf-budget"
                type="number"
                step="1.00"
                min="1"
                placeholder="5.00"
                value={hfBudget}
                onChange={(e) => setHfBudget(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Space will auto-stop at 100% budget (alert at 80%)
              </p>
            </div>

            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                <strong>Managed Infrastructure:</strong> HuggingFace handles all deployment and scaling.
                Add HF token in Secrets Vault before deploying.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button onClick={handleBack} variant="outline" className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleConfigureComplete} className="flex-1">
            Continue to Review
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Render review step with time/cost estimation
  const renderReview = () => {
    if (!selectedPlatform || !config) return null;

    return (
      <div className="space-y-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Review & Deploy</h3>
          <p className="text-sm text-muted-foreground">
            Verify settings and estimated costs before deployment
          </p>
        </div>

        {/* Time & Cost Estimation */}
        <TimeEstimationCard
          config={config}
          datasetSize={datasetSize}
          onBudgetExceeded={(exceeded) => {
            console.log('[CloudDeploymentWizard] Budget exceeded:', exceeded);
          }}
          onRecommendedSettings={(settings) => {
            console.log('[CloudDeploymentWizard] Recommended settings:', settings);
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
              <span className="font-medium">{platforms.find(p => p.id === selectedPlatform)?.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Config:</span>
              <span className="font-medium">{configName}</span>
            </div>

            {selectedPlatform === 'kaggle' && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Notebook:</span>
                <span className="font-medium">{kaggleTitle || 'Auto-generated'}</span>
              </div>
            )}

            {selectedPlatform === 'runpod' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GPU:</span>
                  <span className="font-medium">{runpodGpu}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Budget Limit:</span>
                  <span className="font-medium">${runpodBudget}</span>
                </div>
              </>
            )}

            {selectedPlatform === 'huggingface-spaces' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Space:</span>
                  <span className="font-medium">{hfSpaceName || 'Auto-generated'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GPU Tier:</span>
                  <span className="font-medium">{hfGpuTier}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Budget Limit:</span>
                  <span className="font-medium">${hfBudget}</span>
                </div>
              </>
            )}
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
        <h3 className="text-lg font-semibold">Deploying to {platforms.find(p => p.id === selectedPlatform)?.label}...</h3>
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
          Your training job has been submitted to {platforms.find(p => p.id === selectedPlatform)?.label}
        </p>
      </div>

      {deploymentUrl && (
        <Button
          onClick={() => window.open(deploymentUrl, '_blank')}
          variant="default"
          size="lg"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Training Dashboard
        </Button>
      )}

      {deploymentId && (
        <p className="text-xs text-muted-foreground">
          Deployment ID: <code className="bg-muted px-2 py-1 rounded">{deploymentId}</code>
        </p>
      )}

      <Button
        onClick={() => {
          setCurrentStep('platform');
          setSelectedPlatform(null);
          setDeploymentUrl(null);
          setDeploymentId(null);
        }}
        variant="outline"
        className="mt-4"
      >
        Deploy Another Job
      </Button>
    </div>
  );

  // Render error state
  const renderError = () => (
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

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      {currentStep !== 'deploying' && currentStep !== 'success' && currentStep !== 'error' && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`flex items-center gap-2 ${currentStep === 'platform' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'platform' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
              1
            </div>
            <span className="text-sm font-medium">Platform</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${currentStep === 'configure' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'configure' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
              2
            </div>
            <span className="text-sm font-medium">Configure</span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${currentStep === 'review' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'review' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
              3
            </div>
            <span className="text-sm font-medium">Review & Deploy</span>
          </div>
        </div>
      )}

      {/* Wizard content */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 'platform' && renderPlatformSelection()}
          {currentStep === 'configure' && renderConfiguration()}
          {currentStep === 'review' && renderReview()}
          {currentStep === 'deploying' && renderDeploying()}
          {currentStep === 'success' && renderSuccess()}
          {currentStep === 'error' && renderError()}
        </CardContent>
      </Card>
    </div>
  );
}

console.log('[CloudDeploymentWizard] Component defined');
