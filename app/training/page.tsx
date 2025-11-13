'use client';
// Training Configs Page - Phase 2 MVP + Dataset Management
// Date: 2025-10-16

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFreshToken } from '@/hooks/useFreshToken';
import { Plus, Download, Package as PackageIcon, Database, Edit2, Copy, Trash2, Search, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TrainingConfigRecord } from '@/lib/training/training-config.types';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';
import { ALL_TEMPLATES } from '@/lib/training/training-templates';
import { UnifiedPackageGenerator } from '@/components/training/UnifiedPackageGenerator';
import { DatasetManager } from '@/components/training/DatasetManager';
import { ConfigEditor } from '@/components/training/ConfigEditor';
import { BatchTesting } from '@/components/training/BatchTesting';
import { BenchmarkManager } from '@/components/training/BenchmarkManager';
import { BaselineManagerUI, ValidationHistoryView } from '@/components/training/baselines';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TrainingWorkflow } from '@/components/training/TrainingWorkflow';
import { CompactConfigCard } from '@/components/training/CompactConfigCard';

export default function TrainingPage() {
  const { user, session, signOut } = useAuth();
  const getFreshToken = useFreshToken();

  const [configs, setConfigs] = useState<TrainingConfigRecord[]>([]);
  const [datasets, setDatasets] = useState<TrainingDatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<TrainingConfigRecord | null>(null);
  const [cloningConfigId, setCloningConfigId] = useState<string | null>(null);
  const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null);
  const [revokingConfigId, setRevokingConfigId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('configs');
  const [workflowConfigId, setWorkflowConfigId] = useState<string | null>(null);
  const [savedConfigsCollapsed, setSavedConfigsCollapsed] = useState(false);

  useEffect(() => {
    if (user && session?.access_token) {
      fetchConfigs();
      fetchDatasets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user.id to prevent infinite loops from token refresh

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

  function formatTemplateName(templateKey: string): string {
    const formatted = templateKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    console.log('[TrainingPage] formatTemplateName:', templateKey, '->', formatted);
    return formatted;
  }

  async function handleCreateFromTemplate() {
    if (!selectedTemplate) return;

    console.log('[TrainingPage] Creating from template:', selectedTemplate);
    setCreating(true);

    try {
      const template = ALL_TEMPLATES[selectedTemplate];
      const token = getFreshToken();
      const response = await fetch('/api/training', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: `${formatTemplateName(selectedTemplate)} - ${new Date().toISOString().split('T')[0]}`,
          template_type: selectedTemplate,
          config_json: template
        })
      });

      if (!response.ok) throw new Error('Failed to create config');

      const data = await response.json();
      console.log('[TrainingPage] Created:', data.config.id);
      fetchConfigs();
      setSelectedTemplate('');
    } catch (err) {
      console.error('[TrainingPage] Create error:', err);
    } finally {
      setCreating(false);
    }
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
    setExpandedConfig(null);
  }

  function handleSaveConfig() {
    console.log('[TrainingPage] Config saved, refreshing list');
    setEditingConfig(null);
    fetchConfigs();
  }

  function handleCancelEdit() {
    console.log('[TrainingPage] Edit cancelled');
    setEditingConfig(null);
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

  async function handleRevokePublicAccess(config: TrainingConfigRecord) {
    console.log('[TrainingPage] Revoking public access for:', config.id);
    setRevokingConfigId(config.id);

    try {
      const token = getFreshToken();
      const response = await fetch(`/api/training/${config.id}/generate-package`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to revoke access');

      console.log('[TrainingPage] Public access revoked successfully');
      fetchConfigs(); // Refresh to show updated state
    } catch (err) {
      console.error('[TrainingPage] Revoke error:', err);
      alert('Failed to revoke public access. Please try again.');
    } finally {
      setRevokingConfigId(null);
    }
  }

  function handleLoadIntoWorkflow(configId: string) {
    console.log('[TrainingPage] Loading config into workflow:', configId);
    setWorkflowConfigId(configId);
    // Scroll to top of page where workflow is
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getFilteredConfigs(): TrainingConfigRecord[] {
    if (!searchQuery.trim()) {
      return configs;
    }

    const query = searchQuery.toLowerCase();
    return configs.filter(config =>
      config.name.toLowerCase().includes(query) ||
      config.template_type.toLowerCase().includes(query)
    );
  }

  const publicConfigs = useMemo(() => {
    const filtered = configs.filter(config => config.public_id);

    // Throttled logging - only in dev, 10% sample rate
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
      console.log('[TrainingPage] Public configs count:', filtered.length);
    }

    return filtered;
  }, [configs]); // Recalculate only when configs array changes

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please log in to access training configs.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <AppSidebar currentPage="training" user={user} signOut={signOut} />
      <div className="flex-1 p-8 bg-background overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Training Platform</h1>
            <p className="text-muted-foreground mt-2">
              Build configs, upload datasets, and generate training packages for external platforms
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="configs">Training Configs</TabsTrigger>
              <TabsTrigger value="public-packages">
                Public Packages
                {publicConfigs.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                    {publicConfigs.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="datasets">Datasets</TabsTrigger>
              <TabsTrigger value="batch-testing">Batch Testing</TabsTrigger>
              <TabsTrigger value="regression-gates">Regression Gates</TabsTrigger>
            </TabsList>

            <TabsContent value="configs" className="mt-6">
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
              <div className="max-w-4xl mx-auto">
                {savedConfigsCollapsed ? (
                  <Card 
                    className="shadow-none border border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-muted/50 transition-colors"
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
                  <>
                    <div 
                      className="flex items-center justify-between mb-3 pl-4 cursor-pointer hover:opacity-70 transition-opacity"
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

                    <Card className="shadow-none border border-gray-300 dark:border-gray-600">
                      <CardContent className="pt-6 space-y-4">
                        {configs.length > 0 && (
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search configs by name or template type..."
                              className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
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
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="public-packages" className="mt-6">
              {publicConfigs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <PackageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No public packages yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Generate a training package from the Training Configs tab to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold">Public Training Packages</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Configs with public access that can be imported by others
                    </p>
                  </div>

                  <div className="space-y-3">
                    {publicConfigs.map(config => {
                      const isRevoking = revokingConfigId === config.id;
                      const gistUrls = config.gist_urls as Record<string, string> | null;
                      const hasGists = gistUrls && Object.keys(gistUrls).length > 0;

                      return (
                        <div
                          key={config.id}
                          className="p-4 border rounded-lg bg-card hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{config.name.replace(/_/g, ' ')}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Public ID: <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{config.public_id}</code>
                              </p>
                              {hasGists && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Colab notebooks: {Object.keys(gistUrls).join(', ').toUpperCase()}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                Template: {config.template_type}
                              </p>
                            </div>
                            <Button
                              onClick={() => {
                                console.log('[TrainingPage] Revoke button clicked for:', config.id);
                                handleRevokePublicAccess(config);
                              }}
                              variant="destructive"
                              size="sm"
                              disabled={isRevoking}
                            >
                              {isRevoking ? 'Revoking...' : 'Revoke Access'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="datasets" className="mt-6">
              <DatasetManager sessionToken={session?.access_token} />
            </TabsContent>

            <TabsContent value="batch-testing" className="mt-6">
              <div className="space-y-6">
                <BenchmarkManager sessionToken={session?.access_token || ''} />
                <BatchTesting sessionToken={session?.access_token || ''} />
              </div>
            </TabsContent>

            <TabsContent value="regression-gates" className="mt-6">
              <div className="space-y-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">Regression Gates</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure baselines and monitor validation results to prevent bad models from reaching production
                  </p>
                </div>
                <BaselineManagerUI />
                <ValidationHistoryView autoRefresh={false} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
