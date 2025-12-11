/**
 * Finetuned Models Page
 * Gallery view of completed training jobs ready for deployment
 * Date: 2025-12-03
 */

'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { FinetunedModelCard } from '@/components/training/FinetunedModelCard';
import { useTrainingJobsRealtime } from '@/lib/hooks/useTrainingJobsRealtime';
import { Button } from '@/components/ui/button';
import { Search, Filter, Loader2, Database } from 'lucide-react';
import { STATUS } from '@/lib/constants';
import Link from 'next/link';

function FinetunedModelsPageContent() {
  const { user, session, signOut, loading: authLoading } = useAuth();

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [baseModelFilter, setBaseModelFilter] = useState<string>('all');

  // Use real-time hook for jobs list
  const {
    jobs: allJobs,
    isConnected,
    isLoading: loadingJobs
  } = useTrainingJobsRealtime(user?.id, session?.access_token);

  // Filter to only completed jobs
  const completedJobs = useMemo(() => {
    return allJobs.filter(job => job.status === STATUS.COMPLETED);
  }, [allJobs]);

  // Get unique base models for filter
  const baseModels = useMemo(() => {
    const models = new Set<string>();
    completedJobs.forEach(job => {
      if (job.model_name) {
        // Extract base model name (e.g., "Qwen/Qwen3-1.7B" from path or ID)
        const cleanName = job.model_name.includes('/')
          ? job.model_name.split('/').slice(-2).join('/')
          : job.model_name;
        models.add(cleanName);
      }
    });
    return Array.from(models).sort();
  }, [completedJobs]);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return completedJobs.filter(job => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const modelName = job.model_name?.toLowerCase() || '';
        const jobIdMatch = job.id.toLowerCase().includes(query);
        const modelNameMatch = modelName.includes(query);

        if (!jobIdMatch && !modelNameMatch) {
          return false;
        }
      }

      // Base model filter
      if (baseModelFilter !== 'all') {
        const modelName = job.model_name || '';
        if (!modelName.includes(baseModelFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [completedJobs, searchQuery, baseModelFilter]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Initializing authentication</p>
        </div>
      </div>
    );
  }

  // Authentication check
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-muted-foreground mb-6">
            Please log in to access your finetuned models.
          </p>
          <Link href="/">
            <Button>Go to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="finetuned-models" user={user} signOut={signOut} maxWidth="7xl">
      <PageHeader
        title="Finetuned Models"
        description="Deploy and manage your custom trained models for production and testing inference."
      />

          {/* Filters and Search */}
          <div className="mb-6 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by model name or job ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Filter Row */}
            <div className="flex items-center justify-between gap-4">
              {/* Base Model Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={baseModelFilter}
                  onChange={(e) => setBaseModelFilter(e.target.value)}
                  className="px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="all">All Base Models</option>
                  {baseModels.map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              {/* Result Count */}
              <div className="text-sm text-muted-foreground">
                {filteredJobs.length} {filteredJobs.length === 1 ? 'model' : 'models'}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loadingJobs && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Loading models...</p>
            </div>
          )}

          {/* Empty State */}
          {!loadingJobs && filteredJobs.length === 0 && (
            <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
              <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery || baseModelFilter !== 'all'
                  ? 'No models match your filters'
                  : 'No finetuned models yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || baseModelFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Complete a training job to see it here'}
              </p>
              {(searchQuery || baseModelFilter !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setBaseModelFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              )}
              {!searchQuery && baseModelFilter === 'all' && (
                <Link href="/training">
                  <Button>Start Training</Button>
                </Link>
              )}
            </div>
          )}

          {/* Models Grid */}
          {!loadingJobs && filteredJobs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJobs.map((job) => (
                <FinetunedModelCard key={job.id} job={job} />
              ))}
            </div>
          )}

      {/* Connection Status Indicator */}
      {!isConnected && !loadingJobs && (
        <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400">
          ⚠️ Real-time updates disconnected. Refreshing...
        </div>
      )}
    </PageWrapper>
  );
}

export default function FinetunedModelsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <FinetunedModelsPageContent />
    </Suspense>
  );
}
