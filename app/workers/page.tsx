/**
 * Workers Page
 * Manage local worker agents for training
 * Date: 2025-12-30
 */

'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { WorkerAgentManagement } from '@/components/workers/WorkerAgentManagement';

export default function WorkersPage() {
  const { user, signOut, session } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view worker agents.</p>
      </div>
    );
  }

  return (
    <PageWrapper currentPage="workers" user={user} signOut={signOut}>
      <PageHeader
        title="Worker Agents"
        description="Download, configure, and manage local training agents"
      />

      {session?.access_token && (
        <WorkerAgentManagement
          userId={user.id}
          sessionToken={session.access_token}
        />
      )}
    </PageWrapper>
  );
}
