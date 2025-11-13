/**
 * Inference Deployment Card Component
 *
 * Displays status and details of a production inference deployment
 * - Shows deployment status and metrics
 * - Displays cost tracking and budget alerts
 * - Provides actions: view status, stop deployment
 * - Shows endpoint URL (copyable)
 *
 * Phase: Phase 5 - UI Components
 * Date: 2025-11-12
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Cloud,
  Copy,
  StopCircle,
  Loader2,
  DollarSign,
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { InferenceDeploymentRecord } from '@/lib/inference/deployment.types';

interface InferenceDeploymentCardProps {
  deployment: InferenceDeploymentRecord;
  onUpdate?: () => void;
}

export function InferenceDeploymentCard({
  deployment,
  onUpdate,
}: InferenceDeploymentCardProps) {
  const { session } = useAuth();
  const [stopping, setStopping] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'deploying':
      case 'scaling':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'stopped':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'deploying':
      case 'scaling':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'stopped':
        return <StopCircle className="h-4 w-4" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getBudgetAlert = () => {
    if (!deployment.budget_limit) return null;

    const percentage = (deployment.current_spend / deployment.budget_limit) * 100;

    if (percentage >= 100) {
      return (
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">Budget Exceeded!</span>
        </div>
      );
    } else if (percentage >= 80) {
      return (
        <div className="flex items-center gap-2 text-orange-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">80% Budget Used</span>
        </div>
      );
    } else if (percentage >= 50) {
      return (
        <div className="flex items-center gap-2 text-yellow-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">50% Budget Used</span>
        </div>
      );
    }

    return null;
  };

  const handleCopyEndpoint = () => {
    if (deployment.endpoint_url) {
      navigator.clipboard.writeText(deployment.endpoint_url);
      toast.success('Endpoint URL copied to clipboard');
    }
  };

  const handleStop = async () => {
    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }

    setStopping(true);

    try {
      const response = await fetch(`/api/inference/deployments/${deployment.id}/stop`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to stop deployment');
      }

      toast.success('Deployment stopped successfully');

      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('[DeploymentCard] Stop error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to stop deployment');
    } finally {
      setStopping(false);
    }
  };

  const budgetPercentage = deployment.budget_limit
    ? (deployment.current_spend / deployment.budget_limit) * 100
    : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{deployment.deployment_name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              {deployment.provider === 'runpod-serverless' ? 'RunPod Serverless' : deployment.provider}
            </CardDescription>
          </div>
          <Badge className={`${getStatusColor(deployment.status)} flex items-center gap-1`}>
            {getStatusIcon(deployment.status)}
            {deployment.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Endpoint URL */}
        {deployment.endpoint_url && (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700">Endpoint URL</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 rounded-md text-sm font-mono truncate">
                {deployment.endpoint_url}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyEndpoint}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-600 mb-1">GPU Type</div>
            <div className="text-sm font-medium">
              {String(deployment.config?.gpu_type || 'A4000')}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Workers</div>
            <div className="text-sm font-medium">
              {Number(deployment.config?.min_workers || 0)} - {Number(deployment.config?.max_workers || 3)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Model Type</div>
            <div className="text-sm font-medium capitalize">
              {deployment.model_type?.replace('-', ' ') || 'LoRA Adapter'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Base Model</div>
            <div className="text-sm font-medium truncate">
              {deployment.base_model?.split('/').pop() || 'Unknown'}
            </div>
          </div>
        </div>

        {/* Cost Tracking */}
        <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Cost Tracking</span>
            </div>
            {getBudgetAlert()}
          </div>

          {/* Budget Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>${deployment.current_spend.toFixed(2)} spent</span>
              <span>${(deployment.budget_limit || 0).toFixed(2)} limit</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${
                  budgetPercentage >= 100
                    ? 'bg-red-600'
                    : budgetPercentage >= 80
                    ? 'bg-orange-500'
                    : budgetPercentage >= 50
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, budgetPercentage)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <div className="text-xs text-gray-600">Requests</div>
              <div className="text-sm font-medium">
                {deployment.request_count.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Cost/Request</div>
              <div className="text-sm font-medium">
                ${deployment.cost_per_request?.toFixed(4) || '0.0000'}
              </div>
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>Created: {new Date(deployment.created_at).toLocaleString()}</div>
          {deployment.deployed_at && (
            <div>Deployed: {new Date(deployment.deployed_at).toLocaleString()}</div>
          )}
          {deployment.stopped_at && (
            <div>Stopped: {new Date(deployment.stopped_at).toLocaleString()}</div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        {deployment.status !== 'stopped' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={stopping}
              >
                {stopping ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <StopCircle className="mr-2 h-4 w-4" />
                    Stop Deployment
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Stop Deployment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will stop the inference endpoint and terminate all workers.
                  You can always redeploy later if needed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleStop}>
                  Stop Deployment
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {deployment.endpoint_url && deployment.status === 'active' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(deployment.endpoint_url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Endpoint
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
