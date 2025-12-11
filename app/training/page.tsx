'use client';
// Training Configs Page - Phase 2 MVP + Dataset Management
// Date: 2025-10-16

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFreshToken } from '@/hooks/useFreshToken';
import { useSearchParams } from 'next/navigation';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { TrainingConfigRecord } from '@/lib/training/training-config.types';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';
import { TrainingWorkflow } from '@/components/training/TrainingWorkflow';
import { CompactConfigCard } from '@/components/training/CompactConfigCard';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
// V2 Feature - Regression Gates (temporarily disabled)
// import { BaselineManagerUI, ValidationHistoryView } from '@/components/training/baselines';
import { AgentStatus } from '@/components/training/AgentStatus';

function TrainingPageContent() {
  const { user, session, signOut } = useAuth();
  const getFreshToken = useFreshToken();
  const searchParams = useSearchParams();

  const [configs, setConfigs] = useState<TrainingConfigRecord[]>([]);
  const [datasets, setDatasets] = useState<TrainingDatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState<TrainingConfigRecord | null>(null);
  const [cloningConfigId, setCloningConfigId] = useState<string | null>(null);
  const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [workflowConfigId, setWorkflowConfigId] = useState<string | null>(null);
  const [savedConfigsCollapsed, setSavedConfigsCollapsed] = useState(false);

  useEffect(() => {
    if (user && session?.access_token) {
      fetchConfigs();
      fetchDatasets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user.id to prevent infinite loops from token refresh

  // Handle edit URL parameter (e.g., /training?edit=config-id)
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId && configs.length > 0 && !editingConfig) {
      const configToEdit = configs.find(c => c.id === editId);
      if (configToEdit) {
        console.log('[TrainingPage] Auto-opening editor for config:', editId);
        handleEditConfig(configToEdit);
        // Clear the URL parameter to prevent re-triggering
        window.history.replaceState({}, '', '/training');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs, searchParams]);

  async function fetchConfigs() {
    console.log('[TrainingPage] Fetching configs');
    setLoading(true);

    try {
      const token = getFreshToken();
      const response = await fetch('/api/training', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error('Failed to fetch configs');

      const data = await response.json();
      console.log('[TrainingPage] Loaded', data.configs.length, 'configs');
      console.log('[TrainingPage] Config public_ids:', data.configs.map((c: TrainingConfigRecord) => ({
        name: c.name,
        public_id: c.public_id,
        has_public_id: !!c.public_id
      })));
      setConfigs(data.configs || []);
    } catch (err) {
      console.error('[TrainingPage] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDatasets() {
    console.log('[TrainingPage] Fetching datasets for badge counts');

    try {
      const token = getFreshToken();
      const response = await fetch('/api/training/dataset', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error('Failed to fetch datasets');

      const data = await response.json();
      console.log('[TrainingPage] Loaded', data.datasets?.length || 0, 'datasets');
      setDatasets(data.datasets || []);
    } catch (err) {
      console.error('[TrainingPage] Dataset fetch error:', err);
    }
  }

  function getDatasetCount(configId: string): number {
    return datasets.filter(d => d.config_id === configId).length;
  }

  function downloadConfig(config: TrainingConfigRecord) {
    console.log('[TrainingPage] Downloading:', config.name);
    const blob = new Blob([JSON.stringify(config.config_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleEditConfig(config: TrainingConfigRecord) {
    console.log('[TrainingPage] Editing config:', config.id);
    setEditingConfig(config);
  }

  async function handleCloneConfig(config: TrainingConfigRecord) {
    console.log('[TrainingPage] Cloning config:', config.id);
    setCloningConfigId(config.id);

    try {
      const cloneName = `${config.name.replace(/_/g, ' ')} (Copy)`;
      const token = getFreshToken();
      const response = await fetch('/api/training', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: cloneName,
          template_type: config.template_type,
          config_json: config.config_json
        })
      });

      if (!response.ok) throw new Error('Failed to clone config');

      const data = await response.json();
      console.log('[TrainingPage] Config cloned:', data.config.id);
      fetchConfigs();
    } catch (err) {
      console.error('[TrainingPage] Clone error:', err);
    } finally {
      setCloningConfigId(null);
    }
  }

  async function handleDeleteConfig(config: TrainingConfigRecord) {
    const confirmed = window.confirm(
      `Delete "${config.name.replace(/_/g, ' ')}"?\n\nThis will permanently delete the config and cannot be undone.`
    );

    if (!confirmed) {
      console.log('[TrainingPage] Delete cancelled by user');
      return;
    }

    console.log('[TrainingPage] Deleting config:', config.id);
    setDeletingConfigId(config.id);

    try {
      const token = getFreshToken();
      const response = await fetch(`/api/training/${config.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete config');

      console.log('[TrainingPage] Config deleted successfully');
      fetchConfigs();
    } catch (err) {
      console.error('[TrainingPage] Delete error:', err);
      alert('Failed to delete config. Please try again.');
    } finally {
      setDeletingConfigId(null);
    }
  }

  function handleLoadIntoWorkflow(configId: string) {
    console.log('[TrainingPage] Loading config into workflow:', configId);
    setWorkflowConfigId(configId);
    // Scroll to top of page where workflow is
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getFilteredConfigs(): TrainingConfigRecord[] {
    let filtered = configs;

    // Apply search filter if query exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(config =>
        config.name.toLowerCase().includes(query) ||
        config.template_type.toLowerCase().includes(query)
      );
    }

    // Sort by created_at (most recent first) and limit to 4
    return filtered
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4);
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please log in to access training configs.</p>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="training" user={user} signOut={signOut}>
      <PageHeader
        title="Training Lab"
        description="Choose models, build training configs, and generate packages for fine-tuning"
        actions={<AgentStatus />}
      />

      {/* Training Workflow - Unified config creation and package generation */}
      <div className="mb-8">
        {session?.access_token ? (
          <TrainingWorkflow
            sessionToken={session.access_token}
            allConfigs={configs}
            allDatasets={datasets}
            onConfigCreated={fetchConfigs}
            onPackageGenerated={(configId) => console.log('[TrainingPage] Package generated for:', configId)}
            preSelectedConfigId={workflowConfigId}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Loading session...</p>
          </div>
        )}
      </div>

      {/* Saved Configs - Compact Grid */}
      <div className="max-w-5xl mx-auto">
        {savedConfigsCollapsed ? (
          <Card
            className="shadow-none border cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setSavedConfigsCollapsed(false)}
          >
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">Saved Configurations</h2>
                {configs.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({getFilteredConfigs().length})
                  </span>
                )}
              </div>
              <ChevronRight className="h-5 w-5" />
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-none border">
            <CardContent className="pt-6 space-y-4">
              <div
                className="flex items-center justify-between mb-2 cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => setSavedConfigsCollapsed(true)}
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold">Saved Configurations</h2>
                  {configs.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      ({getFilteredConfigs().length})
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </div>
                {configs.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search configs by name or template type..."
                      className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                )}

                {loading ? (
                  <p>Loading configs...</p>
                ) : configs.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">No configs yet. Create one using the workflow above!</p>
                  </div>
                ) : getFilteredConfigs().length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">No configs match your search.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {getFilteredConfigs().map(config => {
                      const datasetCount = getDatasetCount(config.id);
                      const isCloning = cloningConfigId === config.id;
                      const isDeleting = deletingConfigId === config.id;

                      return (
                        <CompactConfigCard
                          key={config.id}
                          config={config}
                          datasetCount={datasetCount}
                          onDownload={downloadConfig}
                          onClone={handleCloneConfig}
                          onDelete={handleDeleteConfig}
                          onEdit={handleEditConfig}
                          onLoadIntoWorkflow={handleLoadIntoWorkflow}
                          isCloning={isCloning}
                          isDeleting={isDeleting}
                        />
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
        )}
      </div>

      {/* V2 Feature - Regression Gates (temporarily disabled)
      <div className="space-y-6 mt-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Regression Gates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure baselines and monitor validation results to prevent bad models from reaching production
          </p>
        </div>
        <BaselineManagerUI />
        <ValidationHistoryView autoRefresh={false} />
      </div>
      */}
    </PageWrapper>
  );
}

export default function TrainingPage() {
  return (
    <Suspense fallback={<LoadingState fullScreen message="Loading training workspace..." />}>
      <TrainingPageContent />
    </Suspense>
  );
}
