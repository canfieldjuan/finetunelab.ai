'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { LoadingState } from '@/components/ui/LoadingState';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export default function AnalyticsPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('[AnalyticsPage] Auth state:', { user: user?.email, loading });

    if (!loading && !user) {
      console.warn('[AnalyticsPage] No authenticated user, redirecting to login');
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingState fullScreen message="Loading authentication..." />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center border rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">You must be logged in to access analytics.</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="analytics" user={user} signOut={signOut} maxWidth="7xl">
      <AnalyticsDashboard />
    </PageWrapper>
  );
}
