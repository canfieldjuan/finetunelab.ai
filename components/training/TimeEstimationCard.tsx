/**
 * Time Estimation Card
 * Displays training time estimates, cost predictions, and budget warnings
 * Date: 2025-10-31
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Zap,
  Settings,
  Info,
  Check,
  Database,
  ChevronDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GPU_PRICING_TIERS } from '@/lib/training/pricing-config';
import type { TrainingConfig } from '@/lib/training/training-config.types';
import {
  estimateTrainingTime,
  checkBudgetExceeded,
  formatTimeEstimate,
  recommendGPU,
  GPU_BENCHMARKS,
  type TimeEstimation,
  type BudgetLimit,
} from '@/lib/training/time-estimation';

interface TimeEstimationCardProps {
  config: TrainingConfig;
  datasetSize?: number;
  onBudgetExceeded?: (exceeded: boolean) => void;
  onRecommendedSettings?: (settings: TimeEstimation['recommended_settings']) => void;
  onGpuChange?: (gpuId: string) => void;
  /** When true, hides GPU selector and shows read-only estimation */
  readOnly?: boolean;
  /** GPU type to use for estimation (required when readOnly=true) */
  selectedGpu?: string;
}

export function TimeEstimationCard({
  config,
  datasetSize,
  onBudgetExceeded,
  onRecommendedSettings,
  onGpuChange,
  readOnly = false,
  selectedGpu,
}: TimeEstimationCardProps) {
  const [gpuType, setGpuType] = useState<string>(selectedGpu || 'RTX_A4000');
  const [estimation, setEstimation] = useState<TimeEstimation | null>(null);
  const [budgetLimit, setBudgetLimit] = useState<BudgetLimit>({
    max_hours: undefined,
    max_cost: undefined,
    warn_at_percent: 80,
    auto_stop: false,
  });
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);

  // Handle GPU selection change
  const handleGpuSelect = (gpuId: string) => {
    setGpuType(gpuId);
    onGpuChange?.(gpuId);
  };

  // Sync GPU type when selectedGpu prop changes (for readOnly mode)
  useEffect(() => {
    if (selectedGpu && selectedGpu !== gpuType) {
      setGpuType(selectedGpu);
    }
  }, [selectedGpu]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of initial GPU selection (only when not readOnly)
  useEffect(() => {
    if (!readOnly) {
      onGpuChange?.(gpuType);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate estimation whenever config or GPU changes
  useEffect(() => {
    const est = estimateTrainingTime(config, gpuType, datasetSize);
    setEstimation(est);

    // Check budget
    if (budgetLimit.max_hours || budgetLimit.max_cost) {
      const budgetCheck = checkBudgetExceeded(est, budgetLimit);
      onBudgetExceeded?.(budgetCheck.exceeded);
    }
  }, [config, gpuType, datasetSize, budgetLimit, onBudgetExceeded]);

  if (!estimation) {
    return null;
  }

  const budgetCheck = (budgetLimit.max_hours || budgetLimit.max_cost)
    ? checkBudgetExceeded(estimation, budgetLimit)
    : null;

  const gpuRecommendation = recommendGPU(config.model.name, budgetLimit.max_cost);

  // Get selected GPU info for read-only display
  const selectedGpuTier = GPU_PRICING_TIERS.find(t => t.id === gpuType);

  return (
    <div className="space-y-6">
      {/* Choose GPU Section - Only shown when NOT readOnly */}
      {!readOnly && (
        <>
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Database className="w-4 h-4" />
              Choose GPU
            </h3>
            <p className="text-sm text-muted-foreground">
              Select a GPU configuration for your training job
            </p>
          </div>

          {/* GPU Selection Cards */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {GPU_PRICING_TIERS.map((tier) => {
                const isSelected = gpuType === tier.id;
                return (
                  <Card
                    key={tier.id}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-primary border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => handleGpuSelect(tier.id)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-semibold text-sm">{tier.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Database className="h-3 w-3" />
                            <span>{tier.vram_gb}GB VRAM</span>
                            <Badge variant="outline" className="text-xs">
                              {tier.speed_rating}
                            </Badge>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {tier.recommended_for}
                      </p>

                      <div className="pt-2 border-t space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Base Cost:</span>
                          <span className="font-mono">${tier.base_cost_per_hour.toFixed(2)}/hr</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Platform Fee:</span>
                          <span className="font-mono text-orange-600">+${tier.platform_fee_per_hour.toFixed(2)}/hr</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                          <span>Total:</span>
                          <span className="font-mono">${tier.total_cost_per_hour.toFixed(2)}/hr</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {gpuRecommendation && gpuType !== gpuRecommendation.recommended && (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Recommended: <strong>{GPU_BENCHMARKS[gpuRecommendation.recommended]?.name}</strong>
                  {' '}({gpuRecommendation.reason})
                </AlertDescription>
              </Alert>
            )}
          </div>
        </>
      )}

      {/* Read-only GPU display - shown when readOnly=true */}
      {readOnly && selectedGpuTier && (
        <div className="p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Selected GPU</div>
              <div className="font-semibold">{selectedGpuTier.name}</div>
              <div className="text-xs text-muted-foreground">{selectedGpuTier.vram_gb}GB VRAM</div>
            </div>
            <div className="text-right">
              <div className="font-mono font-semibold">${selectedGpuTier.total_cost_per_hour.toFixed(2)}/hr</div>
            </div>
          </div>
        </div>
      )}

      {/* Time & Cost Estimation Section */}
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold mb-3">
            <Clock className="w-4 h-4" />
            Time & Cost Estimation
          </h3>
        </div>

        {/* Time Estimate */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              Duration
            </div>
            <div className="text-2xl font-bold">
              {formatTimeEstimate(estimation)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {estimation.total_steps.toLocaleString()} steps
            </div>
          </div>

          {estimation.estimated_cost !== undefined && (
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                Cost
              </div>
              <div className="text-2xl font-bold">
                ${estimation.estimated_cost.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                ${GPU_BENCHMARKS[gpuType.toLowerCase()]?.cost_per_hour?.toFixed(2)}/hr
              </div>
            </div>
          )}
        </div>

        {/* GPU Utilization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-4 h-4" />
              GPU Utilization
            </span>
            <span className="font-medium">{estimation.gpu_utilization}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                estimation.gpu_utilization >= 80 ? 'bg-green-500' :
                estimation.gpu_utilization >= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${estimation.gpu_utilization}%` }}
            />
          </div>
        </div>

        {/* VRAM Check */}
        <div className="flex items-center gap-2 p-3 border rounded-lg text-sm">
          {estimation.can_fit_in_vram ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="font-medium text-green-600">VRAM: OK</span>
              <span className="text-muted-foreground">- Model fits in {GPU_BENCHMARKS[gpuType.toLowerCase()]?.vram_gb || '?'}GB VRAM</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-medium text-red-500">VRAM: Insufficient</span>
              <span className="text-muted-foreground">- May not fit in {GPU_BENCHMARKS[gpuType.toLowerCase()]?.vram_gb || '?'}GB VRAM</span>
            </>
          )}
        </div>

        {/* Warnings */}
        {estimation.warnings.length > 0 && (
          <Alert variant={estimation.can_fit_in_vram ? "default" : "destructive"}>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-1">
                {estimation.warnings.map((warning, idx) => (
                  <div key={idx}>{warning}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Budget Check */}
        {budgetCheck && budgetCheck.warnings.length > 0 && (
          <Alert variant={budgetCheck.exceeded ? "destructive" : "default"}>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-1">
                {budgetCheck.warnings.map((warning, idx) => (
                  <div key={idx}>{warning}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Recommended Settings - Only shown when NOT readOnly */}
        {!readOnly && estimation.recommended_settings && (
          <Alert>
            <TrendingUp className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">Recommended Optimizations:</div>
                {estimation.recommended_settings.use_lora && (
                  <div>• Enable LoRA (reduces VRAM by 75%)</div>
                )}
                {estimation.recommended_settings.batch_size && (
                  <div>• Reduce batch size to {estimation.recommended_settings.batch_size}</div>
                )}
                {estimation.recommended_settings.gradient_accumulation_steps && (
                  <div>• Increase gradient accumulation to {estimation.recommended_settings.gradient_accumulation_steps}</div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRecommendedSettings?.(estimation.recommended_settings)}
                  className="mt-2"
                >
                  Apply Recommendations
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Budget Settings Toggle - Only shown when NOT readOnly */}
        {!readOnly && (
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBudgetSettings(!showBudgetSettings)}
              className="w-full justify-between"
            >
              <span className="flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                {showBudgetSettings ? 'Hide' : 'Set'} Budget Limits
              </span>
              <ChevronDown className="w-4 h-4 text-black" />
            </Button>

            {showBudgetSettings && (
              <div className="mt-4 space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <Label htmlFor="max-hours">Maximum Hours</Label>
                  <Input
                    id="max-hours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={budgetLimit.max_hours || ''}
                    onChange={(e) => setBudgetLimit({
                      ...budgetLimit,
                      max_hours: e.target.value ? parseFloat(e.target.value) : undefined,
                    })}
                    placeholder="No limit"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-cost">Maximum Cost ($)</Label>
                  <Input
                    id="max-cost"
                    type="number"
                    min="0"
                    step="1"
                    value={budgetLimit.max_cost || ''}
                    onChange={(e) => setBudgetLimit({
                      ...budgetLimit,
                      max_cost: e.target.value ? parseFloat(e.target.value) : undefined,
                    })}
                    placeholder="No limit"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warn-percent">Warn at % of budget</Label>
                  <Input
                    id="warn-percent"
                    type="number"
                    min="0"
                    max="100"
                    value={budgetLimit.warn_at_percent || 80}
                    onChange={(e) => setBudgetLimit({
                      ...budgetLimit,
                      warn_at_percent: parseInt(e.target.value) || 80,
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-stop" className="cursor-pointer">
                    Auto-stop when budget reached
                  </Label>
                  <Switch
                    id="auto-stop"
                    checked={budgetLimit.auto_stop || false}
                    onCheckedChange={(checked) => setBudgetLimit({
                      ...budgetLimit,
                      auto_stop: checked,
                    })}
                  />
                </div>
              </div>
            )}
          </div>
        )}

      {/* Training Stats Summary */}
      <div className="pt-4 border-t grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Effective Batch Size</div>
          <div className="font-medium">{estimation.effective_batch_size}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Tokens Processed</div>
          <div className="font-medium">{(estimation.tokens_processed / 1_000_000).toFixed(1)}M</div>
        </div>
      </div>
    </div>
  );
}

console.log('[TimeEstimationCard] Component loaded');
