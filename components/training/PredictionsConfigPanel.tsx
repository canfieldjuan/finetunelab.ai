/**
 * Predictions Configuration Panel
 *
 * Allows users to configure prediction sampling for training jobs.
 * Displays cost estimates to help users make informed decisions.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, DollarSign, AlertTriangle } from 'lucide-react';
import type { PredictionsConfig } from '@/lib/training/types/predictions-types';
import {
  loadPredictionsLimits,
  validatePredictionsConfig,
} from '@/lib/training/predictions-config';
import {
  estimatePredictionsCost,
  formatCost,
} from '@/lib/training/predictions-cost-estimator';

interface PredictionsConfigPanelProps {
  config: Partial<PredictionsConfig>;
  onChange: (config: PredictionsConfig) => void;
  totalEpochs?: number;
  modelName?: string;
  disabled?: boolean;
}

export function PredictionsConfigPanel({
  config,
  onChange,
  totalEpochs = 3,
  modelName,
  disabled = false,
}: PredictionsConfigPanelProps) {
  const limits = useMemo(() => loadPredictionsLimits(), []);
  const [enabled, setEnabled] = useState(config.enabled ?? limits.enabled);
  const [sampleCount, setSampleCount] = useState(
    config.sample_count ?? limits.default_sample_count
  );
  const [frequency, setFrequency] = useState<'epoch' | 'eval' | 'steps'>(
    config.sample_frequency ?? limits.default_frequency
  );

  useEffect(() => {
    const newConfig: Partial<PredictionsConfig> = {
      enabled,
      sample_count: sampleCount,
      sample_frequency: frequency,
    };

    const validation = validatePredictionsConfig(newConfig, limits);
    if (validation.valid && validation.config) {
      onChange(validation.config);
    }
  }, [enabled, sampleCount, frequency, limits, onChange]);

  const costEstimate = estimatePredictionsCost(
    {
      enabled,
      sample_count: sampleCount,
      sample_frequency: frequency,
    },
    totalEpochs,
    modelName
  );

  const isExpensive = costEstimate.estimated_cost_usd > 1.0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Prediction Tracking
          </CardTitle>
          <Switch
            id="predictions-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={disabled}
          />
        </div>
        <CardDescription>
          Track model predictions on sample prompts during training
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {enabled && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sample-count">Sample Count</Label>
                <span className="text-sm text-muted-foreground">
                  {sampleCount}
                </span>
              </div>
              <Slider
                id="sample-count"
                min={1}
                max={limits.max_sample_count}
                step={1}
                value={[sampleCount]}
                onValueChange={(value) => setSampleCount(value[0])}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                {frequency === 'epoch' && 'Number of prompts to evaluate per epoch'}
                {frequency === 'eval' && 'Number of prompts to evaluate per evaluation step'}
                {frequency === 'steps' && 'Number of prompts to evaluate every N training steps'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFrequency('epoch')}
                  disabled={disabled}
                  className={`flex-1 px-3 py-2 text-sm rounded border ${
                    frequency === 'epoch'
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'border-input hover:bg-accent/50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Per Epoch
                </button>
                <button
                  type="button"
                  onClick={() => setFrequency('eval')}
                  disabled={disabled}
                  className={`flex-1 px-3 py-2 text-sm rounded border ${
                    frequency === 'eval'
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'border-input hover:bg-accent/50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Per Eval
                </button>
                <button
                  type="button"
                  onClick={() => setFrequency('steps')}
                  disabled={disabled}
                  className={`flex-1 px-3 py-2 text-sm rounded border ${
                    frequency === 'steps'
                      ? 'bg-accent text-accent-foreground border-accent'
                      : 'border-input hover:bg-accent/50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Per Steps
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {frequency === 'epoch' && 'Predictions generated once per epoch'}
                {frequency === 'eval' && 'Predictions generated at each evaluation (recommended for catching overfitting)'}
                {frequency === 'steps' && 'Predictions generated every N training steps'}
              </p>
            </div>

            <Alert className="bg-muted">
              <DollarSign className="w-4 h-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Cost Estimate</p>
                  <div className="text-sm space-y-1">
                    <p>
                      Total predictions: {costEstimate.total_predictions}
                    </p>
                    <p>
                      Estimated tokens: ~
                      {costEstimate.estimated_tokens.toLocaleString()}
                    </p>
                    <p className="font-semibold">
                      Estimated cost: {formatCost(costEstimate.estimated_cost_usd)}
                    </p>
                    {frequency === 'epoch' && (
                      <p className="text-xs text-muted-foreground">
                        ({formatCost(costEstimate.cost_per_epoch)} per epoch)
                      </p>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {isExpensive && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  High prediction cost detected. Consider reducing sample
                  count to minimize inference expenses.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
