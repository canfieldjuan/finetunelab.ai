/**
 * Cohort Analysis View Component
 *
 * Main dashboard for viewing and managing user cohorts.
 * Displays cohort cards, comparison charts, and detailed metrics.
 *
 * Phase 3.2: Cohort Analysis UI
 * Date: 2025-10-25
 */

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import type { Cohort } from '@/lib/services/cohort.service';
import CohortCard from './CohortCard';
import CohortComparisonChart from './CohortComparisonChart';
import { supabase } from '@/lib/supabaseClient';

interface CohortAnalysisViewProps {
  defaultCohortId?: string;
  comparisonMode?: boolean;
}

export default function CohortAnalysisView({
  defaultCohortId,
  comparisonMode = false
}: CohortAnalysisViewProps) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [currentCohort, setCurrentCohort] = useState<Cohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCohorts = async () => {
    console.log('[CohortAnalysisView] Fetching cohorts');
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      const response = await fetch('/api/analytics/cohorts?limit=50', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cohorts');
      }

      const data = await response.json();
      console.log('[CohortAnalysisView] Loaded', data.cohorts.length, 'cohorts');
      setCohorts(data.cohorts);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load cohorts';
      console.error('[CohortAnalysisView] Error:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const fetchCohortDetails = useCallback(async (cohortId: string) => {
    console.log('[CohortAnalysisView] Fetching details for:', cohortId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const cohort = cohorts.find(c => c.id === cohortId);
      if (cohort) {
        setCurrentCohort(cohort);
      }
    } catch (err) {
      console.error('[CohortAnalysisView] Error fetching details:', err);
    }
  }, [cohorts]);

  // useEffect hooks after functions are defined
  useEffect(() => {
    console.log('[CohortAnalysisView] Initial load');
    fetchCohorts();
   
  }, []);

  useEffect(() => {
    if (defaultCohortId) {
      setSelectedCohorts([defaultCohortId]);
      fetchCohortDetails(defaultCohortId);
    }
  }, [defaultCohortId, fetchCohortDetails]);

  const handleCohortSelect = (cohortId: string) => {
    console.log('[CohortAnalysisView] Cohort selected:', cohortId);

    if (comparisonMode) {
      setSelectedCohorts(prev => {
        if (prev.includes(cohortId)) {
          return prev.filter(id => id !== cohortId);
        } else if (prev.length < 4) {
          return [...prev, cohortId];
        }
        return prev;
      });
    } else {
      setSelectedCohorts([cohortId]);
      fetchCohortDetails(cohortId);
    }
  };

  const handleRefreshCohort = async (cohortId: string) => {
    console.log('[CohortAnalysisView] Refreshing cohort:', cohortId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/analytics/cohorts/${cohortId}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to refresh cohort');
      }

      const data = await response.json();
      console.log('[CohortAnalysisView] Refresh complete:', data);

      await fetchCohorts();
    } catch (err) {
      console.error('[CohortAnalysisView] Refresh error:', err);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-600">
            Loading cohorts...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchCohorts}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cohort Analysis</CardTitle>
            <div className="flex gap-2">
              <Button onClick={fetchCohorts} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => {/* TODO: Implement create cohort modal */}} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create Cohort
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {cohorts.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p className="mb-4">No cohorts found. Create your first cohort to get started.</p>
              <Button onClick={() => {/* TODO: Implement create cohort modal */}}>
                <Plus className="w-4 h-4 mr-2" />
                Create Cohort
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cohorts.map(cohort => (
                <CohortCard
                  key={cohort.id}
                  cohort={cohort}
                  isSelected={selectedCohorts.includes(cohort.id)}
                  onSelect={handleCohortSelect}
                  onRefresh={handleRefreshCohort}
                />
              ))}
            </div>
          )}

          {comparisonMode && selectedCohorts.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                {selectedCohorts.length} cohort{selectedCohorts.length !== 1 ? 's' : ''} selected for comparison
                {selectedCohorts.length < 4 && ' (select up to 4)'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {currentCohort && !comparisonMode && (
        <Card>
          <CardHeader>
            <CardTitle>Cohort Details: {currentCohort.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-gray-500">Member Count</div>
                <div className="text-2xl font-bold">{currentCohort.member_count}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Average Rating</div>
                <div className="text-2xl font-bold">
                  {currentCohort.average_rating?.toFixed(2) || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Success Rate</div>
                <div className="text-2xl font-bold">
                  {currentCohort.average_success_rate
                    ? `${(currentCohort.average_success_rate * 100).toFixed(1)}%`
                    : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Avg Cost/Session</div>
                <div className="text-2xl font-bold">
                  ${currentCohort.average_cost_per_session?.toFixed(4) || '0'}
                </div>
              </div>
            </div>

            {currentCohort.rating_vs_baseline !== undefined && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-3">vs Baseline</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-sm text-gray-500">Rating</div>
                    <div className={`text-lg font-medium ${
                      currentCohort.rating_vs_baseline > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {currentCohort.rating_vs_baseline > 0 ? '+' : ''}
                      {currentCohort.rating_vs_baseline.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Success Rate</div>
                    <div className={`text-lg font-medium ${
                      (currentCohort.success_rate_vs_baseline ?? 0) > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(currentCohort.success_rate_vs_baseline ?? 0) > 0 ? '+' : ''}
                      {(currentCohort.success_rate_vs_baseline ?? 0).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Cost</div>
                    <div className={`text-lg font-medium ${
                      (currentCohort.cost_vs_baseline ?? 0) < 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(currentCohort.cost_vs_baseline ?? 0) > 0 ? '+' : ''}
                      {(currentCohort.cost_vs_baseline ?? 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {comparisonMode && selectedCohorts.length > 1 && (
        <CohortComparisonChart cohortIds={selectedCohorts} />
      )}
    </div>
  );
}
