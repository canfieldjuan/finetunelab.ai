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

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModelCard } from '@/components/models/ModelCard';
import { AddModelDialog } from '@/components/models/AddModelDialog';
import type { LLMModelDisplay } from '@/lib/models/llm-model.types';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { toast } from 'sonner';

export default function ModelsPage() {
  const { user, session, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedModelId = searchParams?.get('modelId');
  const modelRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [models, setModels] = useState<LLMModelDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'global' | 'mine'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);

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
    } catch (err) {
      console.error('[ModelsPage] Error fetching models:', err);
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
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
    // TODO: Open edit dialog in Phase 5.2.5
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
    if (ownershipFilter === 'global' && !model.is_global) {
      return false;
    }
    if (ownershipFilter === 'mine' && (model.is_global || model.user_id !== user?.id)) {
      return false;
    }

    return true;
  });

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
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
    <div className="flex h-screen overflow-hidden">
      <AppSidebar currentPage="models" user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Model Management</h1>
            <p className="text-muted-foreground">
              Manage LLM models for your chat interface. Add custom models, test connections, and configure settings.
            </p>
          </div>

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
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="px-3 py-1.5 border border-input rounded-md bg-background text-sm"
              >
                <option value="all">All Providers</option>
                {providers.map(provider => (
                  <option key={provider} value={provider}>
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Ownership Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Ownership:</label>
              <select
                value={ownershipFilter}
                onChange={(e) => setOwnershipFilter(e.target.value as 'all' | 'global' | 'mine')}
                className="px-3 py-1.5 border border-input rounded-md bg-background text-sm"
              >
                <option value="all">All Models</option>
                <option value="global">Global Only</option>
                <option value="mine">My Models Only</option>
              </select>
            </div>

            {/* Result Count */}
            <div className="text-sm text-muted-foreground ml-auto">
              Showing {filteredModels.length} of {models.length} models
            </div>

            {/* Add Model Button */}
            <Button 
              onClick={() => setShowAddDialog(true)} 
              className="gap-2 bg-white text-black hover:bg-gray-100 dark:bg-white dark:text-black dark:hover:bg-gray-200 border border-black"
            >
              <Plus className="h-4 w-4" />
              Add Model
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
            <p className="font-medium">Error loading models</p>
            <p className="text-sm mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchModels}
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-muted-foreground">Loading models...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredModels.length === 0 && !error && (
          <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
            <h3 className="text-lg font-medium mb-2">
              {searchQuery || providerFilter !== 'all' || ownershipFilter !== 'all'
                ? 'No models match your filters'
                : 'No models available'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || providerFilter !== 'all' || ownershipFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Add your first custom model to get started'}
            </p>
            {(searchQuery || providerFilter !== 'all' || ownershipFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setProviderFilter('all');
                  setOwnershipFilter('all');
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
        </div>
      </div>
    </div>
  );
}
