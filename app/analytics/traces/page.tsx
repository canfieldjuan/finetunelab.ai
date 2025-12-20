'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { LoadingState } from '@/components/ui/LoadingState';
import { TraceExplorer } from '@/components/analytics/TraceExplorer';

export default function TracesPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('[TracesPage] Auth state:', { user: user?.email, loading });

    if (!loading && !user) {
      console.warn('[TracesPage] No authenticated user, redirecting to login');
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
          <p className="text-muted-foreground mb-4">You must be logged in to access traces.</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="traces" user={user} signOut={signOut} maxWidth="7xl">
      <TraceExplorer />
    </PageWrapper>
  );
}
