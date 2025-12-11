'use client';

import React from 'react';
import { AlertCircle, DollarSign, Clock, Zap } from 'lucide-react';
import { calculateEstimatedCost, getGPUPricingById } from '@/lib/training/pricing-config';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface CloudDeploymentConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  gpuId: string;
  budgetLimit: number;
  estimatedHours: number;
  estimatedMinutes: number;
  configName: string;
  isDeploying?: boolean;
}

export function CloudDeploymentConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  gpuId,
  budgetLimit,
  estimatedHours,
  estimatedMinutes,
  configName,
  isDeploying = false,
}: CloudDeploymentConfirmationDialogProps) {
  if (!isOpen) return null;

  const gpuTier = getGPUPricingById(gpuId);
  const costEstimate = calculateEstimatedCost(gpuId, estimatedHours, estimatedMinutes);

  if (!gpuTier || !costEstimate) {
    console.error('[CloudDeploymentConfirmationDialog] Failed to load pricing data:', {
      gpuId,
      gpuTier,
      costEstimate
    });
    // Show error dialog instead of silently failing
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={onClose}
          />
          <div className="relative bg-background rounded-lg shadow-xl max-w-md w-full p-6 border">
            <h2 className="text-xl font-semibold text-destructive mb-2">Pricing Error</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Unable to load pricing information for GPU: {gpuId}. Please refresh and try again.
            </p>
            <Button onClick={onClose} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const budgetExceeded = costEstimate.total_cost > budgetLimit;
  const budgetWarning = costEstimate.total_cost > budgetLimit * 0.8 && !budgetExceeded;

  const formatTime = () => {
    if (estimatedHours > 0 && estimatedMinutes > 0) {
      return `${estimatedHours}h ${estimatedMinutes}m`;
    } else if (estimatedHours > 0) {
      return `${estimatedHours}h`;
    } else {
      return `${estimatedMinutes}m`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        <div className="relative bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Confirm Cloud Deployment
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review estimated costs before deploying to FineTune Lab Cloud
            </p>
          </div>

          <div className="px-6 py-4 space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Configuration:</span>
                  <span className="font-medium">{configName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GPU:</span>
                  <span className="font-medium">{gpuTier.name} ({gpuTier.vram_gb}GB)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Budget Limit:</span>
                  <span className="font-medium">${budgetLimit.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="w-4 h-4" />
                  <span>Estimated Training Time</span>
                </div>
                <div className="text-3xl font-bold text-primary">
                  {formatTime()}
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <DollarSign className="w-4 h-4" />
                  <span>Cost Breakdown</span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Cost:</span>
                    <span className="font-mono">
                      ${gpuTier.base_cost_per_hour.toFixed(2)}/hr × {formatTime()} = ${costEstimate.base_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee:</span>
                    <span className="font-mono text-orange-600">
                      ${gpuTier.platform_fee_per_hour.toFixed(2)}/hr × {formatTime()} = ${costEstimate.platform_fee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold text-base">
                    <span>Total Estimated Cost:</span>
                    <span className="font-mono">${costEstimate.total_cost.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {budgetExceeded && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Budget Exceeded!</strong> Estimated cost (${costEstimate.total_cost.toFixed(2)}) exceeds your budget limit (${budgetLimit.toFixed(2)}).
                  Training will auto-stop when budget is reached. Consider increasing your budget or selecting a lower-cost GPU.
                </AlertDescription>
              </Alert>
            )}

            {budgetWarning && !budgetExceeded && (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Budget Warning:</strong> Estimated cost (${costEstimate.total_cost.toFixed(2)}) is close to your budget limit (${budgetLimit.toFixed(2)}).
                  Training may be interrupted if it runs longer than expected.
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                <strong>Important:</strong> This is an estimate based on your configuration.
                Actual costs may vary depending on training performance and dataset complexity.
                Training will auto-stop when your budget limit is reached.
              </AlertDescription>
            </Alert>
          </div>

          <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-end gap-3">
            <Button
              onClick={onClose}
              disabled={isDeploying}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isDeploying}
              className="min-w-[140px]"
            >
              {isDeploying ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Deploying...
                </span>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Deploy Now
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
