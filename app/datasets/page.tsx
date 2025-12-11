'use client';

import React, { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { DatasetManager } from '@/components/training/DatasetManager';

function DatasetsPageContent() {
  const { user, session, signOut } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please log in to access datasets.</p>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="datasets" user={user} signOut={signOut}>
      <PageHeader
        title="Dataset Management"
        description="Upload and manage training datasets for your models"
      />

      <DatasetManager sessionToken={session?.access_token} />
    </PageWrapper>
  );
}

export default function DatasetsPage() {
  return (
    <Suspense fallback={<LoadingState fullScreen message="Loading datasets..." />}>
      <DatasetsPageContent />
    </Suspense>
  );
}
