// Package Generator Component
// Purpose: Generate and display shareable training package
// Date: 2025-10-16

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, Copy, CheckCircle, Loader2, ExternalLink, Database, AlertTriangle, ShieldOff, RefreshCw, X } from 'lucide-react';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';
import { isFormatCompatible, type TrainingMethod } from '@/lib/training/format-validator';

interface PackageGeneratorProps {
  configId: string;
  configName: string;
  sessionToken?: string;
  variant?: 'card' | 'content'; // NEW: Allows rendering without Card wrapper
}

export function PackageGenerator({ configId, configName, sessionToken, variant = 'card' }: PackageGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [gistUrls, setGistUrls] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedDatasets, setLinkedDatasets] = useState<TrainingDatasetRecord[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [allDatasets, setAllDatasets] = useState<TrainingDatasetRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [attaching, setAttaching] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);

  useEffect(() => {
    fetchLinkedDatasets();
    fetchAllDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId]); // configId is stable, sessionToken changes are intentionally ignored

  const fetchLinkedDatasets = async () => {
    console.log('[PackageGenerator] Fetching linked datasets for config:', configId);
    console.log('[PackageGenerator] Using sessionToken:', sessionToken ? 'present' : 'missing');
    setLoadingDatasets(true);

    try {
      const response = await fetch('/api/training/dataset', {
        headers: sessionToken ? {
          'Authorization': `Bearer ${sessionToken}`,
        } : {},
      });

      if (!response.ok) {
        throw new Error('Failed to fetch datasets');
      }

      const data = await response.json();
      const linked = (data.datasets || []).filter(
        (d: TrainingDatasetRecord) => d.config_id === configId
      );
      console.log('[PackageGenerator] Found', linked.length, 'linked dataset(s)');
      setLinkedDatasets(linked);
    } catch (err) {
      console.error('[PackageGenerator] Error fetching datasets:', err);
    } finally {
      setLoadingDatasets(false);
    }
  };

  const fetchAllDatasets = async () => {
    console.log('[PackageGenerator] Fetching all datasets');

    try {
      const response = await fetch('/api/training/dataset', {
        headers: sessionToken ? {
          'Authorization': `Bearer ${sessionToken}`,
        } : {},
      });

      if (!response.ok) {
        throw new Error('Failed to fetch datasets');
      }

      const data = await response.json();
      setAllDatasets(data.datasets || []);
      console.log('[PackageGenerator] Loaded', data.datasets?.length || 0, 'total datasets');

      // Debug: Show dataset details
      (data.datasets || []).forEach((d: TrainingDatasetRecord) => {
        console.log('[PackageGenerator] Dataset:', d.name, '| ID:', d.id, '| config_id:', d.config_id, '| Available for attach:', !d.config_id);
      });
    } catch (err) {
      console.error('[PackageGenerator] Error fetching all datasets:', err);
    }
  };

  const handleAttachDataset = async () => {
    if (!selectedDatasetId) return;

    console.log('[PackageGenerator] Attaching dataset:', selectedDatasetId, 'to config:', configId);
    setAttaching(true);
    setError(null);

    try {
      const response = await fetch(`/api/training/${configId}/attach-dataset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetId: selectedDatasetId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to attach dataset');
      }

      console.log('[PackageGenerator] Dataset attached successfully');
      setSelectedDatasetId('');
      await fetchLinkedDatasets();
    } catch (err) {
      console.error('[PackageGenerator] Attach error:', err);
      setError(err instanceof Error ? err.message : 'Failed to attach dataset');
    } finally {
      setAttaching(false);
    }
  };

  const handleDetachDataset = async (datasetId: string) => {
    console.log('[PackageGenerator] Detaching dataset:', datasetId);
    setDetachingId(datasetId);
    setError(null);

    try {
      const response = await fetch(`/api/training/${configId}/attach-dataset`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to detach dataset');
      }

      console.log('[PackageGenerator] Dataset detached successfully');
      await fetchLinkedDatasets();
      await fetchAllDatasets();
    } catch (err) {
      console.error('[PackageGenerator] Detach error:', err);
      setError(err instanceof Error ? err.message : 'Failed to detach dataset');
    } finally {
      setDetachingId(null);
    }
  };

  const handleGenerate = async () => {
    console.log('[PackageGenerator] Generating package for:', configId);
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/training/${configId}/generate-package`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate package');
      }

      const data = await response.json();
      console.log('[PackageGenerator] Package generated:', data.public_id);
      setPublicId(data.public_id);

      if (data.gist_urls) {
        console.log('[PackageGenerator] Gist URLs received:', Object.keys(data.gist_urls));
        setGistUrls(data.gist_urls);
      } else {
        console.log('[PackageGenerator] No Gist URLs in response');
        setGistUrls({});
      }
    } catch (err) {
      console.error('[PackageGenerator] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate package');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm('Revoke public access? This will invalidate the current public ID and all existing links.')) {
      return;
    }

    console.log('[PackageGenerator] Revoking public access for:', configId);
    setRevoking(true);
    setError(null);

    try {
      const response = await fetch(`/api/training/${configId}/generate-package`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to revoke access');
      }

      console.log('[PackageGenerator] Public access revoked');
      setPublicId(null);
      setGistUrls({});
    } catch (err) {
      console.error('[PackageGenerator] Revoke error:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke access');
    } finally {
      setRevoking(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Regenerate public ID? This will invalidate the current ID and create a new one.')) {
      return;
    }

    console.log('[PackageGenerator] Regenerating public ID for:', configId);
    setRevoking(true);
    setError(null);

    try {
      console.log('[PackageGenerator] Using sessionToken for regenerate:', sessionToken ? 'present' : 'missing');

      await fetch(`/api/training/${configId}/generate-package`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      const response = await fetch(`/api/training/${configId}/generate-package`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate');
      }

      const data = await response.json();
      console.log('[PackageGenerator] New public ID:', data.public_id);
      setPublicId(data.public_id);

      if (data.gist_urls) {
        console.log('[PackageGenerator] New Gist URLs received:', Object.keys(data.gist_urls));
        setGistUrls(data.gist_urls);
      } else {
        console.log('[PackageGenerator] No Gist URLs in regenerate response');
        setGistUrls({});
      }
    } catch (err) {
      console.error('[PackageGenerator] Regenerate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setRevoking(false);
    }
  };

  const getCodeSnippet = (method: 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt') => {
    return `# Install the package
!pip install finetune-lab-loader

# Run training
from finetune_lab import train_${method}
train_${method}("${publicId}")`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[PackageGenerator] Copy failed:', err);
    }
  };

  const getAvailableMethods = (): TrainingMethod[] => {
    if (linkedDatasets.length === 0) {
      return [];
    }

    console.log('[PackageGenerator] Determining compatible methods for', linkedDatasets.length, 'datasets');

    const allMethods: TrainingMethod[] = ['sft', 'dpo', 'rlhf', 'orpo', 'cpt'];
    const compatibleMethods = allMethods.filter(method => {
      return linkedDatasets.every(dataset => isFormatCompatible(dataset.format, method));
    });

    console.log('[PackageGenerator] Compatible methods:', compatibleMethods);
    return compatibleMethods;
  };

  const getMethodLabel = (method: TrainingMethod): string => {
    const labels: Record<TrainingMethod, string> = { sft: 'SFT', dpo: 'DPO', rlhf: 'RLHF', orpo: 'ORPO', cpt: 'CPT' };
    return labels[method];
  };

  // Content that can be wrapped in Card or rendered standalone
  const content = (
    <div className="space-y-4">
        {!publicId ? (
          <>
            <p className="text-sm text-muted-foreground">
              Generate a public training package to use on HuggingFace Spaces, Google Colab, or Kaggle.
              Your config and datasets will be accessible via a shareable link.
            </p>

            {loadingDatasets ? (
              <Alert>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <AlertDescription>Loading linked datasets...</AlertDescription>
              </Alert>
            ) : linkedDatasets.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Database className="h-4 w-4" />
                  <span>Attached Datasets ({linkedDatasets.length})</span>
                </div>
                {linkedDatasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    className="p-3 border rounded-md bg-muted/50 space-y-1 flex items-start justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{dataset.name}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">Format: {dataset.format.toUpperCase()}</span>
                        <span className="whitespace-nowrap">Examples: {dataset.total_examples}</span>
                        <span className="whitespace-nowrap">Size: {(dataset.file_size_bytes / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDetachDataset(dataset.id)}
                      disabled={detachingId === dataset.id}
                      className="h-6 w-6 p-0"
                      title="Detach dataset"
                    >
                      {detachingId === dataset.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
                {linkedDatasets.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    All datasets will be combined for training
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No datasets attached to this config. Attach a dataset below to generate a package.
                  </AlertDescription>
                </Alert>

                {allDatasets.length > 0 ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedDatasetId}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-md text-sm min-w-0"
                      disabled={attaching}
                    >
                      <option value="">Select a dataset...</option>
                      {allDatasets.map(dataset => {
                        const name = dataset.name.length > 40 ? dataset.name.substring(0, 40) + '...' : dataset.name;
                        const info = `${dataset.format.toUpperCase()}, ${dataset.total_examples} ex`;
                        const suffix = dataset.config_id ? ' - Linked' : '';
                        return (
                          <option
                            key={dataset.id}
                            value={dataset.id}
                            disabled={!!dataset.config_id}
                          >
                            {name} ({info}){suffix}
                          </option>
                        );
                      })}
                    </select>
                    <Button
                      onClick={handleAttachDataset}
                      disabled={!selectedDatasetId || attaching}
                      variant="outline"
                    >
                      {attaching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Attach'
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No available datasets. Upload a dataset from the Datasets tab first.
                  </p>
                )}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleGenerate}
              disabled={generating || loadingDatasets || linkedDatasets.length === 0}
              variant="secondary"
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Package...
                </>
              ) : (
                <>
                  <Package className="mr-2 h-4 w-4" />
                  Generate Package
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Training package generated! Use the code below in your training environment.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Public ID</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(publicId)}
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <code className="block p-3 bg-muted rounded-md text-sm font-mono">
                {publicId}
              </code>
            </div>

            {getAvailableMethods().map(method => (
              <div key={method} className="space-y-2">
                <Label className="text-sm font-medium">Code Snippet ({getMethodLabel(method)})</Label>
                <div className="relative">
                  <pre className="p-3 bg-muted rounded-md text-sm font-mono overflow-x-auto">
                    {getCodeSnippet(method)}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(getCodeSnippet(method))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {getAvailableMethods().length === 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No compatible training methods found for the attached dataset formats.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-medium">One-Click Training</Label>

              {Object.keys(gistUrls).length > 0 ? (
                <div className="flex flex-col gap-2">
                  {getAvailableMethods().map(method => {
                    const gistUrl = gistUrls[method];
                    if (!gistUrl) return null;

                    return (
                      <a
                        key={method}
                        href={gistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open {getMethodLabel(method)} in Colab
                      </a>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">
                    Click to open pre-filled Jupyter notebook in Google Colab
                  </p>
                </div>
              ) : (
                <Alert>
                  <AlertDescription className="text-xs">
                    Colab notebooks are being generated. This may take a few seconds. Refresh the page to see the one-click Colab buttons.
                  </AlertDescription>
                </Alert>
              )}

              <div className="pt-2">
                <a
                  href="https://huggingface.co/spaces"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open HF Spaces (Manual Setup)
                </a>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-3">
                Manage public access
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleRegenerate}
                  variant="outline"
                  size="sm"
                  disabled={revoking}
                  className="flex-1"
                >
                  {revoking ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Regenerate ID
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleRevoke}
                  variant="outline"
                  size="sm"
                  disabled={revoking}
                  className="flex-1"
                >
                  {revoking ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Revoking...
                    </>
                  ) : (
                    <>
                      <ShieldOff className="mr-2 h-3 w-3" />
                      Revoke Access
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );

  // Conditionally wrap in Card based on variant
  if (variant === 'content') {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Training Package</CardTitle>
        <CardDescription>
          Create a shareable training package for {configName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}

console.log('[PackageGenerator] Component loaded');
