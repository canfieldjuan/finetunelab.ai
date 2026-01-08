/**
 * Training Agent Setup Component
 * Handles download, API key generation, and setup instructions
 * Date: 2026-01-07
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Download,
  Key,
  Copy,
  Check,
  AlertCircle,
  Terminal,
  Apple,
  Monitor,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  detectPlatform,
  getPlatformDownloads,
  getSetupInstructions,
} from '@/lib/workers/platform-utils';
import { getPlatformDisplayName } from '@/lib/workers/types';
import type { Platform } from '@/lib/workers/types';

interface TrainingAgentSetupProps {
  sessionToken: string;
}

export function TrainingAgentSetup({ sessionToken }: TrainingAgentSetupProps) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const handleGenerateApiKey = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: `Training Agent - ${new Date().toLocaleString()}`,
          scopes: ['training'],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate API key');
      }

      const data = await response.json();
      setApiKey(data.apiKey.key);
      setShowInstructions(true);
    } catch (err) {
      console.error('[Agent Setup] Error generating API key:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyInstructions = () => {
    if (platform && apiKey) {
      const backendUrl = typeof window !== 'undefined'
        ? window.location.origin
        : 'https://app.finetunelab.ai';
      const instructions = getSetupInstructions(platform, apiKey, backendUrl);
      navigator.clipboard.writeText(instructions);
      setCopiedInstructions(true);
      setTimeout(() => setCopiedInstructions(false), 2000);
    }
  };

  const downloads = getPlatformDownloads();
  const detectedDownload = downloads.find((d) => d.platform === platform);

  const iconMap: Record<string, React.ElementType> = {
    Terminal,
    Apple,
    Monitor,
  };

  const backendUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://app.finetunelab.ai';

  return (
    <div className="space-y-6">
      {/* Download Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Step 1: Download Training Agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Detected Platform */}
          {platform && detectedDownload && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">
                Detected platform: <strong>{getPlatformDisplayName(platform)}</strong>
              </p>
              <a href={detectedDownload.url} download>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Download for {getPlatformDisplayName(platform)}
                </Button>
              </a>
            </div>
          )}

          {/* Other Platforms */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">Other platforms:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {downloads.map((download) => {
                if (download.platform === platform) return null;
                const Icon = iconMap[download.icon] || Terminal;
                return (
                  <a key={download.platform} href={download.url} download>
                    <div className="border rounded-lg p-4 hover:bg-accent transition-colors cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{download.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{download.filename}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          {/* GitHub Releases Link */}
          <div className="pt-4 border-t">
            <a
              href="https://github.com/FineTune-Lab/training-agent/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              View all releases on GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* API Key Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Step 2: Generate API Key
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!apiKey ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Generate a secure API key for your training agent to authenticate with the platform.
              </p>

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20 text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button onClick={handleGenerateApiKey} disabled={generating}>
                <Key className="h-4 w-4 mr-2" />
                {generating ? 'Generating...' : 'Generate API Key'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Warning */}
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-900 dark:text-yellow-200 mb-1">
                      Save this key now!
                    </p>
                    <p className="text-yellow-800 dark:text-yellow-300">
                      This is the only time you will see the full key. Store it securely.
                    </p>
                  </div>
                </div>
              </div>

              {/* API Key Display */}
              <div>
                <label className="block text-sm font-medium mb-2">Your API Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded border overflow-x-auto">
                    {apiKey}
                  </code>
                  <Button onClick={handleCopyKey} variant="outline" size="sm">
                    {copiedKey ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Generate New Key */}
              <div className="pt-4 border-t">
                <Button onClick={handleGenerateApiKey} disabled={generating} variant="outline" size="sm">
                  <Key className="h-4 w-4 mr-2" />
                  Generate New Key
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      {apiKey && platform && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Step 3: Install & Run
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button onClick={handleCopyInstructions} variant="outline" size="sm">
                  {copiedInstructions ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Commands
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInstructions(!showInstructions)}
                >
                  {showInstructions ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showInstructions && (
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Run these commands on your {getPlatformDisplayName(platform)} machine:
              </p>

              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono border">
                <code>{getSetupInstructions(platform, apiKey, backendUrl)}</code>
              </pre>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                  What happens next?
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                  <li>The agent will start polling for training jobs</li>
                  <li>You will see it appear in the "Connected Agents" section above</li>
                  <li>When you start a training job, the agent will pick it up automatically</li>
                  <li>Progress and metrics will stream back to the web UI in real-time</li>
                </ul>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
