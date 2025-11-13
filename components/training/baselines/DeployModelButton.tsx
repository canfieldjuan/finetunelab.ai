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
import { Rocket, Loader2, CheckCircle, XCircle, Package, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckpointSelector } from './CheckpointSelector';
import type { TrainingCheckpoint } from '@/lib/training/checkpoint.types';

interface DeployModelButtonProps {
  jobId: string;
  modelName?: string;
  status: 'running' | 'completed' | 'failed';
}

type DeploymentStatus = 'idle' | 'deploying' | 'success' | 'error';
type VLLMStatus = 'checking' | 'available' | 'unavailable' | 'error';

export function DeployModelButton({
  jobId,
  modelName,
  status,
}: DeployModelButtonProps) {
  const router = useRouter();
  const { session } = useAuth();

  const [open, setOpen] = useState(false);
  const [serverType, setServerType] = useState<'vllm' | 'ollama'>('vllm');
  const [customName, setCustomName] = useState('');
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // vLLM availability state
  const [vllmStatus, setVllmStatus] = useState<VLLMStatus>('checking');
  const [vllmVersion, setVllmVersion] = useState<string | null>(null);

  // Checkpoint selection state
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<TrainingCheckpoint | null>(null);

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
        
        setVllmStatus(data.available ? 'available' : 'unavailable');
        setVllmVersion(data.version);
      } catch (error) {
        console.error('[DeployButton] vLLM check failed:', error);
        setVllmStatus('error');
        setVllmVersion(null);
      }
    };

    checkVLLMAvailability();
  }, []);

  // Only show button when training is complete
  if (status !== 'completed') {
    return null;
  }

  const handleDeploy = async () => {
    setDeploymentStatus('deploying');
    setErrorMessage('');

    try {
      // Check if user is authenticated
      if (!session?.access_token) {
        throw new Error('You must be logged in to deploy models. Please sign in and try again.');
      }

      console.log('[DeployButton] Starting deployment:', {
        jobId,
        serverType,
        name: customName || modelName,
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
      });

      const response = await fetch('/api/training/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          job_id: jobId,
          server_type: serverType,
          checkpoint_path: selectedCheckpoint?.path, // Include selected checkpoint
          name: customName || modelName || `trained-model-${Date.now()}`,
          config: {
            gpu_memory_utilization: 0.8,
            // Future: Allow user to configure these
          },
        }),
      });

      const data = await response.json();
      
      console.log('[DeployButton] API Response:', {
        status: response.status,
        ok: response.ok,
        data: data,
      });

      if (!response.ok) {
        const errorDetails = data.details || data.error || 'Deployment failed';
        const errorStack = data.stack ? `\n\nStack trace:\n${data.stack}` : '';
        
        console.error('[DeployButton] Deployment failed:', {
          status: response.status,
          error: data.error,
          details: data.details,
          stack: data.stack,
          fullResponse: data,
        });
        
        // Show detailed error in toast for development
        toast.error('Deployment Failed', {
          description: `${errorDetails}${errorStack}`,
          duration: 10000,
        });
        
        throw new Error(errorDetails);
      }

      console.log('[DeployButton] Deployment response:', data);

      if (data.success) {
        setDeploymentStatus('success');
        toast.success('Model deployed successfully!', {
          description: data.message,
        });

        // Wait a moment for user to see success message
        setTimeout(() => {
          // Redirect to models page
          if (data.model_id) {
            router.push(`/models?modelId=${data.model_id}`);
          } else {
            router.push('/models');
          }
        }, 1500);
      } else {
        throw new Error(data.error || 'Unknown deployment error');
      }
    } catch (error) {
      console.error('[DeployButton] Deployment error:', error);

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
        <div className="flex gap-2">
          {/* vLLM Button with availability states */}
          {vllmStatus === 'checking' && (
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
          
          {vllmStatus === 'unavailable' && (
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
          
          {vllmStatus === 'error' && (
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
          
          {vllmStatus === 'available' && (
            <Button
              variant="default"
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={() => {
                setServerType('vllm');
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
              setServerType('ollama');
              setOpen(true);
            }}
          >
            <Package className="mr-2 h-5 w-5" />
            Deploy to Ollama
          </Button>
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Deploy Trained Model</DialogTitle>
          <DialogDescription>
            Deploy your trained model to a local inference server for testing and use.
          </DialogDescription>
        </DialogHeader>

        {/* vLLM Installation Instructions */}
        {vllmStatus === 'unavailable' && deploymentStatus === 'idle' && (
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

        {deploymentStatus === 'idle' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="server-type">Inference Server</Label>
              <Select
                value={serverType}
                onValueChange={(value) => setServerType(value as 'vllm' | 'ollama')}
              >
                <SelectTrigger id="server-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vllm">
                    vLLM (OpenAI-compatible)
                  </SelectItem>
                  <SelectItem value="ollama">
                    Ollama (Local Models)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {serverType === 'vllm' 
                  ? 'vLLM will start on port 8002+ and be accessible at http://localhost:XXXX'
                  : 'Ollama runs on port 11434 and supports multiple models simultaneously'
                }
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

            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Configuration</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• GPU Memory: 80% utilization</li>
                <li>• Port: Auto-allocated (8002-8020)</li>
                <li>• Security: Bound to localhost only</li>
              </ul>
            </div>
          </div>
        )}

        {deploymentStatus === 'deploying' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">
                {serverType === 'vllm' ? 'Deploying Model...' : 'Converting & Deploying...'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {serverType === 'vllm'
                  ? 'Starting vLLM server and loading model'
                  : 'Converting to GGUF format and creating Ollama model'
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {serverType === 'vllm' ? 'This may take 1-2 minutes' : 'This may take 3-5 minutes for conversion'}
              </p>
            </div>
          </div>
        )}

        {deploymentStatus === 'success' && (
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
                !serverType ||
                !selectedCheckpoint ||
                (serverType === 'vllm' && vllmStatus !== 'available')
              }
            >
              <Rocket className="mr-2 h-4 w-4" />
              {!selectedCheckpoint
                ? 'Select Checkpoint'
                : serverType === 'vllm' && vllmStatus === 'checking'
                ? 'Checking vLLM...'
                : serverType === 'vllm' && vllmStatus === 'unavailable'
                ? 'vLLM Required'
                : 'Deploy Model'}
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
