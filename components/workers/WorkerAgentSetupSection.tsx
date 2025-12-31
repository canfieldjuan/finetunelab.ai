/**
 * Worker Agent Setup Section
 * Handles download, API key generation, and setup instructions
 * Date: 2025-12-30
 */

'use client';

import React, { useState, useEffect } from 'react';
import { detectPlatform, getPlatformDownloads, getSetupInstructions } from '@/lib/workers/platform-utils';
import { getPlatformDisplayName, getPlatformIcon } from '@/lib/workers/types';
import type { Platform } from '@/lib/workers/types';
import { Button } from '@/components/ui/button';
import { Download, Key, Copy, Check, AlertCircle, Terminal, Apple, MonitorSmartphone, ExternalLink } from 'lucide-react';

interface WorkerAgentSetupSectionProps {
  sessionToken: string;
  onWorkerRegistered?: () => void;
}

export function WorkerAgentSetupSection({ sessionToken, onWorkerRegistered }: WorkerAgentSetupSectionProps) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [workerApiKey, setWorkerApiKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);

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
          name: `Worker Agent - ${new Date().toLocaleString()}`,
          scopes: ['worker'],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate API key');
      }

      const data = await response.json();
      setWorkerApiKey(data.apiKey.key);
    } catch (err) {
      console.error('[Worker Setup] Error generating API key:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyKey = () => {
    if (workerApiKey) {
      navigator.clipboard.writeText(workerApiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyInstructions = () => {
    if (platform && workerApiKey) {
      const instructions = getSetupInstructions(platform, workerApiKey);
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
    MonitorSmartphone,
  };

  return (
    <div className="space-y-8">
      {/* Download Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Step 1: Download Worker Agent</h3>

        {/* Detected Platform */}
        {platform && detectedDownload && (
          <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary/10 rounded">
                {React.createElement(iconMap[detectedDownload.icon] || Terminal, {
                  className: 'h-5 w-5 text-primary',
                })}
              </div>
              <div>
                <p className="text-sm font-medium">Detected Platform</p>
                <p className="text-xs text-muted-foreground">{getPlatformDisplayName(platform)}</p>
              </div>
            </div>
            <a
              href={detectedDownload.url}
              download={detectedDownload.filename}
              className="inline-block"
            >
              <Button className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Download for {getPlatformDisplayName(platform)}
              </Button>
            </a>
          </div>
        )}

        {/* All Platforms */}
        <div>
          <p className="text-sm font-medium mb-3">All Platforms</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {downloads.map((download) => {
              const Icon = iconMap[download.icon] || Terminal;
              return (
                <a
                  key={download.platform}
                  href={download.url}
                  download={download.filename}
                  className="block"
                >
                  <div className="border border-border rounded-lg p-4 hover:bg-accent transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
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
        <div className="mt-4 pt-4 border-t border-border">
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
      </div>

      {/* API Key Generation */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Step 2: Generate Worker API Key</h3>

        {!workerApiKey ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate a secure API key for your worker agent to authenticate with the platform.
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
                    This is the only time you'll see the full key. Make sure to copy and store it securely.
                  </p>
                </div>
              </div>
            </div>

            {/* API Key Display */}
            <div>
              <label className="block text-sm font-medium mb-2">Your Worker API Key</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded border border-border overflow-x-auto">
                  {workerApiKey}
                </code>
                <Button onClick={handleCopyKey} variant="outline" size="sm" className="flex-shrink-0">
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

            {/* Generate Another Key */}
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">
                Need to setup another worker? Generate a new API key.
              </p>
              <Button onClick={handleGenerateApiKey} disabled={generating} variant="outline">
                <Key className="h-4 w-4 mr-2" />
                {generating ? 'Generating...' : 'Generate New Key'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Setup Instructions */}
      {workerApiKey && platform && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Step 3: Install & Configure</h3>
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
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Run these commands on your {getPlatformDisplayName(platform)} machine:
            </p>

            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono border border-border">
              <code>{getSetupInstructions(platform, workerApiKey)}</code>
            </pre>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                What happens next?
              </p>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>The installer creates a background service</li>
                <li>Your worker will automatically register with this platform</li>
                <li>You'll see it appear in the "My Workers" tab</li>
                <li>The agent will start accepting training jobs</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
