"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Play, RefreshCw, ArrowRight } from 'lucide-react';
import type { Trace } from './TraceView';

interface TraceReplayPanelProps {
  trace: Trace;
}

export function TraceReplayPanel({ trace }: TraceReplayPanelProps) {
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const inputData = trace.input_data as Record<string, any> || {};
  const originalParams = inputData.parameters as Record<string, any> || {};

  const [modelName, setModelName] = useState(trace.model_name || '');
  const [modelProvider, setModelProvider] = useState(trace.model_provider || '');
  const [temperature, setTemperature] = useState(originalParams.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(originalParams.maxTokens ?? 1000);
  const [systemPrompt, setSystemPrompt] = useState(inputData.systemPrompt || '');
  const [disableCache, setDisableCache] = useState(false);

  async function replayTrace() {
    setError(null);
    setReplaying(true);

    try {
      const overrides: Record<string, any> = {};

      if (modelName !== trace.model_name) overrides.modelName = modelName;
      if (modelProvider !== trace.model_provider) overrides.modelProvider = modelProvider;
      if (temperature !== originalParams.temperature) overrides.temperature = temperature;
      if (maxTokens !== originalParams.maxTokens) overrides.maxTokens = maxTokens;
      if (systemPrompt !== inputData.systemPrompt) overrides.systemPrompt = systemPrompt;
      if (disableCache) overrides.disableCache = true;

      const res = await fetch(`/api/analytics/traces/${trace.id}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to replay trace');
        return;
      }

      setReplayResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replay trace');
    } finally {
      setReplaying(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trace Replay</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="model-name">Model Name</Label>
            <Input
              id="model-name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="mt-1"
            />
            {modelName !== trace.model_name && (
              <Badge variant="outline" className="mt-1 text-xs">Modified</Badge>
            )}
          </div>
          <div>
            <Label htmlFor="model-provider">Model Provider</Label>
            <Input
              id="model-provider"
              value={modelProvider}
              onChange={(e) => setModelProvider(e.target.value)}
              className="mt-1"
            />
            {modelProvider !== trace.model_provider && (
              <Badge variant="outline" className="mt-1 text-xs">Modified</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="temperature">Temperature</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="mt-1"
            />
            {temperature !== originalParams.temperature && (
              <Badge variant="outline" className="mt-1 text-xs">Modified</Badge>
            )}
          </div>
          <div>
            <Label htmlFor="max-tokens">Max Tokens</Label>
            <Input
              id="max-tokens"
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="mt-1"
            />
            {maxTokens !== originalParams.maxTokens && (
              <Badge variant="outline" className="mt-1 text-xs">Modified</Badge>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="system-prompt">System Prompt</Label>
          <textarea
            id="system-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            className="w-full mt-1 px-3 py-2 border rounded-md"
          />
          {systemPrompt !== inputData.systemPrompt && (
            <Badge variant="outline" className="mt-1 text-xs">Modified</Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="disable-cache"
            checked={disableCache}
            onChange={(e) => setDisableCache(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="disable-cache">Disable Cache</Label>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button onClick={replayTrace} disabled={replaying} className="w-full">
          <Play className="h-4 w-4 mr-2" />
          {replaying ? 'Replaying...' : 'Replay Trace'}
        </Button>

        {replayResult && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Comparison Results</h3>
              <Badge variant="outline">Replay Complete</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Original Trace</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model:</span>
                    <span>{replayResult.originalTrace.model_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider:</span>
                    <span>{replayResult.originalTrace.model_provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input Tokens:</span>
                    <span>{replayResult.originalTrace.input_tokens || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Output Tokens:</span>
                    <span>{replayResult.originalTrace.output_tokens || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost:</span>
                    <span>${replayResult.originalTrace.cost_usd || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{replayResult.originalTrace.duration_ms || 'N/A'}ms</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-semibold">Replay Trace</h4>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model:</span>
                    <span>{replayResult.replayTrace.model_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider:</span>
                    <span>{replayResult.replayTrace.model_provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input Tokens:</span>
                    <span>{replayResult.replayTrace.input_tokens || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Output Tokens:</span>
                    <span>{replayResult.replayTrace.output_tokens || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost:</span>
                    <span>${replayResult.replayTrace.cost_usd || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{replayResult.replayTrace.duration_ms || 'N/A'}ms</span>
                  </div>
                </div>
              </div>
            </div>

            {replayResult.overridesApplied && Object.keys(replayResult.overridesApplied).length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">Overrides Applied</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(replayResult.overridesApplied).map(([key, value]) => (
                    <Badge key={key} variant="secondary">
                      {key}: {String(value)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
