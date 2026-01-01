"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Play, RefreshCw, ArrowRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
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

      // Get session token for authentication
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated. Please log in.');
        return;
      }

      const res = await fetch(`/api/analytics/traces/${trace.id}/replay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label htmlFor="model-name" className="text-xs text-muted-foreground">Model Name</Label>
          <Input
            id="model-name"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
        <div>
          <Label htmlFor="model-provider" className="text-xs text-muted-foreground">Provider</Label>
          <Input
            id="model-provider"
            value={modelProvider}
            onChange={(e) => setModelProvider(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
        <div>
          <Label htmlFor="temperature" className="text-xs text-muted-foreground">Temperature</Label>
          <Input
            id="temperature"
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="h-8 text-sm mt-1"
          />
        </div>
        <div>
          <Label htmlFor="max-tokens" className="text-xs text-muted-foreground">Max Tokens</Label>
          <Input
            id="max-tokens"
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="h-8 text-sm mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="system-prompt" className="text-xs text-muted-foreground">System Prompt</Label>
        <textarea
          id="system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={2}
          className="w-full mt-1 px-3 py-2 border rounded-md text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-input bg-transparent"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="disable-cache"
            checked={disableCache}
            onChange={(e) => setDisableCache(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
          />
          <Label htmlFor="disable-cache" className="text-sm font-normal">Disable Cache</Label>
        </div>

        <Button onClick={replayTrace} disabled={replaying} size="sm" className="w-auto px-6">
          <Play className="h-3.5 w-3.5 mr-2" />
          {replaying ? 'Replaying...' : 'Run Replay'}
        </Button>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          {error}
        </div>
      )}

      {replayResult && (
        <div className="mt-4 border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Replay Results</h3>
            <Badge variant="outline" className="text-[10px] h-5">Success</Badge>
          </div>

          <div className="grid grid-cols-2 divide-x">
            {/* Original Column */}
            <div className="p-3 bg-gray-50/50">
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Original</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium">{replayResult.originalTrace.model_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tokens</span>
                  <span className="font-mono">{replayResult.originalTrace.total_tokens?.toLocaleString() || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost</span>
                  <span className="font-mono">${replayResult.originalTrace.cost_usd?.toFixed(6) || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-mono">{replayResult.originalTrace.duration_ms}ms</span>
                </div>
              </div>
            </div>

            {/* Replay Column */}
            <div className="p-3 bg-white">
              <div className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wider flex items-center gap-1">
                 Replay <ArrowRight className="h-3 w-3" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model</span>
                  <span className="font-medium">{replayResult.replayTrace.model_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tokens</span>
                  <span className={`font-mono ${replayResult.replayTrace.total_tokens < replayResult.originalTrace.total_tokens ? 'text-green-600' : ''}`}>
                    {replayResult.replayTrace.total_tokens?.toLocaleString() || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost</span>
                  <span className={`font-mono ${replayResult.replayTrace.cost_usd < replayResult.originalTrace.cost_usd ? 'text-green-600' : ''}`}>
                    ${replayResult.replayTrace.cost_usd?.toFixed(6) || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className={`font-mono ${replayResult.replayTrace.duration_ms < replayResult.originalTrace.duration_ms ? 'text-green-600' : ''}`}>
                    {replayResult.replayTrace.duration_ms}ms
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
