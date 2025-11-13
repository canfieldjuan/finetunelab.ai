/**
 * Inference Deployments Page
 *
 * Manages production inference deployments
 * - Lists all user's deployments
 * - Shows deployment status and cost tracking
 * - Provides filtering by status
 * - Allows stopping deployments
 *
 * Phase: Phase 5 - UI Components
 * Date: 2025-11-12
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Button } from '@/components/ui/button';
import { InferenceDeploymentCard } from '@/components/inference/InferenceDeploymentCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Cloud, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { InferenceDeploymentRecord } from '@/lib/inference/deployment.types';
import { toast } from 'sonner';

export default function InferencePage() {
  const { user, session, signOut, loading: authLoading } = useAuth();

  const [deployments, setDeployments] = useState<InferenceDeploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchDeployments = async () => {
    if (!user?.id) {
      console.log('[InferencePage] No user, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);

      // Fetch directly from Supabase
      const { data, error } = await supabase
        .from('inference_deployments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setDeployments((data as InferenceDeploymentRecord[]) || []);
    } catch (error) {
      console.error('[InferencePage] Fetch error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to load deployments'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, [user?.id]);

  // Auto-refresh every 30 seconds if there are active deployments
  useEffect(() => {
    const hasActiveDeployments = deployments.some(
      (d) => d.status === 'active' || d.status === 'deploying' || d.status === 'scaling'
    );

    if (!hasActiveDeployments) return;

    const interval = setInterval(() => {
      console.log('[InferencePage] Auto-refreshing active deployments...');
      fetchDeployments();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [deployments]);

  // Filter deployments by status
  const filteredDeployments = filterStatus === 'all'
    ? deployments
    : deployments.filter((d) => d.status === filterStatus);

  // Calculate total stats
  const totalActive = deployments.filter((d) => d.status === 'active').length;
  const totalSpend = deployments.reduce((sum, d) => sum + d.current_spend, 0);
  const budgetAlerts = deployments.filter(
    (d) => d.status === 'active' && d.budget_limit && (d.current_spend / d.budget_limit) >= 0.8
  ).length;

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <Cloud className="h-16 w-16 text-gray-400 mx-auto" />
          <h2 className="text-xl font-semibold">Authentication Required</h2>
          <p className="text-muted-foreground">
            Please sign in to view your inference deployments.
          </p>
          <Link href="/auth">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <AppSidebar currentPage="inference" user={user} signOut={signOut} />
      <div className="flex-1 p-8 bg-background overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Inference Deployments</h1>
              <p className="text-muted-foreground mt-1">
                Manage your production inference endpoints
              </p>
            </div>
            <Button
              onClick={fetchDeployments}
              variant="outline"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Active Endpoints</div>
                  <div className="text-2xl font-bold mt-1">{totalActive}</div>
                </div>
                <Cloud className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="p-4 bg-white border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Total Spend</div>
                  <div className="text-2xl font-bold mt-1">
                    ${totalSpend.toFixed(2)}
                  </div>
                </div>
                <svg
                  className="h-8 w-8 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="p-4 bg-white border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Budget Alerts</div>
                  <div className="text-2xl font-bold mt-1">{budgetAlerts}</div>
                </div>
                <AlertTriangle
                  className={`h-8 w-8 ${
                    budgetAlerts > 0 ? 'text-orange-500' : 'text-gray-300'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium">Filter by status:</div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Deployments</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deploying">Deploying</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              Showing {filteredDeployments.length} of {deployments.length}{' '}
              deployments
            </div>
          </div>

          {/* Deployments List */}
          {filteredDeployments.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <Cloud className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {filterStatus === 'all'
                  ? 'No Deployments Yet'
                  : `No ${filterStatus} Deployments`}
              </h3>
              <p className="text-muted-foreground mb-4">
                {filterStatus === 'all'
                  ? 'Deploy your first trained model to production to get started.'
                  : 'Try changing the filter or creating a new deployment.'}
              </p>
              {filterStatus === 'all' && (
                <Link href="/training">
                  <Button>
                    <Cloud className="mr-2 h-4 w-4" />
                    Go to Training
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredDeployments.map((deployment) => (
                <InferenceDeploymentCard
                  key={deployment.id}
                  deployment={deployment}
                  onUpdate={fetchDeployments}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
