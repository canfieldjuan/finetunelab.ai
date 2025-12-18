'use client';

import React, { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { BenchmarkManager } from '@/components/training/BenchmarkManager';
import { BatchTesting } from '@/components/training/BatchTesting';
import { ScheduledEvaluationManager } from '@/components/evaluation/ScheduledEvaluationManager';

function TestingPageContent() {
  const { user, session, signOut } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please log in to access batch testing.</p>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="testing" user={user} signOut={signOut}>
      <PageHeader
        title="Model Testing"
        description="Run batch tests and manage benchmarks for your models"
      />

      <div className="space-y-6">
        <ScheduledEvaluationManager />
        <BenchmarkManager sessionToken={session?.access_token || ''} />
        <BatchTesting sessionToken={session?.access_token || ''} />
      </div>
    </PageWrapper>
  );
}

export default function TestingPage() {
  return (
    <Suspense fallback={<LoadingState fullScreen message="Loading testing workspace..." />}>
      <TestingPageContent />
    </Suspense>
  );
}
