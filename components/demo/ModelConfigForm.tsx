'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Clock,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  PROVIDER_PRESETS,
  type ModelProvider,
  type ConfigureModelResponse,
  type TestConnectionResponse,
} from '@/lib/demo/types';

interface ModelConfigFormProps {
  onConfigured: (session: ConfigureModelResponse) => void;
  onCancel?: () => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

export function ModelConfigForm({ onConfigured, onCancel }: ModelConfigFormProps) {
  // Form state
  const [provider, setProvider] = useState<ModelProvider | 'custom'>('custom');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [modelName, setModelName] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionLatency, setConnectionLatency] = useState<number | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle provider preset selection
  const handleProviderChange = (value: string) => {
    setProvider(value as ModelProvider | 'custom');
    setConnectionStatus('idle');
    setConnectionError(null);

    if (value !== 'custom') {
      const preset = PROVIDER_PRESETS.find(p => p.provider === value);
      if (preset) {
        setEndpointUrl(preset.base_url);
        setModelId(preset.example_model_id);
      }
    }
  };

  // Create session
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/demo/v2/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint_url: endpointUrl,
          api_key: apiKey,
          model_id: modelId,
          model_name: modelName || modelId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create session');
        return;
      }

      setSessionId(data.session_id);
      // Don't call onConfigured yet - wait for connection test
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!sessionId) return;

    setConnectionStatus('testing');
    setConnectionError(null);

    try {
      const response = await fetch('/api/demo/v2/configure/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const data: TestConnectionResponse = await response.json();

      if (data.success) {
        setConnectionStatus('success');
        setConnectionLatency(data.latency_ms || null);
      } else {
        setConnectionStatus('error');
        setConnectionError(data.error || 'Connection failed');
      }
    } catch (err) {
      setConnectionStatus('error');
      setConnectionError('Network error during test');
    }
  };

  // Continue to batch testing
  const handleContinue = () => {
    if (sessionId) {
      onConfigured({
        session_id: sessionId,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        model_id: modelId,
        model_name: modelName || modelId,
      });
    }
  };

  // Delete session and reset
  const handleReset = async () => {
    if (sessionId) {
      try {
        await fetch(`/api/demo/v2/configure?session_id=${sessionId}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore errors on cleanup
      }
    }

    setSessionId(null);
    setConnectionStatus('idle');
    setConnectionLatency(null);
    setConnectionError(null);
  };

  const selectedPreset = PROVIDER_PRESETS.find(p => p.provider === provider);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Connect Your Model
        </CardTitle>
        <CardDescription>
          Enter your model&apos;s API endpoint and credentials. Supports any OpenAI-compatible API.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Security Notice */}
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-green-800 dark:text-green-200">Your credentials are secure</p>
              <ul className="mt-1 text-green-700 dark:text-green-300 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  API key encrypted with AES-256
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Auto-deleted after 1 hour
                </li>
                <li className="flex items-center gap-2">
                  <Trash2 className="h-3 w-3" />
                  Never logged or stored in plain text
                </li>
              </ul>
            </div>
          </div>
        </div>

        {!sessionId ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider (Optional)</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider or use custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Endpoint</SelectItem>
                  {PROVIDER_PRESETS.map(preset => (
                    <SelectItem key={preset.provider} value={preset.provider}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPreset && (
                <a
                  href={selectedPreset.docs_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  {selectedPreset.name} Documentation
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* Endpoint URL */}
            <div className="space-y-2">
              <Label htmlFor="endpoint_url">API Endpoint URL *</Label>
              <Input
                id="endpoint_url"
                type="url"
                placeholder="https://api.example.com/v1/chat/completions"
                value={endpointUrl}
                onChange={e => setEndpointUrl(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be an OpenAI-compatible chat completions endpoint
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key *</Label>
              <Input
                id="api_key"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                required
              />
            </div>

            {/* Model ID */}
            <div className="space-y-2">
              <Label htmlFor="model_id">Model ID *</Label>
              <Input
                id="model_id"
                type="text"
                placeholder="meta-llama/Llama-2-7b-chat-hf"
                value={modelId}
                onChange={e => setModelId(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The model identifier as expected by your provider
              </p>
            </div>

            {/* Model Name (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="model_name">Display Name (Optional)</Label>
              <Input
                id="model_name"
                type="text"
                placeholder="My Fine-tuned Model"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Session...
                  </>
                ) : (
                  'Create Session'
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* Session Created - Test Connection */
          <div className="space-y-6">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Session Created</span>
                <Badge variant="outline">{sessionId.slice(0, 20)}...</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Endpoint: {endpointUrl}</p>
                <p>Model: {modelName || modelId}</p>
              </div>
            </div>

            {/* Connection Test */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Connection Test</span>
                {connectionStatus === 'success' && (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected ({connectionLatency}ms)
                  </Badge>
                )}
                {connectionStatus === 'error' && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed
                  </Badge>
                )}
              </div>

              {connectionStatus === 'idle' && (
                <Button onClick={handleTestConnection} className="w-full">
                  Test Connection
                </Button>
              )}

              {connectionStatus === 'testing' && (
                <Button disabled className="w-full">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing Connection...
                </Button>
              )}

              {connectionStatus === 'error' && (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {connectionError}
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleReset} className="flex-1">
                      Start Over
                    </Button>
                    <Button onClick={handleTestConnection} className="flex-1">
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {connectionStatus === 'success' && (
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleReset}>
                    Change Model
                  </Button>
                  <Button onClick={handleContinue} className="flex-1">
                    Continue to Batch Test
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ModelConfigForm;
