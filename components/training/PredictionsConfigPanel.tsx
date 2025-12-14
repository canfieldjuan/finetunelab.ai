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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, DollarSign, AlertTriangle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [jsonParse, setJsonParse] = useState<boolean>(
    config.validators?.json_parse ?? false
  );
  const [jsonSchemaText, setJsonSchemaText] = useState<string>(() => {
    const schema = config.validators?.json_schema;
    if (schema == null) return '';
    if (typeof schema === 'string') return schema;
    try {
      return JSON.stringify(schema, null, 2);
    } catch {
      return '';
    }
  });
  const [schemaParseError, setSchemaParseError] = useState<string | null>(null);
  const [showSchemaHelp, setShowSchemaHelp] = useState(false);

  useEffect(() => {
    const trimmedSchemaText = jsonSchemaText.trim();
    const effectiveJsonParse = jsonParse || trimmedSchemaText.length > 0;

    const newConfig: Partial<PredictionsConfig> = {
      enabled,
      sample_count: sampleCount,
      sample_frequency: frequency,
    };

    if (effectiveJsonParse) {
      const validators: NonNullable<PredictionsConfig['validators']> = {
        json_parse: effectiveJsonParse,
      };

      if (trimmedSchemaText.length > 0) {
        try {
          validators.json_schema = JSON.parse(trimmedSchemaText);
          setSchemaParseError(null);
        } catch (e) {
          setSchemaParseError(
            e instanceof Error
              ? e.message
              : 'Invalid JSON schema'
          );
        }
      } else {
        setSchemaParseError(null);
      }

      newConfig.validators = validators;
    }

    const validation = validatePredictionsConfig(newConfig, limits);
    if (validation.valid && validation.config) {
      onChange(validation.config);
    }
  }, [enabled, sampleCount, frequency, jsonParse, jsonSchemaText, limits, onChange]);

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

            <div className="space-y-3 pt-2 border-t">
              <div className="space-y-1 pt-2">
                <Label className="text-sm font-medium">Output Validators (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically validate each prediction output. Useful when training models to produce structured data.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="predictions-json-parse" className="text-sm">
                    Require valid JSON output
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable this if your model should output JSON. Each prediction will be marked pass/fail.
                  </p>
                </div>
                <Switch
                  id="predictions-json-parse"
                  checked={jsonParse}
                  onCheckedChange={setJsonParse}
                  disabled={disabled}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="predictions-json-schema" className="text-sm">
                    JSON Schema Validation (Advanced)
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowSchemaHelp(!showSchemaHelp)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    {showSchemaHelp ? 'Hide help' : 'What is this?'}
                    {showSchemaHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {showSchemaHelp && (
                  <div className="p-3 bg-muted/50 rounded-lg space-y-3 text-sm">
                    <p>
                      <strong>JSON Schema</strong> validates that your model outputs match a specific structure.
                      This is useful when training models for:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>Function calling</strong> - ensure output has <code className="bg-background px-1 rounded">function</code> and <code className="bg-background px-1 rounded">args</code> keys</li>
                      <li><strong>Classification</strong> - validate <code className="bg-background px-1 rounded">label</code> is one of allowed values</li>
                      <li><strong>Data extraction</strong> - ensure all required fields are present</li>
                    </ul>
                    <div className="pt-2">
                      <p className="font-medium mb-1">Example: Function calling schema</p>
                      <pre className="bg-background p-2 rounded text-xs overflow-x-auto">{`{
  "type": "object",
  "properties": {
    "function": { "type": "string" },
    "args": { "type": "object" }
  },
  "required": ["function", "args"]
}`}</pre>
                    </div>
                    <div className="pt-2">
                      <p className="font-medium mb-1">Example: Classification schema</p>
                      <pre className="bg-background p-2 rounded text-xs overflow-x-auto">{`{
  "type": "object",
  "properties": {
    "label": { "enum": ["positive", "negative", "neutral"] },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
  },
  "required": ["label"]
}`}</pre>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Learn more at{' '}
                      <a href="https://json-schema.org/learn/getting-started-step-by-step" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        json-schema.org
                      </a>
                    </p>
                  </div>
                )}

                <Textarea
                  id="predictions-json-schema"
                  value={jsonSchemaText}
                  onChange={(e) => setJsonSchemaText(e.target.value)}
                  placeholder='Paste your JSON Schema here (optional)'
                  className="font-mono text-sm"
                  rows={4}
                  disabled={disabled}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to skip schema validation. Setting a schema automatically enables JSON parsing.
                </p>
                {schemaParseError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Invalid JSON Schema: {schemaParseError}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
