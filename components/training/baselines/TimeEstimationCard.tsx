/**
 * Time Estimation Card
 * Displays training time estimates, cost predictions, and budget warnings
 * Date: 2025-10-31
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Info
} from 'lucide-react';
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
}

export function TimeEstimationCard({
  config,
  datasetSize,
  onBudgetExceeded,
  onRecommendedSettings,
}: TimeEstimationCardProps) {
  const [gpuType, setGpuType] = useState<string>('rtx4060ti');
  const [estimation, setEstimation] = useState<TimeEstimation | null>(null);
  const [budgetLimit, setBudgetLimit] = useState<BudgetLimit>({
    max_hours: undefined,
    max_cost: undefined,
    warn_at_percent: 80,
    auto_stop: false,
  });
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Time & Cost Estimation
        </CardTitle>
        <CardDescription>
          Estimated training duration and resource usage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* GPU Selection */}
        <div className="space-y-2">
          <Label htmlFor="gpu-select">Target GPU</Label>
          <select
            id="gpu-select"
            value={gpuType}
            onChange={(e) => setGpuType(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background"
          >
            <optgroup label="Local GPUs">
              <option value="rtx4060ti">RTX 4060 Ti (16GB) - Local</option>
              <option value="rtx4090">RTX 4090 (24GB) - Local</option>
              <option value="rtx3090">RTX 3090 (24GB) - Local</option>
            </optgroup>
            <optgroup label="Cloud GPUs">
              <option value="t4">T4 (16GB) - $0.53/hr</option>
              <option value="l4">L4 (24GB) - $0.80/hr</option>
              <option value="a100-40gb">A100 40GB - $2.21/hr</option>
              <option value="a100-80gb">A100 80GB - $2.89/hr</option>
              <option value="h100">H100 (80GB) - $4.50/hr</option>
            </optgroup>
          </select>
          
          {gpuRecommendation && gpuType !== gpuRecommendation.recommended && (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                💡 Recommended: <strong>{GPU_BENCHMARKS[gpuRecommendation.recommended]?.name}</strong>
                {' '}({gpuRecommendation.reason})
              </AlertDescription>
            </Alert>
          )}
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
                {GPU_BENCHMARKS[gpuType]?.cost_per_hour?.toFixed(2)}/hr
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
        <div className="flex items-center gap-2 p-3 border rounded-lg">
          {estimation.can_fit_in_vram ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium">VRAM: OK</div>
                <div className="text-muted-foreground">
                  Model fits in {GPU_BENCHMARKS[gpuType]?.vram_gb}GB VRAM
                </div>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-red-500">VRAM: Insufficient</div>
                <div className="text-muted-foreground">
                  May not fit in {GPU_BENCHMARKS[gpuType]?.vram_gb}GB VRAM
                </div>
              </div>
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

        {/* Recommended Settings */}
        {estimation.recommended_settings && (
          <Alert>
            <TrendingUp className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">💡 Recommended Optimizations:</div>
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

        {/* Budget Settings Toggle */}
        <div className="pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBudgetSettings(!showBudgetSettings)}
            className="w-full justify-start"
          >
            <Settings className="w-4 h-4 mr-2" />
            {showBudgetSettings ? 'Hide' : 'Set'} Budget Limits
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
      </CardContent>
    </Card>
  );
}

console.log('[TimeEstimationCard] Component loaded');
