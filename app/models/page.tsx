'use client';

/**
 * Model Management Page
 * Phase 5.2.1: Main Page Structure
 * Date: 2025-10-15
 *
 * Allows users to:
 * - View all available models (global + user's own)
 * - Add custom models
 * - Edit/delete user models
 * - Test model connections
 */

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModelCard } from '@/components/models/ModelCard';
import { AddModelDialog } from '@/components/models/AddModelDialog';
import { EditModelDialog } from '@/components/models/EditModelDialog';
import type { LLMModelDisplay } from '@/lib/models/llm-model.types';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { toast } from 'sonner';
import { OWNERSHIP_FILTERS, type OwnershipFilter } from '@/lib/constants';

type ServerInfo = {
  model_id?: string | null;
  status?: string | null;
} & Record<string, unknown>;

function ModelsPageContent() {
  const { user, session, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedModelId = searchParams?.get('modelId');
  const modelRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [models, setModels] = useState<LLMModelDisplay[]>([]);
  const [servers, setServers] = useState<Record<string, ServerInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>(OWNERSHIP_FILTERS.MINE);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [modelToEdit, setModelToEdit] = useState<LLMModelDisplay | null>(null);

  console.log('[ModelsPage] Auth state:', { user: user?.email, authLoading });
  console.log('[ModelsPage] Highlighted model ID from URL:', highlightedModelId);

  // Auth check - redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      console.warn('[ModelsPage] No authenticated user, redirecting to login');
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Fetch models on mount when authenticated
  useEffect(() => {
    if (user && session?.access_token) {
      fetchModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]); // Only depend on stable IDs, not entire objects

  // Scroll to and highlight newly deployed model
  useEffect(() => {
    if (highlightedModelId && models.length > 0 && !loading) {
      console.log('[ModelsPage] Scrolling to highlighted model:', highlightedModelId);
      
      // Find the model in the list
      const deployedModel = models.find(m => m.id === highlightedModelId);
      
      if (deployedModel) {
        // Show success toast
        toast.success('Model Deployed Successfully!', {
          description: `${deployedModel.name} is now available in your models list.`,
          duration: 5000,
        });

        // Scroll to the model card after a short delay
        setTimeout(() => {
          const modelElement = modelRefs.current[highlightedModelId];
          if (modelElement) {
            modelElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);

        // Remove the modelId from URL after handling
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('modelId');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [highlightedModelId, models, loading]);

  async function fetchModels() {
    console.log('[ModelsPage] Fetching models...');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/models', {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      console.log('[ModelsPage] Fetched models:', data.count);
      setModels(data.models || []);

      // Fetch server status after models are loaded
      await fetchServers();
    } catch (err) {
      console.error('[ModelsPage] Error fetching models:', err);
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }

  async function fetchServers() {
    if (!session?.access_token) {
      console.log('[ModelsPage] No session token, skipping server fetch');
      return;
    }

    try {
      const response = await fetch('/api/servers/status', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        console.error('[ModelsPage] Failed to fetch servers:', response.status);
        return;
      }

      const data = await response.json();
      console.log('[ModelsPage] Fetched servers:', data.servers?.length || 0);

      // Create lookup map: model_id -> server info
      // Prioritize running servers over stopped/error ones
      const serverMap: Record<string, ServerInfo> = {};
      if (data.servers) {
        data.servers.forEach((server: ServerInfo) => {
          if (server.model_id) {
            const existing = serverMap[server.model_id];

            // Only replace if:
            // 1. No existing server for this model, OR
            // 2. New server is running and existing is not, OR
            // 3. New server is starting and existing is stopped/error
            if (!existing ||
                (server.status === 'running' && existing.status !== 'running') ||
                (server.status === 'starting' && (existing.status === 'stopped' || existing.status === 'error'))) {
              serverMap[server.model_id] = server;
            }
          }
        });
      }

      setServers(serverMap);
    } catch (err) {
      console.error('[ModelsPage] Error fetching servers:', err);
    }
  }

  async function handleDeleteModel(model: LLMModelDisplay) {
    console.log('[ModelsPage] Delete model:', model.id);

    try {
      const response = await fetch(`/api/models/${model.id}`, {
        method: 'DELETE',
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete model');
      }

      console.log('[ModelsPage] Model deleted successfully');
      // Remove from local state
      setModels(prev => prev.filter(m => m.id !== model.id));
    } catch (err) {
      console.error('[ModelsPage] Delete failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete model');
      throw err; // Re-throw so ModelCard can handle it
    }
  }

  function handleEditModel(model: LLMModelDisplay) {
    console.log('[ModelsPage] Edit model:', model.id);
    setModelToEdit(model);
    setShowEditDialog(true);
  }

  // Filter models based on search and filters
  const filteredModels = models.filter(model => {
    // Search filter
    if (searchQuery && !model.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Provider filter
    if (providerFilter !== 'all' && model.provider !== providerFilter) {
      return false;
    }

    // Ownership filter
    if (ownershipFilter === OWNERSHIP_FILTERS.GLOBAL && !model.is_global) {
      return false;
    }
    if (ownershipFilter === OWNERSHIP_FILTERS.MINE && (model.is_global || model.user_id !== user?.id)) {
      return false;
    }

    return true;
  });

  // Loading state
  if (authLoading) {
    return <LoadingState fullScreen message="Loading authentication..." />;
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center border rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">You must be logged in to manage models.</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Get unique providers for filter
  const providers = Array.from(new Set(models.map(m => m.provider)));

  return (
    <PageWrapper currentPage="models" user={user} signOut={signOut}>
      <PageHeader
        title="Model Management"
        description="Manage LLM models for your chat interface. Add custom models, test connections, and configure settings."
      />

        {/* Filters and Search */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search models by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Provider Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Provider:</label>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {providers.map(provider => (
                    <SelectItem key={provider} value={provider}>
                      {provider.charAt(0).toUpperCase() + provider.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ownership Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Ownership:</label>
              <Select value={ownershipFilter} onValueChange={(value) => setOwnershipFilter(value as OwnershipFilter)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OWNERSHIP_FILTERS.ALL}>All Models</SelectItem>
                  <SelectItem value={OWNERSHIP_FILTERS.GLOBAL}>Global Only</SelectItem>
                  <SelectItem value={OWNERSHIP_FILTERS.MINE}>My Models Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Result Count */}
            <div className="text-sm text-muted-foreground ml-auto">
              Showing {filteredModels.length} of {models.length} models
            </div>

            {/* Add Model Button */}
            <Button
              onClick={() => setShowAddDialog(true)}
              variant="ghost"
              className="gap-2 bg-gray-900 text-white hover:bg-gray-800"
            >
              <Plus className="h-4 w-4" />
              Add Model
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <ErrorState
            title="Error loading models"
            message={error}
            onRetry={fetchModels}
          />
        )}

        {/* Loading State */}
        {loading && <LoadingState message="Loading models..." />}

        {/* Empty State */}
        {!loading && filteredModels.length === 0 && !error && (
          <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
            <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery || providerFilter !== 'all' || ownershipFilter !== OWNERSHIP_FILTERS.ALL
                ? 'No models match your filters'
                : 'No models available'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || providerFilter !== 'all' || ownershipFilter !== OWNERSHIP_FILTERS.ALL
                ? 'Try adjusting your search or filters'
                : 'Add your first custom model to get started'}
            </p>
            {(searchQuery || providerFilter !== 'all' || ownershipFilter !== OWNERSHIP_FILTERS.ALL) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setProviderFilter('all');
                  setOwnershipFilter(OWNERSHIP_FILTERS.ALL);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {/* Model Grid */}
        {!loading && filteredModels.length > 0 && (
          <div className="space-y-3">
            {filteredModels.map((model) => (
              <div
                key={model.id}
                ref={(el) => {
                  if (el) {
                    modelRefs.current[model.id] = el;
                  }
                }}
                className={`transition-all duration-500 ${
                  highlightedModelId === model.id
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg'
                    : ''
                }`}
              >
                <ModelCard
                  model={model}
                  onEdit={handleEditModel}
                  onDelete={handleDeleteModel}
                  currentUserId={user?.id}
                  serverInfo={servers[model.id]}
                  sessionToken={session?.access_token}
                  onServerChanged={fetchServers}
                />
              </div>
            ))}
          </div>
        )}

        {/* Add Model Dialog */}
        {user && session?.access_token && (
          <AddModelDialog
            isOpen={showAddDialog}
            onClose={() => setShowAddDialog(false)}
            onSuccess={() => {
              setShowAddDialog(false);
              fetchModels(); // Refresh the list
            }}
            userId={user.id}
            sessionToken={session.access_token}
          />
        )}

        {/* Edit Model Dialog */}
        {user && session?.access_token && (
          <EditModelDialog
            isOpen={showEditDialog}
            model={modelToEdit}
            sessionToken={session.access_token}
            onClose={() => {
              setShowEditDialog(false);
              setModelToEdit(null);
            }}
            onUpdated={() => {
              setShowEditDialog(false);
              setModelToEdit(null);
              fetchModels(); // Refresh the list
            }}
          />
        )}
    </PageWrapper>
  );
}

export default function ModelsPage() {
  return (
    <Suspense fallback={<LoadingState fullScreen />}>
      <ModelsPageContent />
    </Suspense>
  );
}
