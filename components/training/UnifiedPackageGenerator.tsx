// Unified Package Generator Component
// Combines cloud (Colab/Gist) and local (GPU) training package generation
// Date: 2025-10-22
// Updated: 2025-10-31 - Added DeploymentTargetSelector and TimeEstimationCard
// Updated: 2025-11-01 - Replaced crowded UI with CloudDeploymentWizard
// Updated: 2025-11-02 - Added shared dataset state to deduplicate API calls
// Updated: 2025-11-02 - Removed deprecated PackageGenerator (Colab/Gist)

'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LocalPackageDownloader } from './LocalPackageDownloader';
import { CloudDeploymentWizard } from './CloudDeploymentWizard';
import { Cloud, Laptop } from 'lucide-react';
import type { TrainingConfig } from '@/lib/training/training-config.types';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

console.log('[UnifiedPackageGenerator] Component loaded');

interface UnifiedPackageGeneratorProps {
  configId: string;
  configName: string;
  sessionToken?: string;
  config?: TrainingConfig; // Full training configuration for time estimation
  datasetSize?: number;    // Number of training samples
}

export function UnifiedPackageGenerator({
  configId,
  configName,
  sessionToken,
  config,
  datasetSize,
}: UnifiedPackageGeneratorProps) {
  console.log('[UnifiedPackageGenerator] Rendered for config:', configName);

  // Shared dataset state to prevent duplicate API calls
  const [linkedDatasets, setLinkedDatasets] = useState<TrainingDatasetRecord[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);

  // Fetch datasets once on mount
  useEffect(() => {
    console.log('[UnifiedPackageGenerator] useEffect triggered, fetching datasets for:', configId);
    fetchLinkedDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId, sessionToken]); // Re-fetch when token becomes available

  // Fetch linked datasets from junction table
  const fetchLinkedDatasets = async () => {
    console.log('[UnifiedPackageGenerator] Fetching linked datasets for config:', configId);
    console.log('[UnifiedPackageGenerator] Using sessionToken:', sessionToken ? 'present' : 'missing');
    
    // Don't try to fetch if no session token
    if (!sessionToken) {
      console.warn('[UnifiedPackageGenerator] No session token available, skipping dataset fetch');
      setLoadingDatasets(false);
      return;
    }
    
    setLoadingDatasets(true);

    try {
      const response = await fetch(`/api/training/${configId}/datasets`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to fetch linked datasets (${response.status})`);
      }

      const data = await response.json();
      console.log('[UnifiedPackageGenerator] Found', data.datasets?.length || 0, 'linked dataset(s)');
      setLinkedDatasets(data.datasets || []);
    } catch (err) {
      console.error('[UnifiedPackageGenerator] Error fetching datasets:', err);
    } finally {
      setLoadingDatasets(false);
    }
  };

  // Callback when datasets change in children
  const handleDatasetsChange = (datasets: TrainingDatasetRecord[]) => {
    console.log('[UnifiedPackageGenerator] Datasets changed, updating shared state:', datasets.length, 'datasets');
    setLinkedDatasets(datasets);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="cloud" className="w-full">
          <TabsList className="inline-flex w-auto bg-transparent p-0 gap-1">
            <TabsTrigger value="cloud" className="flex items-center gap-1.5 px-3 py-1.5 text-sm data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:bg-muted">
              <Cloud className="w-3.5 h-3.5" />
              Cloud Training
            </TabsTrigger>
            <TabsTrigger value="local" className="flex items-center gap-1.5 px-3 py-1.5 text-sm data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:bg-muted">
              <Laptop className="w-3.5 h-3.5" />
              Local Training
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cloud" className="mt-4 space-y-4">
            {/* Cloud Deployment Wizard - Stepped flow: Platform → Configure → Review → Deploy */}
            <CloudDeploymentWizard
              configId={configId}
              configName={configName}
              config={config}
              datasetSize={datasetSize}
              sessionToken={sessionToken}
              linkedDatasets={linkedDatasets}
              loadingDatasets={loadingDatasets}
              onDatasetsChange={handleDatasetsChange}
              onDeploySuccess={(platform, deploymentId, url) => {
                console.log('[UnifiedPackageGenerator] Cloud deployment success:', { platform, deploymentId, url });
              }}
            />
          </TabsContent>

          <TabsContent value="local" className="mt-4">
            {/* Local training stays simple - just download the package */}
            <LocalPackageDownloader
              configId={configId}
              configName={configName}
              sessionToken={sessionToken}
              linkedDatasets={linkedDatasets}
              loadingDatasets={loadingDatasets}
              onDatasetsChange={handleDatasetsChange}
            />
          </TabsContent>
        </Tabs>
    </div>
  );
}

console.log('[UnifiedPackageGenerator] Component defined');
