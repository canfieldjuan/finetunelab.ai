// Local Package Downloader Component
// Generates local training packages for download
// Date: 2025-10-22
// Updated: 2025-11-02 - Added DatasetAttachment component, removed internal fetching

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import {
  DownloadIcon,
  Loader2Icon,
  CheckCircle2Icon,
  FileIcon,
  FileTextIcon,
  FileCodeIcon,
  DatabaseIcon,
  AlertCircleIcon,
  Rocket,
  ExternalLink,
} from 'lucide-react';
import { DatasetAttachment } from './DatasetAttachment';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

console.log('[LocalPackageDownloader] Component loaded');

interface LocalPackageDownloaderProps {
  configId: string;
  configName: string;
  sessionToken?: string;
  linkedDatasets?: TrainingDatasetRecord[];
  loadingDatasets?: boolean;
  onDatasetsChange?: (datasets: TrainingDatasetRecord[]) => void;
}

export function LocalPackageDownloader({
  configId,
  configName,
  sessionToken,
  linkedDatasets = [],
  onDatasetsChange,
}: LocalPackageDownloaderProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Package blob for download
  const [packageBlob, setPackageBlob] = useState<Blob | null>(null);
  const [packageFilename, setPackageFilename] = useState<string>('');

  // Training execution state
  const [trainingStarted, setTrainingStarted] = useState(false);
  const [trainingJobId, setTrainingJobId] = useState<string | null>(null);
  const [startingTraining, setStartingTraining] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  console.log('[LocalPackageDownloader] Rendered for config:', configName);
  console.log('[LocalPackageDownloader] Received', linkedDatasets.length, 'linked datasets from parent');

  // Get user ID from Supabase session
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        console.log('[LocalPackageDownloader] User ID:', user.id);
      }
    });
  }, []);

  // Calculate estimated package size
  const estimatedSize = useMemo(() => {
    let totalBytes = 0;

    // Base files (~500KB)
    totalBytes += 500 * 1024;

    // Datasets
    linkedDatasets.forEach(ds => {
      totalBytes += ds.file_size_bytes || 0;
    });

    // Format to human-readable size
    if (totalBytes < 1024) return `${totalBytes} B`;
    if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`;
    if (totalBytes < 1024 * 1024 * 1024) return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }, [linkedDatasets]);

  const handleGeneratePackage = async () => {
    console.log('[LocalPackageDownloader] Generating local package for:', configId);

    setGenerating(true);
    setError(null);
    setDownloadReady(false);

    try {
      const response = await fetch(`/api/training/${configId}/download-package`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
        },
      });

      if (!response.ok) {
        // Try to parse error message from JSON
        try {
          const data = await response.json();
          throw new Error(data.error || 'Failed to generate package');
        } catch {
          throw new Error('Failed to generate package');
        }
      }

      // Get blob from response
      const blob = await response.blob();
      console.log('[LocalPackageDownloader] Package generated, size:', blob.size);

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `finetune-lab-${configName.replace(/\s+/g, '-').toLowerCase()}.zip`;

      // Store blob and filename for later download
      setPackageBlob(blob);
      setPackageFilename(filename);
      setDownloadReady(true);
      console.log('[LocalPackageDownloader] Package ready for download:', filename);
    } catch (err) {
      console.error('[LocalPackageDownloader] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate package');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    console.log('[LocalPackageDownloader] Triggering download for:', packageFilename);

    if (!packageBlob || !packageFilename) {
      console.error('[LocalPackageDownloader] No package available for download');
      setError('No package available. Please generate package first.');
      return;
    }

    // Create download URL
    const url = URL.createObjectURL(packageBlob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = packageFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Cleanup
    URL.revokeObjectURL(url);

    console.log('[LocalPackageDownloader] Download triggered:', packageFilename);
  };

  const handleStartTraining = async () => {
    console.log('[LocalPackageDownloader] Starting local training for:', configId);

    if (!sessionToken) {
      console.error('[LocalPackageDownloader] No session token available');
      setError('Authentication required. Please refresh the page and try again.');
      return;
    }

    setStartingTraining(true);
    setError(null);

    try {
      // Generate unique job ID
      const jobId = crypto.randomUUID();
      console.log('[LocalPackageDownloader] Generated job ID:', jobId);

      // Fetch config data
      const configResponse = await fetch(`/api/training/${configId}`, {
        headers: {
          ...(sessionToken && { Authorization: `Bearer ${sessionToken}` }),
        },
      });

      if (!configResponse.ok) {
        throw new Error('Failed to fetch training config');
      }

      const configData = await configResponse.json();
      console.log('[LocalPackageDownloader] Config loaded:', configData.config.name);

      // Validate user authentication
      if (!userId) {
        throw new Error('User not authenticated. Please refresh the page and try again.');
      }

      // Prepare training request with dataset storage path
      // The training server will download it directly (more efficient than browser download)
      let datasetPath = '';
      if (linkedDatasets.length > 0) {
        datasetPath = linkedDatasets[0].storage_path;
        console.log('[LocalPackageDownloader] Dataset path:', datasetPath);
      }

      const trainingRequest = {
        config_id: configId,
        dataset_path: datasetPath, // Send storage path - server will download it
        execution_id: jobId,
        name: configName,
      };

      console.log('[LocalPackageDownloader] Calling Next.js API to start local training...');
      console.log('[LocalPackageDownloader] Config ID:', configId);
      console.log('[LocalPackageDownloader] Execution ID:', jobId);

      // Call Next.js API route which will proxy to training server
      // This works for both localhost testing and web deployment
      const response = await fetch('/api/training/local/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(trainingRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[LocalPackageDownloader] Training server error:', errorData);
        const errorMessage = errorData.detail || errorData.error || `Training server error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[LocalPackageDownloader] Training started successfully:', result);

      // Use the job_id returned by the training server, not our execution_id
      const serverJobId = result.job_id || jobId;
      console.log('[LocalPackageDownloader] Server job ID:', serverJobId);

      setTrainingJobId(serverJobId);
      setTrainingStarted(true);

      // Auto-redirect to monitor page after 2 seconds
      console.log('[LocalPackageDownloader] Training started, redirecting to monitor in 2s...');
      setTimeout(() => {
        console.log('[LocalPackageDownloader] Redirecting to monitor page');
        router.push(`/training/monitor?jobId=${serverJobId}`);
      }, 2000);

    } catch (err) {
      console.error('[LocalPackageDownloader] Training start error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to start training';
      console.error('[LocalPackageDownloader] Error details:', errorMsg);
      setError(errorMsg);
      
      // DO NOT redirect on error - stay on page to show error
      setTrainingStarted(false);
      setTrainingJobId(null);
    } finally {
      setStartingTraining(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Datasets Section - Interactive attachment */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Training Datasets</h4>
        <DatasetAttachment
          configId={configId}
          onDatasetsChange={onDatasetsChange}
        />
      </div>

      {/* Package Contents Preview */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Package Contents</h4>
        <div className="rounded-md bg-muted p-3 space-y-1 text-xs font-mono">
          <div className="flex items-center gap-2">
            <FileTextIcon className="w-3 h-3" />
            <span>README_TRAINING.md</span>
            <span className="text-muted-foreground ml-auto">Setup guide</span>
          </div>
          <div className="flex items-center gap-2">
            <FileIcon className="w-3 h-3" />
            <span>requirements.txt</span>
            <span className="text-muted-foreground ml-auto">Dependencies</span>
          </div>
          <div className="flex items-center gap-2">
            <FileCodeIcon className="w-3 h-3" />
            <span>config.json</span>
            <span className="text-muted-foreground ml-auto">Training config</span>
          </div>
          {linkedDatasets.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <DatabaseIcon className="w-3 h-3" />
                <span>train_dataset.jsonl</span>
                <span className="text-muted-foreground ml-auto">Dataset</span>
              </div>
              {linkedDatasets.length > 1 && (
                <div className="flex items-center gap-2">
                  <DatabaseIcon className="w-3 h-3" />
                  <span>eval_dataset.jsonl</span>
                  <span className="text-muted-foreground ml-auto">Dataset</span>
                </div>
              )}
            </>
          )}
          <div className="flex items-center gap-2">
            <FileCodeIcon className="w-3 h-3" />
            <span>train.py</span>
            <span className="text-muted-foreground ml-auto">Entry point</span>
          </div>
          <div className="flex items-center gap-2">
            <FileCodeIcon className="w-3 h-3" />
            <span>standalone_trainer.py</span>
            <span className="text-muted-foreground ml-auto">Trainer module</span>
          </div>
        </div>

        {/* Estimated Size */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Estimated package size:</span>
          <span className="font-medium">{estimatedSize}</span>
        </div>
      </div>

      {/* System Requirements */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">System Requirements</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs">
            <AlertCircleIcon className="w-4 h-4 text-yellow-600" />
            <div className="flex-1">
              <div className="font-medium">
                Python Version<span className="text-red-600 ml-1">*</span>
              </div>
              <div className="text-muted-foreground">
                Python 3.9+ required. Check after download with: python --version
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <AlertCircleIcon className="w-4 h-4 text-yellow-600" />
            <div className="flex-1">
              <div className="font-medium">
                Disk Space<span className="text-red-600 ml-1">*</span>
              </div>
              <div className="text-muted-foreground">
                50GB+ free space recommended for model and training data
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <AlertCircleIcon className="w-4 h-4 text-yellow-600" />
            <div className="flex-1">
              <div className="font-medium">GPU Support</div>
              <div className="text-muted-foreground">
                CUDA-capable GPU strongly recommended (16GB+ VRAM for 7B models)
              </div>
            </div>
          </div>
        </div>
        <Alert>
          <AlertDescription className="text-xs">
            <strong>Note:</strong> Full system verification will be performed when you run
            the training script on your local machine. These are general requirements.
          </AlertDescription>
        </Alert>
      </div>

      {/* Before Package Generation */}
      {!downloadReady && !trainingStarted && (
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium">Local Training Package</p>
            <p className="text-xs text-muted-foreground">
              Generate package for local GPU training
            </p>
          </div>

          <Button
            onClick={handleGeneratePackage}
            disabled={generating}
            size="sm"
            variant="outline"
          >
            {generating ? (
              <>
                <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <DownloadIcon className="w-4 h-4 mr-2" />
                Generate Package
              </>
            )}
          </Button>
        </div>
      )}

      {/* After Package Generation - Show Two Buttons */}
      {downloadReady && !trainingStarted && (
        <div className="rounded-md border-2 border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-green-800 font-medium mb-3">
            <CheckCircle2Icon className="w-5 h-5" />
            <span>Package Generated Successfully</span>
          </div>

          <p className="text-sm text-green-700 mb-4">
            Choose how to proceed:
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleDownload}
              variant="outline"
              size="sm"
              className="flex flex-col items-center gap-2 h-auto py-3"
            >
              <DownloadIcon className="w-5 h-5" />
              <div className="text-center">
                <div className="font-medium">Download</div>
                <div className="text-xs text-muted-foreground">Package</div>
              </div>
            </Button>

            <Button
              onClick={handleStartTraining}
              disabled={startingTraining || linkedDatasets.length === 0}
              size="sm"
              className="flex flex-col items-center gap-2 h-auto py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              title={linkedDatasets.length === 0 ? 'Please attach a dataset first in the Package Generator tab' : 'Run training now'}
            >
              {startingTraining ? (
                <>
                  <Loader2Icon className="w-5 h-5 animate-spin" />
                  <div className="text-center">
                    <div className="font-medium">Starting...</div>
                  </div>
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  <div className="text-center">
                    <div className="font-medium">Run Now</div>
                    <div className="text-xs">Locally</div>
                  </div>
                </>
              )}
            </Button>
          </div>

          {linkedDatasets.length === 0 && (
            <Alert className="mt-3 border-yellow-200 bg-yellow-50">
              <AlertCircleIcon className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700 text-xs">
                No datasets attached. Attach a dataset above before running training.
              </AlertDescription>
            </Alert>
          )}

          {linkedDatasets.length > 0 && (
            <p className="text-xs text-green-700 mt-3 text-center">
              Run Now will start training on your local GPU immediately (port 8000)
            </p>
          )}
        </div>
      )}

      {/* After Training Started */}
      {trainingStarted && trainingJobId && (
        <div className="rounded-md border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-800 font-medium mb-3">
            <Rocket className="w-5 h-5" />
            <span>Training Started!</span>
          </div>

          <div className="space-y-2 text-sm text-blue-700 mb-4">
            <div>
              <span className="font-medium">Job ID:</span>{' '}
              <code className="text-xs bg-blue-100 px-2 py-1 rounded">{trainingJobId}</code>
            </div>
            <div>
              <span className="font-medium">Model:</span> {configName}
            </div>
            <div>
              <span className="font-medium">Status:</span> Initializing...
            </div>
          </div>

          <Button
            onClick={() => router.push(`/training/monitor?jobId=${trainingJobId}`)}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            View Live Progress
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

console.log('[LocalPackageDownloader] Component defined');
